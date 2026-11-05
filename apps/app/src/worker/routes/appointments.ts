import { and, asc, desc, eq, gte, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { appointmentInput, appointmentRangeQuery, appointmentUpdateInput } from '../../shared/schemas';
import type { AppointmentItem, SyncStatus } from '../../shared/types';
import { syncDoctoralia } from '../calendar/sync';
import { appointments, patients, syncRuns, type Appointment } from '../db/schema';
import { audit } from '../lib/audit';
import { apiError, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { iso, isoReq } from '../lib/serialize';
import { validate } from '../lib/validate';
import type { AppEnv, DB } from '../types';
import { getPatientOr404 } from './patients';

/**
 * Agenda. Las citas directas se crean, editan y eliminan aquí.
 * Las de Doctoralia llegan por sincronización: horario de solo lectura (se cambia en Doctoralia),
 * pero se pueden vincular a un paciente, anotar y marcar como atendidas.
 */

export const toAppointmentItem = (a: Appointment, patientName: string | null): AppointmentItem => ({
  id: a.id,
  source: a.source,
  patientId: a.patientId,
  patientName,
  title: a.title,
  startsAt: isoReq(a.startsAt),
  endsAt: isoReq(a.endsAt),
  modality: a.modality,
  status: a.status,
  notes: a.notes,
  externalUrl: a.externalUrl,
});

export function selectAppointments(db: DB) {
  return db.select({ a: appointments, patientName: patients.fullName }).from(appointments).leftJoin(patients, eq(appointments.patientId, patients.id));
}

async function getOr404(db: DB, id: string) {
  const [row] = await selectAppointments(db).where(eq(appointments.id, id)).limit(1);
  if (!row) throw notFound('Cita');
  return row;
}

const idParam = z.object({ id: z.uuid() });

export const appointmentRoutes = new Hono<AppEnv>()
  .get('/', validate('query', appointmentRangeQuery), async (c) => {
    const { from, to } = c.req.valid('query');
    const rows = await selectAppointments(c.get('db'))
      .where(and(lt(appointments.startsAt, new Date(to)), gte(appointments.endsAt, new Date(from))))
      .orderBy(asc(appointments.startsAt));
    return c.json(rows.map((r) => toAppointmentItem(r.a, r.patientName)));
  })

  // Citas de un paciente (próximas y recientes) para su expediente.
  .get('/patient/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const rows = await selectAppointments(c.get('db')).where(eq(appointments.patientId, id)).orderBy(desc(appointments.startsAt)).limit(50);
    return c.json(rows.map((r) => toAppointmentItem(r.a, r.patientName)));
  })

  .get('/sync-status', async (c) => {
    const [last] = await c.get('db').select().from(syncRuns).where(eq(syncRuns.source, 'doctoralia')).orderBy(desc(syncRuns.startedAt)).limit(1);
    const body: SyncStatus = {
      configured: Boolean(c.env.DOCTORALIA_ICS_URL?.trim()),
      lastRun: last
        ? { status: last.status, finishedAt: iso(last.finishedAt), added: last.added, updated: last.updated, cancelled: last.cancelled, message: last.message }
        : null,
    };
    return c.json(body);
  })

  .post('/sync', async (c) => {
    if (!c.env.DOCTORALIA_ICS_URL?.trim()) throw apiError(503, 'sync_disabled', 'La sincronización con Doctoralia no está configurada.');
    const result = await syncDoctoralia(c.env, c.get('db'));
    audit(c, { action: 'update', entity: 'appointments_sync' });
    return c.json(result);
  })

  .post('/', validate('json', appointmentInput), async (c) => {
    const input = c.req.valid('json');
    const db = c.get('db');
    if (input.patientId) await getPatientOr404(db, input.patientId);
    const id = newId();
    const userId = c.get('user').id;
    await db.insert(appointments).values({
      id,
      source: 'direct',
      patientId: input.patientId ?? null,
      title: input.title ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      modality: input.modality,
      status: input.status,
      notes: input.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    });
    audit(c, { action: 'create', entity: 'appointment', entityId: id, patientId: input.patientId ?? null });
    const row = await getOr404(db, id);
    return c.json(toAppointmentItem(row.a, row.patientName), 201);
  })

  .patch('/:id', validate('param', idParam), validate('json', appointmentUpdateInput), async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    const { a } = await getOr404(db, id);

    if (a.source === 'doctoralia' && (input.startsAt || input.endsAt || input.title !== undefined || input.modality || input.status === 'cancelled')) {
      throw apiError(409, 'read_only', 'El horario de esta cita se modifica en Doctoralia.');
    }
    if (input.patientId) await getPatientOr404(db, input.patientId);
    const startsAt = input.startsAt ? new Date(input.startsAt) : a.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : a.endsAt;
    if (endsAt <= startsAt) throw apiError(422, 'invalid_range', 'La hora de fin debe ser posterior al inicio.');

    await db
      .update(appointments)
      .set({
        ...(input.patientId !== undefined ? { patientId: input.patientId } : {}),
        ...(a.source === 'direct'
          ? { title: input.title !== undefined ? (input.title ?? null) : a.title, startsAt, endsAt, modality: input.modality ?? a.modality }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedAt: new Date(),
        updatedBy: c.get('user').id,
      })
      .where(eq(appointments.id, id));
    audit(c, { action: 'update', entity: 'appointment', entityId: id, patientId: input.patientId ?? a.patientId });
    const row = await getOr404(db, id);
    return c.json(toAppointmentItem(row.a, row.patientName));
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    const { a } = await getOr404(db, id);
    if (a.source === 'doctoralia') throw apiError(409, 'read_only', 'Las citas de Doctoralia se cancelan en Doctoralia.');
    await db.delete(appointments).where(eq(appointments.id, id));
    audit(c, { action: 'delete', entity: 'appointment', entityId: id, patientId: a.patientId });
    return c.json({ ok: true });
  });
