import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { todayISO } from '../../shared/format';
import { medicationInput, medicationUpdateInput } from '../../shared/schemas';
import type { MedicationItem } from '../../shared/types';
import { medications, type Medication } from '../db/schema';
import { audit } from '../lib/audit';
import { requireClinical } from '../lib/auth';
import { notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { isoReq } from '../lib/serialize';
import { validate } from '../lib/validate';
import type { AppEnv } from '../types';
import { getPatientOr404 } from './patients';

/** Lista de medicamentos (para detectar polifarmacia). Se suspenden, no se borran. */

const toItem = (m: Medication): MedicationItem => ({
  id: m.id,
  patientId: m.patientId,
  name: m.name,
  dose: m.dose,
  frequency: m.frequency,
  indication: m.indication,
  prescriber: m.prescriber,
  startDate: m.startDate,
  endDate: m.endDate,
  active: m.active,
  updatedAt: isoReq(m.updatedAt),
});

const patientParam = z.object({ patientId: z.uuid() });
const idParam = z.object({ id: z.uuid() });

export const patientMedicationRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/', validate('param', patientParam), async (c) => {
    const { patientId } = c.req.valid('param');
    const rows = await c
      .get('db')
      .select()
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .orderBy(desc(medications.active), desc(medications.updatedAt));
    return c.json(rows.map(toItem));
  })

  .post('/', validate('param', patientParam), validate('json', medicationInput), async (c) => {
    const { patientId } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    await getPatientOr404(db, patientId);
    const id = newId();
    const userId = c.get('user').id;
    await db.insert(medications).values({
      id,
      patientId,
      name: input.name,
      dose: input.dose ?? null,
      frequency: input.frequency ?? null,
      indication: input.indication ?? null,
      prescriber: input.prescriber ?? null,
      startDate: input.startDate ?? null,
      createdBy: userId,
      updatedBy: userId,
    });
    audit(c, { action: 'create', entity: 'medication', entityId: id, patientId });
    return c.json({ id }, 201);
  });

export const medicationRoutes = new Hono<AppEnv>()
  .use(requireClinical).patch(
  '/:id',
  validate('param', idParam),
  validate('json', medicationUpdateInput),
  async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    const current = await db.query.medications.findFirst({ where: eq(medications.id, id) });
    if (!current) throw notFound('Medicamento');
    const values: Partial<typeof medications.$inferInsert> = { updatedAt: new Date(), updatedBy: c.get('user').id };
    for (const [k, v] of Object.entries(input)) (values as Record<string, unknown>)[k] = v ?? null;
    // Al suspender, se registra la fecha de término si no se indicó.
    if (input.active === false && !input.endDate && !current.endDate) values.endDate = todayISO();
    if (input.active === true) values.endDate = null;
    await db.update(medications).set(values).where(eq(medications.id, id));
    audit(c, { action: 'update', entity: 'medication', entityId: id, patientId: current.patientId });
    return c.json({ ok: true });
  },
);
