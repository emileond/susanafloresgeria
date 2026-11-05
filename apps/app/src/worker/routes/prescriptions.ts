import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { ageFromBirthDate, normalizeSearch, todayISO } from '../../shared/format';
import { PRESCRIBER, REQUIRED_ITEM_FIELDS } from '../../shared/prescriber';
import {
  prescriptionCancelInput,
  prescriptionCreateInput,
  prescriptionIssueInput,
  prescriptionUpdateInput,
} from '../../shared/schemas';
import type { ApiErrorBody, Prescription, PrescriptionItem, PrescriptionSnapshot } from '../../shared/types';
import { medications, notes, prescriptions, users, type Prescription as PrescriptionRow } from '../db/schema';
import { audit } from '../lib/audit';
import { requireClinical } from '../lib/auth';
import { apiError, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { iso, isoReq } from '../lib/serialize';
import { validate } from '../lib/validate';
import type { AppEnv, DB } from '../types';
import { getPatientOr404 } from './patients';

/**
 * Recetas: borrador → emitida (inmutable; también lo garantiza un trigger) → cancelada con motivo.
 * Para corregir una receta emitida se cancela y se emite una nueva a partir de ella. Nada emitido se borra.
 */

const author = alias(users, 'author');
const issuer = alias(users, 'issuer');
const canceller = alias(users, 'canceller');
const source = alias(prescriptions, 'source');

function selectPrescriptions(db: DB) {
  return db
    .select({
      rx: prescriptions,
      createdByName: author.name,
      issuedByName: issuer.name,
      cancelledByName: canceller.name,
      sourceFolio: source.folio,
    })
    .from(prescriptions)
    .leftJoin(author, eq(prescriptions.createdBy, author.id))
    .leftJoin(issuer, eq(prescriptions.issuedBy, issuer.id))
    .leftJoin(canceller, eq(prescriptions.cancelledBy, canceller.id))
    .leftJoin(source, eq(prescriptions.sourceId, source.id));
}

type Row = Awaited<ReturnType<ReturnType<typeof selectPrescriptions>['all']>>[number];

const toPrescription = ({ rx, createdByName, issuedByName, cancelledByName, sourceFolio }: Row): Prescription => ({
  id: rx.id,
  patientId: rx.patientId,
  noteId: rx.noteId,
  folio: rx.folio,
  date: rx.date,
  items: rx.items,
  diagnosis: rx.diagnosis,
  generalInstructions: rx.generalInstructions,
  weightKg: rx.weightKg,
  status: rx.status,
  snapshot: rx.snapshot ?? null,
  issuedAt: iso(rx.issuedAt),
  issuedByName,
  cancelledAt: iso(rx.cancelledAt),
  cancelledByName,
  cancelReason: rx.cancelReason,
  sourceId: rx.sourceId,
  sourceFolio: sourceFolio ?? null,
  createdAt: isoReq(rx.createdAt),
  updatedAt: isoReq(rx.updatedAt),
  createdByName,
});

async function getPrescriptionOr404(db: DB, id: string): Promise<Prescription> {
  const [row] = await selectPrescriptions(db).where(eq(prescriptions.id, id)).limit(1);
  if (!row) throw notFound('Receta');
  return toPrescription(row);
}

async function findRowOr404(db: DB, id: string): Promise<PrescriptionRow> {
  const row = await db.query.prescriptions.findFirst({ where: eq(prescriptions.id, id) });
  if (!row) throw notFound('Receta');
  return row;
}

/** Peso más reciente registrado en los signos vitales de una nota. */
async function latestWeight(db: DB, patientId: string): Promise<number | null> {
  const weight = sql<number | null>`json_extract(${notes.vitals}, '$.weight')`;
  const [row] = await db
    .select({ weight })
    .from(notes)
    .where(and(eq(notes.patientId, patientId), isNotNull(weight)))
    .orderBy(desc(notes.visitDate), desc(notes.createdAt))
    .limit(1);
  return typeof row?.weight === 'number' && row.weight > 0 ? row.weight : null;
}

async function assertNoteOfPatient(db: DB, noteId: string | null | undefined, patientId: string) {
  if (!noteId) return;
  const note = await db.query.notes.findFirst({ where: and(eq(notes.id, noteId), eq(notes.patientId, patientId)) });
  if (!note) throw apiError(422, 'invalid_note', 'La nota indicada no pertenece a este expediente.');
}

/** Quita los campos vacíos de cada renglón (para guardar JSON limpio). */
const cleanItems = (items: PrescriptionItem[]): PrescriptionItem[] =>
  items.map((it) => Object.fromEntries(Object.entries(it).filter(([, v]) => typeof v === 'string' && v.trim() !== '')) as unknown as PrescriptionItem);

/** Emitir o cancelar una receta es un acto de la médica: su nombre y cédulas son los que se imprimen. */
const requireDoctor = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user').role !== 'doctor') {
    throw apiError(403, 'forbidden', 'Solo la médica puede emitir o cancelar recetas.');
  }
  await next();
});

const patientParam = z.object({ patientId: z.uuid() });
const idParam = z.object({ id: z.uuid() });

/** Rutas anidadas en /api/patients/:patientId/prescriptions */
export const patientPrescriptionRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/', validate('param', patientParam), async (c) => {
    const { patientId } = c.req.valid('param');
    const rows = await selectPrescriptions(c.get('db'))
      .where(eq(prescriptions.patientId, patientId))
      .orderBy(desc(prescriptions.date), desc(prescriptions.createdAt));
    audit(c, { action: 'view', entity: 'prescriptions', patientId });
    return c.json(rows.map(toPrescription));
  })

  .post('/', validate('param', patientParam), validate('json', prescriptionCreateInput), async (c) => {
    const { patientId } = c.req.valid('param');
    const { fromMedicationIds, ...input } = c.req.valid('json');
    const db = c.get('db');
    await getPatientOr404(db, patientId);
    await assertNoteOfPatient(db, input.noteId, patientId);

    let items: PrescriptionItem[] = input.items ?? [];
    if (fromMedicationIds?.length) {
      const meds = await db
        .select()
        .from(medications)
        .where(and(eq(medications.patientId, patientId), inArray(medications.id, fromMedicationIds)));
      const byId = new Map(meds.map((m) => [m.id, m]));
      const fromMeds = fromMedicationIds.flatMap((mid) => {
        const m = byId.get(mid);
        return m ? [{ drug: m.name, dose: m.dose ?? undefined, frequency: m.frequency ?? undefined, medicationId: m.id }] : [];
      });
      items = [...items, ...fromMeds];
    }

    const id = newId();
    const userId = c.get('user').id;
    await db.insert(prescriptions).values({
      id,
      patientId,
      noteId: input.noteId ?? null,
      date: input.date ?? todayISO(),
      items: cleanItems(items),
      diagnosis: input.diagnosis ?? null,
      generalInstructions: input.generalInstructions ?? null,
      weightKg: input.weightKg !== undefined ? input.weightKg : await latestWeight(db, patientId),
      createdBy: userId,
      updatedBy: userId,
    });
    audit(c, { action: 'create', entity: 'prescription', entityId: id, patientId });
    return c.json(await getPrescriptionOr404(db, id), 201);
  });

/** Rutas en /api/prescriptions/:id */
export const prescriptionRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/:id', validate('param', idParam), async (c) => {
    const rx = await getPrescriptionOr404(c.get('db'), c.req.valid('param').id);
    audit(c, { action: 'view', entity: 'prescription', entityId: rx.id, patientId: rx.patientId });
    return c.json(rx);
  })

  // Solo los borradores se editan (autoguardado).
  .patch('/:id', validate('param', idParam), validate('json', prescriptionUpdateInput), async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    const current = await findRowOr404(db, id);
    if (current.status !== 'draft') {
      throw apiError(409, 'prescription_issued', 'Esta receta ya fue emitida. Para corregirla, cancélela y emita una nueva.');
    }
    if (input.noteId !== undefined) await assertNoteOfPatient(db, input.noteId, current.patientId);
    const values: Partial<typeof prescriptions.$inferInsert> = { updatedAt: new Date(), updatedBy: c.get('user').id };
    for (const [k, v] of Object.entries(input)) (values as Record<string, unknown>)[k] = v ?? null;
    if (input.items) values.items = cleanItems(input.items);
    await db.update(prescriptions).set(values).where(and(eq(prescriptions.id, id), eq(prescriptions.status, 'draft')));
    audit(c, { action: 'update', entity: 'prescription', entityId: id, patientId: current.patientId });
    return c.json(await getPrescriptionOr404(db, id));
  })

  // Emitir: asigna folio, guarda los datos impresos y bloquea la receta.
  .post('/:id/issue', requireDoctor, validate('param', idParam), validate('json', prescriptionIssueInput), async (c) => {
    const { id } = c.req.valid('param');
    const { addToMedications } = c.req.valid('json');
    const db = c.get('db');
    const rx = await findRowOr404(db, id);
    if (rx.status !== 'draft') throw apiError(409, 'prescription_issued', 'La receta ya estaba emitida.');

    if (rx.items.length === 0) throw apiError(422, 'prescription_empty', 'Agregue al menos un medicamento antes de emitir.');
    const fields: Record<string, string> = {};
    rx.items.forEach((it, i) => {
      for (const f of REQUIRED_ITEM_FIELDS) {
        if (!it[f.key]?.trim()) fields[`items.${i}.${f.key}`] ??= `Falta la ${f.label}`;
      }
    });
    if (Object.keys(fields).length > 0) {
      const body: ApiErrorBody = {
        error: { code: 'prescription_incomplete', message: 'Complete dosis, vía, frecuencia y duración de cada medicamento.', fields },
      };
      return c.json(body, 422);
    }

    const patient = await getPatientOr404(db, rx.patientId);
    const snapshot: PrescriptionSnapshot = {
      patient: {
        fullName: patient.fullName,
        birthDate: patient.birthDate,
        age: ageFromBirthDate(patient.birthDate, new Date(`${rx.date}T12:00:00Z`)),
        sex: patient.sex,
        allergies: patient.allergies,
      },
      prescriber: {
        name: PRESCRIBER.name,
        specialty: PRESCRIBER.specialty,
        degrees: PRESCRIBER.degrees.map((d) => ({ ...d })),
        address: [...PRESCRIBER.address],
      },
    };

    const userId = c.get('user').id;
    const now = new Date();
    const issued = await db
      .update(prescriptions)
      .set({
        status: 'issued',
        // Consecutivo calculado en la misma sentencia (sin carreras entre lectura y escritura).
        folio: sql`(SELECT COALESCE(MAX(folio), 0) + 1 FROM prescriptions)`,
        snapshot,
        issuedAt: now,
        issuedBy: userId,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(and(eq(prescriptions.id, id), eq(prescriptions.status, 'draft')))
      .returning({ id: prescriptions.id });
    if (issued.length === 0) throw apiError(409, 'prescription_issued', 'La receta ya estaba emitida.');

    if (addToMedications) {
      const active = await db
        .select({ id: medications.id, name: medications.name })
        .from(medications)
        .where(and(eq(medications.patientId, rx.patientId), eq(medications.active, true)));
      const activeIds = new Set(active.map((m) => m.id));
      const activeNames = new Set(active.map((m) => normalizeSearch(m.name)));
      const toAdd = rx.items.filter(
        (it) => !(it.medicationId && activeIds.has(it.medicationId)) && !activeNames.has(normalizeSearch(it.drug)) && !activeNames.has(normalizeSearch(`${it.drug} (${it.brand ?? ''})`)),
      );
      for (const it of toAdd) {
        const medId = newId();
        await db.insert(medications).values({
          id: medId,
          patientId: rx.patientId,
          name: it.brand ? `${it.drug} (${it.brand})` : it.drug,
          dose: it.dose ?? null,
          frequency: it.frequency ?? null,
          indication: rx.diagnosis?.slice(0, 200) ?? null,
          prescriber: PRESCRIBER.name,
          startDate: rx.date,
          createdBy: userId,
          updatedBy: userId,
        });
        audit(c, { action: 'create', entity: 'medication', entityId: medId, patientId: rx.patientId });
      }
    }

    audit(c, { action: 'issue', entity: 'prescription', entityId: id, patientId: rx.patientId });
    return c.json(await getPrescriptionOr404(db, id));
  })

  // Cancelar: la receta sigue en el expediente, marcada como cancelada y con el motivo.
  .post('/:id/cancel', requireDoctor, validate('param', idParam), validate('json', prescriptionCancelInput), async (c) => {
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');
    const db = c.get('db');
    const rx = await findRowOr404(db, id);
    if (rx.status === 'draft') throw apiError(409, 'prescription_draft', 'Un borrador no se cancela: puede descartarlo.');
    if (rx.status === 'cancelled') throw apiError(409, 'prescription_cancelled', 'La receta ya estaba cancelada.');
    const userId = c.get('user').id;
    const now = new Date();
    await db
      .update(prescriptions)
      .set({ status: 'cancelled', cancelledAt: now, cancelledBy: userId, cancelReason: reason, updatedAt: now, updatedBy: userId })
      .where(and(eq(prescriptions.id, id), eq(prescriptions.status, 'issued')));
    audit(c, { action: 'cancel', entity: 'prescription', entityId: id, patientId: rx.patientId });
    return c.json(await getPrescriptionOr404(db, id));
  })

  // Nueva receta en borrador a partir de una emitida o cancelada (para corregirla o repetirla).
  .post('/:id/copy', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    const original = await findRowOr404(db, id);
    if (original.status === 'draft') throw apiError(409, 'prescription_draft', 'Esta receta todavía es un borrador.');
    const newRxId = newId();
    const userId = c.get('user').id;
    await db.insert(prescriptions).values({
      id: newRxId,
      patientId: original.patientId,
      date: todayISO(),
      items: original.items,
      diagnosis: original.diagnosis,
      generalInstructions: original.generalInstructions,
      weightKg: (await latestWeight(db, original.patientId)) ?? original.weightKg,
      sourceId: original.id,
      createdBy: userId,
      updatedBy: userId,
    });
    audit(c, { action: 'create', entity: 'prescription_copy', entityId: newRxId, patientId: original.patientId });
    return c.json(await getPrescriptionOr404(db, newRxId), 201);
  })

  // Registro en bitácora de cada impresión o exportación a PDF.
  .post('/:id/printed', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const rx = await findRowOr404(c.get('db'), id);
    if (rx.status === 'draft') throw apiError(409, 'prescription_draft', 'Emita la receta antes de imprimirla.');
    audit(c, { action: 'print', entity: 'prescription', entityId: id, patientId: rx.patientId });
    return c.json({ ok: true });
  })

  // Solo se descartan borradores.
  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    const rx = await findRowOr404(db, id);
    if (rx.status !== 'draft') throw apiError(409, 'prescription_issued', 'Una receta emitida no se puede eliminar; puede cancelarla.');
    await db.delete(prescriptions).where(and(eq(prescriptions.id, id), eq(prescriptions.status, 'draft')));
    audit(c, { action: 'delete', entity: 'prescription_draft', entityId: id, patientId: rx.patientId });
    return c.json({ ok: true });
  });
