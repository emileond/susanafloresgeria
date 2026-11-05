import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MedicationItem, NoteItem, Prescription } from '../src/shared/types';
import { call, createPatient, seedUser } from './helpers';

const ADMIN = 'admin@example.com';
const ASSISTANT = 'asistente-rx@example.com';

beforeAll(async () => {
  await seedUser();
  await seedUser(ADMIN, 'admin');
  await seedUser(ASSISTANT, 'assistant');
});

const fullItem = {
  drug: 'Paracetamol',
  brand: 'Tempra',
  presentation: 'Tabletas 500 mg',
  dose: '1 tableta',
  route: 'Oral',
  frequency: 'Cada 8 horas',
  duration: '5 días',
  quantity: '1 caja con 20 tabletas',
  instructions: 'Tomar con alimentos',
};

async function createDraft(patientId: string, body: Record<string, unknown> = {}) {
  const res = await call(`/patients/${patientId}/prescriptions`, { method: 'POST', json: body });
  expect(res.status).toBe(201);
  return (await res.json()) as Prescription;
}

async function issue(id: string, body: Record<string, unknown> = {}, envOverrides = {}) {
  return call(`/prescriptions/${id}/issue`, { method: 'POST', json: body }, envOverrides);
}

describe('recetas: borrador y emisión', () => {
  it('crea un borrador con la fecha de hoy y el peso más reciente de las notas', async () => {
    const patientId = await createPatient('Paciente Receta Peso');
    await call(`/patients/${patientId}/notes`, {
      method: 'POST',
      json: { type: 'primera_vez', modality: 'consultorio', visitDate: '2026-10-01', vitals: { weight: 58.4 } },
    });
    const rx = await createDraft(patientId);
    expect(rx).toMatchObject({ status: 'draft', folio: null, items: [], weightKg: 58.4, snapshot: null });
    expect(rx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('prellena con medicamentos activos del paciente (solo los suyos)', async () => {
    const patientId = await createPatient('Paciente Receta Lista');
    const otherId = await createPatient('Otro Paciente');
    await call(`/patients/${patientId}/medications`, { method: 'POST', json: { name: 'Losartán', dose: '50 mg', frequency: 'Cada 24 h' } });
    await call(`/patients/${otherId}/medications`, { method: 'POST', json: { name: 'Ajeno', dose: '1 mg' } });
    const own = (await (await call(`/patients/${patientId}/medications`)).json()) as MedicationItem[];
    const other = (await (await call(`/patients/${otherId}/medications`)).json()) as MedicationItem[];

    const rx = await createDraft(patientId, { fromMedicationIds: [own[0]!.id, other[0]!.id] });
    expect(rx.items).toEqual([{ drug: 'Losartán', dose: '50 mg', frequency: 'Cada 24 h', medicationId: own[0]!.id }]);
  });

  it('rechaza vincular una nota de otro paciente', async () => {
    const a = await createPatient('Paciente A Receta');
    const b = await createPatient('Paciente B Receta');
    const note = (await (await call(`/patients/${b}/notes`, { method: 'POST', json: { type: 'evolucion', modality: 'consultorio', visitDate: '2026-11-01' } })).json()) as NoteItem;
    const res = await call(`/patients/${a}/prescriptions`, { method: 'POST', json: { noteId: note.id } });
    expect(res.status).toBe(422);
  });

  it('exige dosis, vía, frecuencia y duración antes de emitir', async () => {
    const patientId = await createPatient();
    const empty = await createDraft(patientId);
    expect((await issue(empty.id)).status).toBe(422);

    const rx = await createDraft(patientId, { items: [{ drug: 'Paracetamol' }] });
    const res = await issue(rx.id);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { fields: Record<string, string> } };
    expect(Object.keys(body.error.fields)).toEqual(['items.0.dose', 'items.0.route', 'items.0.frequency', 'items.0.duration']);
  });

  it('edita el borrador, emite con folio consecutivo y guarda los datos impresos', async () => {
    const patientId = await createPatient('Rosa Receta Ficticia');
    const rx = await createDraft(patientId, { date: '2026-11-03' });
    const patched = await call(`/prescriptions/${rx.id}`, {
      method: 'PATCH',
      json: { items: [{ ...fullItem, brand: '' }], diagnosis: 'Dolor lumbar mecánico', generalInstructions: 'Reposo relativo', weightKg: 60 },
    });
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as Prescription).items[0]).not.toHaveProperty('brand');

    const res = await issue(rx.id);
    expect(res.status).toBe(200);
    const issued = (await res.json()) as Prescription;
    expect(issued.status).toBe('issued');
    expect(issued.folio).toBeGreaterThan(0);
    expect(issued.issuedByName).toBeTruthy();
    expect(issued.snapshot?.patient).toMatchObject({ fullName: 'Rosa Receta Ficticia', age: 86 });
    expect(issued.snapshot?.prescriber.degrees.map((d) => d.cedula)).toEqual(['11529865', '14059596']);

    const second = await createDraft(patientId, { items: [fullItem] });
    const issued2 = (await (await issue(second.id)).json()) as Prescription;
    expect(issued2.folio).toBe(issued.folio! + 1);

    // Cambiar el nombre del paciente no altera la receta emitida.
    await call(`/patients/${patientId}`, { method: 'PATCH', json: { fullName: 'Rosa Nombre Cambiado' } });
    const again = (await (await call(`/prescriptions/${rx.id}`)).json()) as Prescription;
    expect(again.snapshot?.patient.fullName).toBe('Rosa Receta Ficticia');
  });

  it('puede agregar lo emitido a la lista de medicamentos sin duplicar', async () => {
    const patientId = await createPatient('Paciente Agrega Meds');
    await call(`/patients/${patientId}/medications`, { method: 'POST', json: { name: 'Paracetamol', dose: '500 mg' } });
    const rx = await createDraft(patientId, {
      items: [fullItem, { ...fullItem, drug: 'Vitamina D3', brand: undefined, dose: '1 cápsula', frequency: 'Cada semana', duration: '3 meses' }],
    });
    expect((await issue(rx.id, { addToMedications: true })).status).toBe(200);
    const meds = (await (await call(`/patients/${patientId}/medications`)).json()) as MedicationItem[];
    expect(meds.map((m) => m.name).sort()).toEqual(['Paracetamol', 'Vitamina D3']);
    expect(meds.find((m) => m.name === 'Vitamina D3')).toMatchObject({ dose: '1 cápsula', active: true, prescriber: 'Dra. Susana Flores Alonso' });
  });
});

describe('recetas: inmutabilidad y cancelación', () => {
  async function issuedRx() {
    const patientId = await createPatient();
    const rx = await createDraft(patientId, { items: [fullItem] });
    expect((await issue(rx.id)).status).toBe(200);
    return { patientId, id: rx.id };
  }

  it('la API no permite editar, volver a emitir ni borrar una receta emitida', async () => {
    const { id } = await issuedRx();
    expect((await call(`/prescriptions/${id}`, { method: 'PATCH', json: { diagnosis: 'cambio' } })).status).toBe(409);
    expect((await issue(id)).status).toBe(409);
    expect((await call(`/prescriptions/${id}`, { method: 'DELETE' })).status).toBe(409);
  });

  it('la base de datos también la protege', async () => {
    const { id } = await issuedRx();
    await expect(env.DB.prepare("UPDATE prescriptions SET diagnosis = 'alterado' WHERE id = ?").bind(id).run()).rejects.toThrow(/immutable/);
    await expect(env.DB.prepare("UPDATE prescriptions SET status = 'draft' WHERE id = ?").bind(id).run()).rejects.toThrow(/immutable/);
    await expect(
      env.DB.prepare("UPDATE prescriptions SET status = 'cancelled', cancelled_at = 1, cancel_reason = 'x', items = '[]' WHERE id = ?").bind(id).run(),
    ).rejects.toThrow(/immutable/);
    await expect(env.DB.prepare('DELETE FROM prescriptions WHERE id = ?').bind(id).run()).rejects.toThrow(/cannot be deleted/);
  });

  it('cancela con motivo, conserva la receta y permite emitir una nueva a partir de ella', async () => {
    const { patientId, id } = await issuedRx();
    expect((await call(`/prescriptions/${id}/cancel`, { method: 'POST', json: { reason: '' } })).status).toBe(422);

    const res = await call(`/prescriptions/${id}/cancel`, { method: 'POST', json: { reason: 'Dosis equivocada' } });
    expect(res.status).toBe(200);
    const cancelled = (await res.json()) as Prescription;
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelReason: 'Dosis equivocada', items: [fullItem] });
    expect(cancelled.cancelledByName).toBeTruthy();

    expect((await call(`/prescriptions/${id}/cancel`, { method: 'POST', json: { reason: 'Otra vez' } })).status).toBe(409);
    await expect(env.DB.prepare("UPDATE prescriptions SET cancel_reason = 'otro' WHERE id = ?").bind(id).run()).rejects.toThrow(/immutable/);
    await expect(env.DB.prepare('DELETE FROM prescriptions WHERE id = ?').bind(id).run()).rejects.toThrow(/cannot be deleted/);

    const copyRes = await call(`/prescriptions/${id}/copy`, { method: 'POST' });
    expect(copyRes.status).toBe(201);
    const copy = (await copyRes.json()) as Prescription;
    expect(copy).toMatchObject({ status: 'draft', sourceId: id, sourceFolio: cancelled.folio, items: [fullItem], folio: null });

    const list = (await (await call(`/patients/${patientId}/prescriptions`)).json()) as Prescription[];
    expect(list.map((p) => p.id)).toEqual(expect.arrayContaining([id, copy.id]));
  });

  it('un borrador no se cancela, pero sí se descarta', async () => {
    const patientId = await createPatient();
    const rx = await createDraft(patientId);
    expect((await call(`/prescriptions/${rx.id}/cancel`, { method: 'POST', json: { reason: 'No aplica' } })).status).toBe(409);
    await expect(env.DB.prepare("UPDATE prescriptions SET status = 'cancelled' WHERE id = ?").bind(rx.id).run()).rejects.toThrow(/only issued/);
    expect((await call(`/prescriptions/${rx.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await call(`/prescriptions/${rx.id}`)).status).toBe(404);
  });

  it('registra emisión, impresión y cancelación en la bitácora', async () => {
    const { id } = await issuedRx();
    expect((await call(`/prescriptions/${id}/printed`, { method: 'POST' })).status).toBe(200);
    await call(`/prescriptions/${id}/cancel`, { method: 'POST', json: { reason: 'Prueba de bitácora' } });
    const { results } = await env.DB.prepare("SELECT action FROM audit_log WHERE entity = 'prescription' AND entity_id = ? ORDER BY at").bind(id).all<{ action: string }>();
    expect(results.map((r) => r.action)).toEqual(expect.arrayContaining(['create', 'issue', 'print', 'cancel']));
  });
});

describe('recetas: roles', () => {
  it('un asistente no puede ver ni crear recetas', async () => {
    const patientId = await createPatient();
    const as = { DEV_USER_EMAIL: ASSISTANT };
    expect((await call(`/patients/${patientId}/prescriptions`, {}, as)).status).toBe(403);
    expect((await call(`/patients/${patientId}/prescriptions`, { method: 'POST', json: {} }, as)).status).toBe(403);
    const rx = await createDraft(patientId, { items: [fullItem] });
    expect((await call(`/prescriptions/${rx.id}`, {}, as)).status).toBe(403);
    expect((await issue(rx.id, {}, as)).status).toBe(403);
  });

  it('un administrador puede preparar borradores pero solo la médica emite o cancela', async () => {
    const patientId = await createPatient();
    const admin = { DEV_USER_EMAIL: ADMIN };
    const res = await call(`/patients/${patientId}/prescriptions`, { method: 'POST', json: { items: [fullItem] } }, admin);
    expect(res.status).toBe(201);
    const rx = (await res.json()) as Prescription;
    expect((await issue(rx.id, {}, admin)).status).toBe(403);
    expect((await issue(rx.id)).status).toBe(200);
    expect((await call(`/prescriptions/${rx.id}/cancel`, { method: 'POST', json: { reason: 'Prueba de rol' } }, admin)).status).toBe(403);
  });
});
