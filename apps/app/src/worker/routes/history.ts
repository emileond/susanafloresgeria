import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { ageFromBirthDate } from '../../shared/format';
import type { HistoryData } from '../../shared/history';
import { aiHistoryDraftInput, historyInput } from '../../shared/schemas';
import type { AiHistoryDraft, HistoryResponse, HistoryVersionMeta } from '../../shared/types';
import { AiError, createAnthropic, draftHistory } from '../ai/history';
import { clinicalHistories, notes, patientContacts, users } from '../db/schema';
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
  })

  // Propuesta de la IA a partir de notas seleccionadas. No guarda nada: la doctora revisa y acepta.
  .post('/ai-draft', validate('param', patientParam), validate('json', aiHistoryDraftInput), async (c) => {
    const { patientId } = c.req.valid('param');
    const { noteIds } = c.req.valid('json');
    const client = createAnthropic(c.env);
    if (!client) throw apiError(503, 'ai_disabled', 'El asistente de IA no está configurado.');

    const { success } = await c.env.AI_LIMITER.limit({ key: c.get('user').id });
    if (!success) throw apiError(429, 'rate_limited', 'Demasiadas solicitudes al asistente. Espere un minuto.');

    const db = c.get('db');
    const patient = await getPatientOr404(db, patientId);
    const [selected, contacts, versions] = await Promise.all([
      db
        .select()
        .from(notes)
        .where(and(eq(notes.patientId, patientId), inArray(notes.id, noteIds)))
        .orderBy(notes.visitDate),
      db.select({ name: patientContacts.name }).from(patientContacts).where(eq(patientContacts.patientId, patientId)),
      listVersions(db, patientId),
    ]);
    if (!selected.length) throw apiError(422, 'no_notes', 'Seleccione al menos una nota del paciente.');

    const sexLabel = patient.sex === 'F' ? 'femenino' : patient.sex === 'M' ? 'masculino' : 'no especificado';
    const context = `Paciente de ${ageFromBirthDate(patient.birthDate)} años, sexo ${sexLabel}.`;
    const current = (versions[0]?.data ?? {}) as HistoryData;
    const model = c.env.AI_MODEL || 'claude-haiku-5-5';

    try {
      const proposals = await draftHistory(
        client,
        model,
        selected,
        current,
        { names: [patient.fullName, ...contacts.map((x) => x.name)], curp: patient.curp },
        context,
      );
      audit(c, { action: 'create', entity: 'clinical_history_ai_draft', patientId });
      const body: AiHistoryDraft = { proposals, notesUsed: selected.length, model };
      return c.json(body);
    } catch (err) {
      if (err instanceof AiError) {
        const status = err.code === 'rate_limited' ? 429 : err.code === 'upstream' ? 502 : 422;
        throw apiError(status, `ai_${err.code}`, err.message);
      }
      throw err;
    }
  });
