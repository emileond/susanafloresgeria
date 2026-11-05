import { and, count, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { normalizeSearch } from '../../shared/format';
import { contactInput, patientCreateInput, patientUpdateInput, searchQuery } from '../../shared/schemas';
import type { Contact, PatientDetail, PatientListItem } from '../../shared/types';
import { clinicalHistories, files, medications, notes, patientContacts, patients, type Patient } from '../db/schema';
import { audit } from '../lib/audit';
import { notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { iso, isoReq } from '../lib/serialize';
import { validate } from '../lib/validate';
import type { AppEnv, DB } from '../types';

export function toListItem(p: Patient): PatientListItem {
  return {
    id: p.id,
    fullName: p.fullName,
    birthDate: p.birthDate,
    sex: p.sex,
    phone: p.phone,
    allergies: p.allergies,
    lastVisitAt: p.lastVisitAt,
    archivedAt: iso(p.archivedAt),
    updatedAt: isoReq(p.updatedAt),
  };
}

const toContact = (c: typeof patientContacts.$inferSelect): Contact => ({
  id: c.id,
  name: c.name,
  relationship: c.relationship,
  phone: c.phone,
  isPrimary: c.isPrimary,
});

export async function getPatientOr404(db: DB, id: string): Promise<Patient> {
  const p = await db.query.patients.findFirst({ where: eq(patients.id, id) });
  if (!p) throw notFound('Paciente');
  return p;
}

const idParam = z.object({ id: z.uuid() });
const contactParam = z.object({ id: z.uuid(), contactId: z.uuid() });

export const patientRoutes = new Hono<AppEnv>()
  // Búsqueda por nombre (sin acentos) o teléfono; sin texto, devuelve los más recientes.
  // Es POST para que el término (un nombre de paciente) no quede en URLs, historial ni registros.
  .post('/search', validate('json', searchQuery), async (c) => {
    const { q, limit, includeArchived } = c.req.valid('json');
    const db = c.get('db');
    const filters = [];
    if (!includeArchived) filters.push(isNull(patients.archivedAt));
    if (q) {
      const term = `%${normalizeSearch(q).replace(/[%_]/g, '')}%`;
      const digits = q.replace(/\D/g, '');
      filters.push(
        digits.length >= 3
          ? or(like(patients.searchName, term), like(sql`replace(replace(${patients.phone}, ' ', ''), '-', '')`, `%${digits}%`))!
          : like(patients.searchName, term),
      );
    }
    const rows = await db
      .select()
      .from(patients)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(patients.updatedAt))
      .limit(limit);
    return c.json(rows.map(toListItem));
  })

  .post('/', validate('json', patientCreateInput), async (c) => {
    const input = c.req.valid('json');
    const db = c.get('db');
    const user = c.get('user');
    const id = newId();
    const insertPatient = db.insert(patients).values({
      id,
      fullName: input.fullName,
      searchName: normalizeSearch(input.fullName),
      birthDate: input.birthDate,
      sex: input.sex,
      phone: input.phone ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    });
    if (input.caregiver) {
      // Paciente y cuidador en una sola transacción.
      await db.batch([
        insertPatient,
        db.insert(patientContacts).values({
          id: newId(),
          patientId: id,
          name: input.caregiver.name,
          relationship: input.caregiver.relationship ?? null,
          phone: input.caregiver.phone ?? null,
          isPrimary: true,
          createdBy: user.id,
          updatedBy: user.id,
        }),
      ]);
    } else {
      await insertPatient;
    }
    audit(c, { action: 'create', entity: 'patient', entityId: id, patientId: id });
    return c.json({ id }, 201);
  })

  .get('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    const p = await getPatientOr404(db, id);

    const [contacts, medsCount, notesAgg, filesCount, history, lastNote] = await Promise.all([
      db.select().from(patientContacts).where(eq(patientContacts.patientId, id)).orderBy(desc(patientContacts.isPrimary)),
      db.select({ n: count() }).from(medications).where(and(eq(medications.patientId, id), eq(medications.active, true))),
      db
        .select({ total: count(), drafts: sql<number>`sum(case when ${notes.status} = 'draft' then 1 else 0 end)` })
        .from(notes)
        .where(eq(notes.patientId, id)),
      db.select({ n: count() }).from(files).where(and(eq(files.patientId, id), isNull(files.archivedAt))),
      db
        .select({ version: clinicalHistories.version })
        .from(clinicalHistories)
        .where(eq(clinicalHistories.patientId, id))
        .orderBy(desc(clinicalHistories.version))
        .limit(1),
      db
        .select({ id: notes.id, visitDate: notes.visitDate, type: notes.type })
        .from(notes)
        .where(eq(notes.patientId, id))
        .orderBy(desc(notes.visitDate), desc(notes.createdAt))
        .limit(1),
    ]);

    audit(c, { action: 'view', entity: 'patient', entityId: id, patientId: id });

    const detail: PatientDetail = {
      ...toListItem(p),
      curp: p.curp,
      address: p.address,
      bloodType: p.bloodType,
      notes: p.notes,
      createdAt: isoReq(p.createdAt),
      contacts: contacts.map(toContact),
      summary: {
        activeMedications: medsCount[0]?.n ?? 0,
        notesCount: notesAgg[0]?.total ?? 0,
        draftNotes: Number(notesAgg[0]?.drafts ?? 0),
        filesCount: filesCount[0]?.n ?? 0,
        historyVersion: history[0]?.version ?? null,
        lastNote: lastNote[0] ?? null,
      },
    };
    return c.json(detail);
  })

  .patch('/:id', validate('param', idParam), validate('json', patientUpdateInput), async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    await getPatientOr404(db, id);
    const values: Partial<typeof patients.$inferInsert> = { updatedAt: new Date(), updatedBy: c.get('user').id };
    for (const [k, v] of Object.entries(input)) {
      (values as Record<string, unknown>)[k] = v ?? null;
    }
    if (input.fullName) values.searchName = normalizeSearch(input.fullName);
    await db.update(patients).set(values).where(eq(patients.id, id));
    audit(c, { action: 'update', entity: 'patient', entityId: id, patientId: id });
    return c.json({ ok: true });
  })

  .post('/:id/archive', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    await getPatientOr404(db, id);
    await db.update(patients).set({ archivedAt: new Date(), updatedAt: new Date(), updatedBy: c.get('user').id }).where(eq(patients.id, id));
    audit(c, { action: 'archive', entity: 'patient', entityId: id, patientId: id });
    return c.json({ ok: true });
  })

  .post('/:id/unarchive', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    await getPatientOr404(db, id);
    await db.update(patients).set({ archivedAt: null, updatedAt: new Date(), updatedBy: c.get('user').id }).where(eq(patients.id, id));
    audit(c, { action: 'unarchive', entity: 'patient', entityId: id, patientId: id });
    return c.json({ ok: true });
  })

  // Contactos (familiar / cuidador responsable)
  .post('/:id/contacts', validate('param', idParam), validate('json', contactInput), async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    await getPatientOr404(db, id);
    const contactId = newId();
    if (input.isPrimary) {
      await db.update(patientContacts).set({ isPrimary: false }).where(eq(patientContacts.patientId, id));
    }
    await db.insert(patientContacts).values({
      id: contactId,
      patientId: id,
      name: input.name,
      relationship: input.relationship ?? null,
      phone: input.phone ?? null,
      isPrimary: input.isPrimary ?? false,
      createdBy: c.get('user').id,
      updatedBy: c.get('user').id,
    });
    audit(c, { action: 'create', entity: 'contact', entityId: contactId, patientId: id });
    return c.json({ id: contactId }, 201);
  })

  .patch('/:id/contacts/:contactId', validate('param', contactParam), validate('json', contactInput.partial()), async (c) => {
    const { id, contactId } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    if (input.isPrimary) {
      await db.update(patientContacts).set({ isPrimary: false }).where(eq(patientContacts.patientId, id));
    }
    const res = await db
      .update(patientContacts)
      .set({ ...input, updatedAt: new Date(), updatedBy: c.get('user').id })
      .where(and(eq(patientContacts.id, contactId), eq(patientContacts.patientId, id)))
      .returning({ id: patientContacts.id });
    if (!res.length) throw notFound('Contacto');
    audit(c, { action: 'update', entity: 'contact', entityId: contactId, patientId: id });
    return c.json({ ok: true });
  })

  .delete('/:id/contacts/:contactId', validate('param', contactParam), async (c) => {
    const { id, contactId } = c.req.valid('param');
    const res = await c
      .get('db')
      .delete(patientContacts)
      .where(and(eq(patientContacts.id, contactId), eq(patientContacts.patientId, id)))
      .returning({ id: patientContacts.id });
    if (!res.length) throw notFound('Contacto');
    audit(c, { action: 'delete', entity: 'contact', entityId: contactId, patientId: id });
    return c.json({ ok: true });
  });
