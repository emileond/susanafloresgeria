import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { SCALES_BY_KEY } from '../src/shared/scales';
import type { AssessmentItem, Me, NoteItem } from '../src/shared/types';
import { AiError, deidentify, draftHistory, type ParseClient } from '../src/worker/ai/history';
import { call, createPatient, seedUser } from './helpers';

beforeAll(async () => {
  await seedUser();
});

/** Barthel con "independiente" en todo excepto escaleras (5) → 95. */
const barthelAnswers = () => {
  const s = SCALES_BY_KEY.barthel!;
  return Object.fromEntries(s.items.map((i) => [i.id, i.id === 'escaleras' ? 1 : 0]));
};

describe('escalas (API)', () => {
  it('rechaza respuestas incompletas', async () => {
    const patientId = await createPatient();
    const res = await call(`/patients/${patientId}/assessments`, { method: 'POST', json: { scaleKey: 'barthel', answers: { comer: 0 }, performedAt: '2026-11-04' } });
    expect(res.status).toBe(422);
  });

  it('calcula la puntuación en el servidor y la agrega a una nota nueva', async () => {
    const patientId = await createPatient();
    const res = await call(`/patients/${patientId}/assessments`, {
      method: 'POST',
      json: { scaleKey: 'barthel', answers: barthelAnswers(), performedAt: '2026-11-04', attach: { mode: 'new_note' } },
    });
    expect(res.status).toBe(201);
    const a = (await res.json()) as AssessmentItem;
    expect(a).toMatchObject({ score: 95, maxScore: 100, interpretation: 'Dependencia escasa', severity: 'mild' });
    expect(a.noteId).toBeTruthy();
    const note = (await (await call(`/notes/${a.noteId}`)).json()) as NoteItem;
    expect(note.status).toBe('draft');
    expect(note.objective).toContain('Índice de Barthel');
    expect(note.objective).toContain('95/100');
  });

  it('agrega el resultado al final de un borrador existente, pero no a una nota firmada', async () => {
    const patientId = await createPatient();
    const draft = (await (await call(`/patients/${patientId}/notes`, { method: 'POST', json: { type: 'evolucion', modality: 'consultorio', visitDate: '2026-11-04', objective: 'TA normal' } })).json()) as NoteItem;
    const frail = SCALES_BY_KEY.frail!;
    const answers = Object.fromEntries(frail.items.map((i) => [i.id, 0])); // índice 0 = "Sí" → 5 puntos
    const ok = await call(`/patients/${patientId}/assessments`, { method: 'POST', json: { scaleKey: 'frail', answers, performedAt: '2026-11-04', attach: { mode: 'note', noteId: draft.id } } });
    expect(ok.status).toBe(201);
    const updated = (await (await call(`/notes/${draft.id}`)).json()) as NoteItem;
    expect(updated.objective?.split('\n')).toEqual(['TA normal', expect.stringContaining('Escala FRAIL')]);

    await call(`/notes/${draft.id}/sign`, { method: 'POST' });
    const blocked = await call(`/patients/${patientId}/assessments`, { method: 'POST', json: { scaleKey: 'frail', answers, performedAt: '2026-11-04', attach: { mode: 'note', noteId: draft.id } } });
    expect(blocked.status).toBe(409);
  });

  it('las escalas con licencia solo se aceptan si están habilitadas', async () => {
    const patientId = await createPatient();
    const zarit = SCALES_BY_KEY.zarit!;
    const answers = Object.fromEntries(zarit.items.map((i) => [i.id, 0]));
    const body = { method: 'POST', json: { scaleKey: 'zarit', answers, performedAt: '2026-11-04' } };
    expect((await call(`/patients/${patientId}/assessments`, body)).status).toBe(422);
    expect((await call(`/patients/${patientId}/assessments`, body, { LICENSED_SCALES: 'zarit' })).status).toBe(201);

    const me = (await (await call('/me')).json()) as Me;
    expect(me.features.scales).not.toContain('zarit');
  });

  it('un resultado guardado no se puede modificar', async () => {
    const patientId = await createPatient();
    const a = (await (await call(`/patients/${patientId}/assessments`, { method: 'POST', json: { scaleKey: 'barthel', answers: barthelAnswers(), performedAt: '2026-11-04' } })).json()) as AssessmentItem;
    await expect(env.DB.prepare('UPDATE assessments SET score = 100 WHERE id = ?').bind(a.id).run()).rejects.toThrow(/immutable/);
    const list = (await (await call(`/patients/${patientId}/assessments`)).json()) as AssessmentItem[];
    expect(list).toHaveLength(1);
  });
});

describe('asistente de IA para la historia clínica', () => {
  it('responde 503 si no hay clave configurada', async () => {
    const patientId = await createPatient();
    const note = (await (await call(`/patients/${patientId}/notes`, { method: 'POST', json: { type: 'primera_vez', modality: 'consultorio', visitDate: '2026-11-04', subjective: 'Olvidos' } })).json()) as NoteItem;
    const res = await call(`/patients/${patientId}/history/ai-draft`, { method: 'POST', json: { noteIds: [note.id] } }, { ANTHROPIC_API_KEY: '' });
    expect(res.status).toBe(503);
  });

  it('elimina nombre, CURP, teléfonos y correos antes de enviar', () => {
    const text = 'José Núñez acude con su hija Ana (ana.nunez@correo.com, 477 123 4567). CURP NUPJ400510HGTXXX09. Jose refiere caídas; NUÑEZ niega fiebre.';
    const out = deidentify(text, { names: ['José Núñez Pérez', 'Ana Núñez'], curp: 'NUPJ400510HGTXXX09' });
    expect(out).not.toMatch(/Jos[eé]|N[uú][nñ]ez|Ana\b|477|@|NUPJ/i);
    expect(out).toContain('[nombre]');
    expect(out).toContain('[teléfono]');
    expect(out).toContain('[correo]');
    expect(out).toContain('[CURP]');
    expect(out).toContain('refiere caídas');
  });

  const fakeClient = (output: unknown, stop_reason = 'end_turn'): ParseClient =>
    ({ messages: { parse: async () => ({ stop_reason, parsed_output: output }) } }) as unknown as ParseClient;
  const emptySections = { heredofamiliares: '', personalesPatologicos: '', personalesNoPatologicos: '', ginecoObstetricos: '', padecimientoActual: '', aparatosSistemas: '', exploracionFisica: '', resultadosEstudios: '', diagnosticos: '', plan: '' };
  const note = { visitDate: '2026-11-04', type: 'primera_vez', subjective: 'Olvidos', objective: null, assessment: null, plan: null, body: null };

  it('devuelve solo las secciones que cambian', async () => {
    const client = fakeClient({ sections: { ...emptySections, padecimientoActual: 'Olvidos desde hace 1 año.', plan: 'Igual' } });
    const proposals = await draftHistory(client, 'claude-haiku-5-5', [note], { plan: 'Igual' }, { names: [] }, 'Paciente de 85 años.');
    expect(proposals).toEqual({ padecimientoActual: 'Olvidos desde hace 1 año.' });
  });

  it('informa cuando el modelo se niega o la salida no es válida', async () => {
    await expect(draftHistory(fakeClient(null, 'refusal'), 'm', [note], {}, { names: [] }, '')).rejects.toBeInstanceOf(AiError);
    await expect(draftHistory(fakeClient(null), 'm', [note], {}, { names: [] }, '')).rejects.toMatchObject({ code: 'invalid_output' });
  });
});
