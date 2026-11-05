import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import type { FileItem, NoteItem, PatientDetail, PatientListItem } from '../src/shared/types';
import { call, createPatient, seedUser } from './helpers';

beforeAll(async () => {
  await seedUser();
});

describe('autenticación', () => {
  it('rechaza peticiones sin JWT de Cloudflare Access en producción', async () => {
    const res = await call('/me', {}, { ENVIRONMENT: 'production', ACCESS_TEAM_DOMAIN: 'equipo.cloudflareaccess.com', ACCESS_AUD: 'aud' });
    expect(res.status).toBe(401);
  });

  it('rechaza un JWT inválido', async () => {
    const res = await call('/me', { headers: { 'cf-access-jwt-assertion': 'no.es.valido' } }, { ENVIRONMENT: 'production', ACCESS_TEAM_DOMAIN: 'equipo.cloudflareaccess.com', ACCESS_AUD: 'aud' });
    expect(res.status).toBe(401);
  });

  it('niega el acceso a correos que no están dados de alta', async () => {
    const res = await call('/me', {}, { DEV_USER_EMAIL: 'desconocido@example.com' });
    expect(res.status).toBe(403);
  });

  it('da de alta automáticamente a la doctora configurada en BOOTSTRAP_ADMIN_EMAIL', async () => {
    const res = await call('/me', {}, { DEV_USER_EMAIL: 'primera@example.com', BOOTSTRAP_ADMIN_EMAIL: 'Primera@example.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email: 'primera@example.com', role: 'doctor', canEditClinical: true });
  });

  it('devuelve el usuario actual sin guardar en caché', async () => {
    const res = await call('/me');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('pacientes', () => {
  it('registra un paciente con su cuidador y lo encuentra sin acentos', async () => {
    const id = await createPatient('María Ángeles Núñez');
    const found = (await (await call('/patients/search', { method: 'POST', json: { q: 'angeles nunez' } })).json()) as PatientListItem[];
    expect(found.map((p) => p.id)).toContain(id);

    const detail = (await (await call(`/patients/${id}`)).json()) as PatientDetail;
    expect(detail.contacts).toHaveLength(1);
    expect(detail.contacts[0]).toMatchObject({ name: 'Ana Pérez', isPrimary: true });
  });

  it('valida los datos de alta', async () => {
    const res = await call('/patients', { method: 'POST', json: { fullName: 'A', birthDate: '2999-01-01', sex: 'M' } });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { fields: Record<string, string> } };
    expect(Object.keys(body.error.fields)).toEqual(expect.arrayContaining(['fullName', 'birthDate']));
  });

  it('archiva sin borrar y oculta de la búsqueda', async () => {
    const id = await createPatient('Paciente Para Archivar');
    expect((await call(`/patients/${id}/archive`, { method: 'POST' })).status).toBe(200);
    const list = (await (await call('/patients/search', { method: 'POST', json: { q: 'para archivar' } })).json()) as PatientListItem[];
    expect(list.find((p) => p.id === id)).toBeUndefined();
    expect((await call(`/patients/${id}`)).status).toBe(200);
  });
});

describe('notas clínicas', () => {
  it('permite editar el borrador, firmar y luego bloquea cambios', async () => {
    const patientId = await createPatient();
    const created = (await (await call(`/patients/${patientId}/notes`, { method: 'POST', json: { type: 'primera_vez', modality: 'consultorio', visitDate: '2026-11-01' } })).json()) as NoteItem;
    expect(created.status).toBe('draft');

    // Firmar una nota vacía no se permite.
    expect((await call(`/notes/${created.id}/sign`, { method: 'POST' })).status).toBe(422);

    const patched = await call(`/notes/${created.id}`, { method: 'PATCH', json: { subjective: 'Refiere olvidos', vitals: { taSys: 130, taDia: 80 } } });
    expect(patched.status).toBe(200);

    const signed = (await (await call(`/notes/${created.id}/sign`, { method: 'POST' })).json()) as NoteItem;
    expect(signed.status).toBe('signed');
    expect(signed.signedByName).toBeTruthy();

    const afterSign = await call(`/notes/${created.id}`, { method: 'PATCH', json: { subjective: 'cambio' } });
    expect(afterSign.status).toBe(409);
    expect((await call(`/notes/${created.id}`, { method: 'DELETE' })).status).toBe(409);

    const detail = (await (await call(`/patients/${patientId}`)).json()) as PatientDetail;
    expect(detail.lastVisitAt).toBe('2026-11-01');
  });

  it('la base de datos también impide modificar una nota firmada', async () => {
    const patientId = await createPatient();
    const note = (await (await call(`/patients/${patientId}/notes`, { method: 'POST', json: { type: 'evolucion', modality: 'domicilio', visitDate: '2026-11-02', plan: 'Control en 1 mes' } })).json()) as NoteItem;
    await call(`/notes/${note.id}/sign`, { method: 'POST' });
    await expect(env.DB.prepare("UPDATE notes SET plan = 'alterado' WHERE id = ?").bind(note.id).run()).rejects.toThrow(/immutable/);
  });

  it('crea adendas solo sobre notas firmadas', async () => {
    const patientId = await createPatient();
    const note = (await (await call(`/patients/${patientId}/notes`, { method: 'POST', json: { type: 'evolucion', modality: 'consultorio', visitDate: '2026-11-02', assessment: 'Estable' } })).json()) as NoteItem;
    expect((await call(`/notes/${note.id}/addendum`, { method: 'POST' })).status).toBe(409);
    await call(`/notes/${note.id}/sign`, { method: 'POST' });
    const addendum = (await (await call(`/notes/${note.id}/addendum`, { method: 'POST' })).json()) as NoteItem;
    expect(addendum).toMatchObject({ amendsNoteId: note.id, status: 'draft' });
  });

  it('un asistente no puede ver notas clínicas', async () => {
    await seedUser('asistente@example.com', 'assistant');
    const patientId = await createPatient();
    const res = await call(`/patients/${patientId}/notes`, {}, { DEV_USER_EMAIL: 'asistente@example.com' });
    expect(res.status).toBe(403);
    // Pero sí los datos de identificación.
    expect((await call(`/patients/${patientId}`, {}, { DEV_USER_EMAIL: 'asistente@example.com' })).status).toBe(200);
  });
});

describe('historia clínica', () => {
  it('cada guardado crea una versión nueva y conserva las anteriores', async () => {
    const patientId = await createPatient();
    const v1 = await call(`/patients/${patientId}/history`, { method: 'POST', json: { data: { padecimientoActual: 'Olvidos' } } });
    expect(await v1.json()).toEqual({ version: 1 });
    await call(`/patients/${patientId}/history`, { method: 'POST', json: { data: { padecimientoActual: 'Olvidos y caídas', plan: 'Valoración' } } });
    const res = (await (await call(`/patients/${patientId}/history`)).json()) as { current: { version: number; data: Record<string, string> }; versions: unknown[] };
    expect(res.current.version).toBe(2);
    expect(res.current.data.plan).toBe('Valoración');
    expect(res.versions).toHaveLength(2);
    const old = (await (await call(`/patients/${patientId}/history/1`)).json()) as { data: Record<string, string> };
    expect(old.data.padecimientoActual).toBe('Olvidos');
  });
});

describe('archivos', () => {
  const upload = (patientId: string, file: File, category = 'laboratorio') => {
    const form = new FormData();
    form.set('file', file);
    form.set('category', category);
    form.set('studyDate', '2026-10-30');
    return call(`/patients/${patientId}/files`, { method: 'POST', body: form });
  };

  it('rechaza tipos de archivo no permitidos', async () => {
    const patientId = await createPatient();
    const res = await upload(patientId, new File(['<script>alert(1)</script>'], 'x.html', { type: 'text/html' }));
    expect(res.status).toBe(415);
  });

  it('guarda un PDF en R2 privado y lo entrega sin caché', async () => {
    const patientId = await createPatient();
    const res = await upload(patientId, new File(['%PDF-1.4 prueba'], 'Biometría.pdf', { type: 'application/pdf' }));
    expect(res.status).toBe(201);
    const file = (await res.json()) as FileItem;
    expect(file).toMatchObject({ filename: 'Biometría.pdf', category: 'laboratorio', studyDate: '2026-10-30' });

    const content = await call(`/files/${file.id}/content?download=1`);
    expect(content.status).toBe(200);
    expect(content.headers.get('cache-control')).toBe('private, no-store');
    expect(content.headers.get('content-disposition')).toContain('attachment');
    expect(await content.text()).toBe('%PDF-1.4 prueba');

    const stored = await env.FILES.get(`patients/${patientId}/${file.id}`);
    expect(stored).not.toBeNull();
  });
});

describe('bitácora de auditoría', () => {
  it('registra la consulta del expediente y no se puede borrar', async () => {
    const patientId = await createPatient();
    await call(`/patients/${patientId}`);
    const rows = await env.DB.prepare('SELECT action FROM audit_log WHERE patient_id = ?').bind(patientId).all<{ action: string }>();
    expect(rows.results.map((r) => r.action)).toEqual(expect.arrayContaining(['create', 'view']));
    await expect(env.DB.prepare('DELETE FROM audit_log WHERE patient_id = ?').bind(patientId).run()).rejects.toThrow(/append-only/);
  });
});
