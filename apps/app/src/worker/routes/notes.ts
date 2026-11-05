import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { Hono } from 'hono';
import { z } from 'zod';
import { todayISO } from '../../shared/format';
import { noteInput, noteUpdateInput } from '../../shared/schemas';
import type { NoteItem } from '../../shared/types';
import { notes, patients, users, type Note } from '../db/schema';
import { audit } from '../lib/audit';
import { requireClinical } from '../lib/auth';
import { apiError, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { iso, isoReq } from '../lib/serialize';
import { validate } from '../lib/validate';
import type { AppEnv, DB } from '../types';
import { getPatientOr404 } from './patients';

const author = alias(users, 'author');
const signer = alias(users, 'signer');

function toNoteItem(n: Note, createdByName: string | null, signedByName: string | null): NoteItem {
  return {
    id: n.id,
    patientId: n.patientId,
    type: n.type,
    modality: n.modality,
    visitDate: n.visitDate,
    subjective: n.subjective,
    objective: n.objective,
    assessment: n.assessment,
    plan: n.plan,
    body: n.body,
    vitals: n.vitals ?? null,
    status: n.status,
    signedAt: iso(n.signedAt),
    signedByName,
    amendsNoteId: n.amendsNoteId,
    createdAt: isoReq(n.createdAt),
    updatedAt: isoReq(n.updatedAt),
    createdByName,
  };
}

function selectNotes(db: DB) {
  return db
    .select({ note: notes, createdByName: author.name, signedByName: signer.name })
    .from(notes)
    .leftJoin(author, eq(notes.createdBy, author.id))
    .leftJoin(signer, eq(notes.signedBy, signer.id));
}

async function getNoteOr404(db: DB, id: string): Promise<NoteItem> {
  const [row] = await selectNotes(db).where(eq(notes.id, id)).limit(1);
  if (!row) throw notFound('Nota');
  return toNoteItem(row.note, row.createdByName, row.signedByName);
}

const hasContent = (n: Pick<Note, 'subjective' | 'objective' | 'assessment' | 'plan' | 'body'>) =>
  [n.subjective, n.objective, n.assessment, n.plan, n.body].some((v) => v && v.trim().length > 0);

const patientParam = z.object({ patientId: z.uuid() });
const idParam = z.object({ id: z.uuid() });

/** Rutas anidadas en /api/patients/:patientId/notes */
export const patientNoteRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/', validate('param', patientParam), async (c) => {
    const { patientId } = c.req.valid('param');
    const rows = await selectNotes(c.get('db'))
      .where(eq(notes.patientId, patientId))
      .orderBy(desc(notes.visitDate), desc(notes.createdAt));
    audit(c, { action: 'view', entity: 'notes', patientId });
    return c.json(rows.map((r) => toNoteItem(r.note, r.createdByName, r.signedByName)));
  })

  .post('/', validate('param', patientParam), validate('json', noteInput), async (c) => {
    const { patientId } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    await getPatientOr404(db, patientId);
    const id = newId();
    const userId = c.get('user').id;
    await db.insert(notes).values({ id, patientId, ...input, vitals: input.vitals ?? null, createdBy: userId, updatedBy: userId });
    audit(c, { action: 'create', entity: 'note', entityId: id, patientId });
    return c.json(await getNoteOr404(db, id), 201);
  });

/** Rutas en /api/notes/:id */
export const noteRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/:id', validate('param', idParam), async (c) => {
    const note = await getNoteOr404(c.get('db'), c.req.valid('param').id);
    audit(c, { action: 'view', entity: 'note', entityId: note.id, patientId: note.patientId });
    return c.json(note);
  })

  // Solo los borradores se pueden editar (autoguardado).
  .patch('/:id', validate('param', idParam), validate('json', noteUpdateInput), async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    const current = await getNoteOr404(db, id);
    if (current.status === 'signed') {
      throw apiError(409, 'note_signed', 'Esta nota ya está firmada. Para corregirla, agregue una adenda.');
    }
    const values: Partial<typeof notes.$inferInsert> = { updatedAt: new Date(), updatedBy: c.get('user').id };
    for (const [k, v] of Object.entries(input)) (values as Record<string, unknown>)[k] = v ?? null;
    await db.update(notes).set(values).where(and(eq(notes.id, id), eq(notes.status, 'draft')));
    audit(c, { action: 'update', entity: 'note', entityId: id, patientId: current.patientId });
    return c.json(await getNoteOr404(db, id));
  })

  // Firmar: la nota queda bloqueada (también lo impide un trigger en la base de datos).
  .post('/:id/sign', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    const note = await db.query.notes.findFirst({ where: eq(notes.id, id) });
    if (!note) throw notFound('Nota');
    if (note.status === 'signed') throw apiError(409, 'note_signed', 'La nota ya estaba firmada.');
    if (!hasContent(note)) throw apiError(422, 'note_empty', 'La nota está vacía. Escriba su contenido antes de firmar.');

    const userId = c.get('user').id;
    const patient = await getPatientOr404(db, note.patientId);
    const lastVisit = !patient.lastVisitAt || note.visitDate > patient.lastVisitAt ? note.visitDate : patient.lastVisitAt;
    await db.batch([
      db.update(notes).set({ status: 'signed', signedAt: new Date(), signedBy: userId, updatedAt: new Date(), updatedBy: userId }).where(eq(notes.id, id)),
      db.update(patients).set({ lastVisitAt: lastVisit, updatedAt: new Date() }).where(eq(patients.id, note.patientId)),
    ]);
    audit(c, { action: 'sign', entity: 'note', entityId: id, patientId: note.patientId });
    return c.json(await getNoteOr404(db, id));
  })

  // Adenda: nueva nota en borrador vinculada a una nota firmada.
  .post('/:id/addendum', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    const original = await db.query.notes.findFirst({ where: eq(notes.id, id) });
    if (!original) throw notFound('Nota');
    if (original.status !== 'signed') throw apiError(409, 'note_not_signed', 'Solo se agregan adendas a notas firmadas.');
    const newNoteId = newId();
    const userId = c.get('user').id;
    await db.insert(notes).values({
      id: newNoteId,
      patientId: original.patientId,
      type: original.type,
      modality: original.modality,
      visitDate: todayISO(),
      amendsNoteId: original.id,
      createdBy: userId,
      updatedBy: userId,
    });
    audit(c, { action: 'create', entity: 'note_addendum', entityId: newNoteId, patientId: original.patientId });
    return c.json(await getNoteOr404(db, newNoteId), 201);
  })

  // Solo se pueden descartar borradores; una nota firmada es parte permanente del expediente.
  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    const note = await db.query.notes.findFirst({ where: eq(notes.id, id) });
    if (!note) throw notFound('Nota');
    if (note.status === 'signed') throw apiError(409, 'note_signed', 'Una nota firmada no se puede eliminar.');
    await db.delete(notes).where(and(eq(notes.id, id), eq(notes.status, 'draft')));
    audit(c, { action: 'delete', entity: 'note_draft', entityId: id, patientId: note.patientId });
    return c.json({ ok: true });
  });
