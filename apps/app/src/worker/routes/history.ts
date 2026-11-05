import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { HistoryData } from '../../shared/history';
import { historyInput } from '../../shared/schemas';
import type { HistoryResponse, HistoryVersionMeta } from '../../shared/types';
import { clinicalHistories, users } from '../db/schema';
import { audit } from '../lib/audit';
import { requireClinical } from '../lib/auth';
import { apiError, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { isoReq } from '../lib/serialize';
import { validate } from '../lib/validate';
import type { AppEnv, DB } from '../types';
import { getPatientOr404 } from './patients';

/** Historia clínica versionada: cada guardado crea una versión nueva; las anteriores se conservan. */

async function listVersions(db: DB, patientId: string) {
  return db
    .select({
      version: clinicalHistories.version,
      source: clinicalHistories.source,
      createdAt: clinicalHistories.createdAt,
      createdByName: users.name,
      data: clinicalHistories.data,
    })
    .from(clinicalHistories)
    .leftJoin(users, eq(clinicalHistories.createdBy, users.id))
    .where(eq(clinicalHistories.patientId, patientId))
    .orderBy(desc(clinicalHistories.version));
}

const meta = (r: Awaited<ReturnType<typeof listVersions>>[number]): HistoryVersionMeta => ({
  version: r.version,
  source: r.source,
  createdAt: isoReq(r.createdAt),
  createdByName: r.createdByName,
});

const patientParam = z.object({ patientId: z.uuid() });

export const historyRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/', validate('param', patientParam), async (c) => {
    const { patientId } = c.req.valid('param');
    const rows = await listVersions(c.get('db'), patientId);
    const latest = rows[0];
    const body: HistoryResponse = {
      current: latest ? { ...meta(latest), data: latest.data as HistoryData } : null,
      versions: rows.map(meta),
    };
    audit(c, { action: 'view', entity: 'clinical_history', patientId });
    return c.json(body);
  })

  .get('/:version', validate('param', patientParam.extend({ version: z.coerce.number().int().positive() })), async (c) => {
    const { patientId, version } = c.req.valid('param');
    const [row] = await c
      .get('db')
      .select()
      .from(clinicalHistories)
      .where(and(eq(clinicalHistories.patientId, patientId), eq(clinicalHistories.version, version)))
      .limit(1);
    if (!row) throw notFound('Versión');
    audit(c, { action: 'view', entity: 'clinical_history', entityId: row.id, patientId });
    return c.json({ version: row.version, source: row.source, createdAt: isoReq(row.createdAt), data: row.data as HistoryData });
  })

  .post('/', validate('param', patientParam), validate('json', historyInput), async (c) => {
    const { patientId } = c.req.valid('param');
    const { data, source } = c.req.valid('json');
    const db = c.get('db');
    await getPatientOr404(db, patientId);
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string' && v.trim() !== ''));
    const userId = c.get('user').id;

    // Si dos guardados coinciden, el índice único (paciente, versión) rechaza uno; se reintenta una vez.
    for (let attempt = 0; attempt < 2; attempt++) {
      const [latest] = await db
        .select({ version: clinicalHistories.version })
        .from(clinicalHistories)
        .where(eq(clinicalHistories.patientId, patientId))
        .orderBy(desc(clinicalHistories.version))
        .limit(1);
      const version = (latest?.version ?? 0) + 1;
      try {
        const id = newId();
        await db.insert(clinicalHistories).values({ id, patientId, version, data: clean, source, createdBy: userId, updatedBy: userId });
        audit(c, { action: 'create', entity: 'clinical_history', entityId: id, patientId });
        return c.json({ version }, 201);
      } catch (err) {
        if (attempt === 1) throw err;
      }
    }
    throw apiError(409, 'conflict', 'No se pudo guardar. Intente de nuevo.');
  });
