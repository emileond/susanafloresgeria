import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { formatDate } from '../../shared/format';
import { enabledScales, missingAnswers, SCALES_BY_KEY, type ScaleDefinition, type ScaleResult } from '../../shared/scales';
import { assessmentInput } from '../../shared/schemas';
import type { AssessmentItem } from '../../shared/types';
import { assessments, notes, users, type Assessment } from '../db/schema';
import { audit } from '../lib/audit';
import { requireClinical } from '../lib/auth';
import { apiError, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { isoReq } from '../lib/serialize';
import { validate } from '../lib/validate';
import type { AppEnv } from '../types';
import { getPatientOr404 } from './patients';

const toItem = (a: Assessment, createdByName: string | null): AssessmentItem => ({
  id: a.id,
  patientId: a.patientId,
  noteId: a.noteId,
  scaleKey: a.scaleKey,
  scaleVersion: a.scaleVersion,
  answers: a.answers,
  score: a.score,
  maxScore: a.maxScore,
  interpretation: a.interpretation,
  severity: a.severity,
  details: a.details ?? null,
  respondent: a.respondent,
  comment: a.comment,
  performedAt: a.performedAt,
  createdAt: isoReq(a.createdAt),
  createdByName,
});

/** Texto que se agrega a la nota: "Índice de Barthel (4 nov 2026): 90/100 — Dependencia moderada." */
export function assessmentSummary(scale: ScaleDefinition, result: ScaleResult, performedAt: string): string {
  const details = result.details?.length ? ` (${result.details.map((d) => `${d.label}: ${d.value}`).join('; ')})` : '';
  return `${scale.name} (${formatDate(performedAt)}): ${result.score}/${result.maxScore} — ${result.interpretation}${details}.`;
}

const appendLine = (current: string | null, line: string) => (current?.trim() ? `${current.trimEnd()}\n${line}` : line);

const patientParam = z.object({ patientId: z.uuid() });
const idParam = z.object({ id: z.uuid() });

export const patientAssessmentRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/', validate('param', patientParam), async (c) => {
    const { patientId } = c.req.valid('param');
    const rows = await c
      .get('db')
      .select({ a: assessments, createdByName: users.name })
      .from(assessments)
      .leftJoin(users, eq(assessments.createdBy, users.id))
      .where(eq(assessments.patientId, patientId))
      .orderBy(desc(assessments.performedAt), desc(assessments.createdAt));
    audit(c, { action: 'view', entity: 'assessments', patientId });
    return c.json(rows.map((r) => toItem(r.a, r.createdByName)));
  })

  .post('/', validate('param', patientParam), validate('json', assessmentInput), async (c) => {
    const { patientId } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    await getPatientOr404(db, patientId);

    const scale = SCALES_BY_KEY[input.scaleKey];
    if (!scale || !enabledScales(c.env.LICENSED_SCALES).includes(scale)) {
      throw apiError(422, 'scale_unavailable', 'Esta escala no está disponible.');
    }
    const answers = Object.fromEntries(scale.items.map((i) => [i.id, input.answers[i.id]!]));
    const missing = missingAnswers(scale.items, input.answers);
    if (missing.length) throw apiError(422, 'incomplete', `Faltan ${missing.length} respuesta(s) por contestar.`);

    // La puntuación siempre se calcula aquí, con la misma definición que usa la interfaz.
    const result = scale.score(answers);
    const userId = c.get('user').id;
    const id = newId();
    let noteId: string | null = null;
    const summary = assessmentSummary(scale, result, input.performedAt);

    // La nota (si aplica) y el resultado se guardan en una sola transacción.
    let noteStatement = null;
    if (input.attach.mode === 'note') {
      const note = await db.query.notes.findFirst({ where: and(eq(notes.id, input.attach.noteId), eq(notes.patientId, patientId)) });
      if (!note) throw notFound('Nota');
      if (note.status !== 'draft') throw apiError(409, 'note_signed', 'Solo se puede agregar a una nota en borrador.');
      noteId = note.id;
      noteStatement = db
        .update(notes)
        .set({ objective: appendLine(note.objective, summary), updatedAt: new Date(), updatedBy: userId })
        .where(and(eq(notes.id, note.id), eq(notes.status, 'draft')));
    } else if (input.attach.mode === 'new_note') {
      noteId = newId();
      noteStatement = db.insert(notes).values({
        id: noteId,
        patientId,
        type: 'evolucion',
        modality: 'consultorio',
        visitDate: input.performedAt,
        objective: summary,
        createdBy: userId,
        updatedBy: userId,
      });
    }

    const insertAssessment = db.insert(assessments).values({
      id,
      patientId,
      noteId,
      scaleKey: scale.key,
      scaleVersion: scale.version,
      answers,
      score: result.score,
      maxScore: result.maxScore,
      interpretation: result.interpretation,
      severity: result.severity,
      details: result.details ?? null,
      respondent: input.respondent ?? scale.respondent,
      comment: input.comment ?? null,
      performedAt: input.performedAt,
      createdBy: userId,
      updatedBy: userId,
    });
    if (noteStatement) await db.batch([noteStatement, insertAssessment]);
    else await insertAssessment;
    if (input.attach.mode === 'new_note') audit(c, { action: 'create', entity: 'note', entityId: noteId, patientId });
    if (input.attach.mode === 'note') audit(c, { action: 'update', entity: 'note', entityId: noteId, patientId });
    audit(c, { action: 'create', entity: 'assessment', entityId: id, patientId });

    const saved = await db.query.assessments.findFirst({ where: eq(assessments.id, id) });
    return c.json(toItem(saved!, c.get('user').name), 201);
  });

export const assessmentRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const [row] = await c
      .get('db')
      .select({ a: assessments, createdByName: users.name })
      .from(assessments)
      .leftJoin(users, eq(assessments.createdBy, users.id))
      .where(eq(assessments.id, id))
      .limit(1);
    if (!row) throw notFound('Resultado');
    audit(c, { action: 'view', entity: 'assessment', entityId: id, patientId: row.a.patientId });
    return c.json(toItem(row.a, row.createdByName));
  });
