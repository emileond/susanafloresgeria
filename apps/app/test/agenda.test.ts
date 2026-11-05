import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AppointmentItem, Dashboard } from '../src/shared/types';
import { parseDuration, parseIcs } from '../src/worker/calendar/ics';
import { extractDoctoraliaUrl, syncDoctoralia } from '../src/worker/calendar/sync';
import * as schema from '../src/worker/db/schema';
import { backupDatabase } from '../src/worker/jobs/backup';
import { call, createPatient, seedUser } from './helpers';

const db = drizzle(env.DB, { schema });

beforeAll(async () => {
  await seedUser();
});

const ics = (events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prueba//ES', ...events, 'END:VCALENDAR'].join('\r\n');
const vevent = (fields: Record<string, string>) => ['BEGIN:VEVENT', ...Object.entries(fields).map(([k, v]) => `${k}${k.includes(';') ? '' : ':'}${v}`), 'END:VEVENT'].join('\r\n');

describe('lector iCal', () => {
  it('convierte horas locales de Ciudad de México a UTC y respeta Z, día completo y duración', () => {
    const text = ics([
      vevent({ UID: 'a@x', 'DTSTART;TZID=America/Mexico_City': ':20261110T100000', 'DTEND;TZID=America/Mexico_City': ':20261110T103000', SUMMARY: 'Consulta' }),
      vevent({ UID: 'b@x', DTSTART: '20261110T170000Z', DURATION: 'PT45M', SUMMARY: 'Con Z' }),
      vevent({ UID: 'c@x', 'DTSTART;VALUE=DATE': ':20261111', SUMMARY: 'Día completo' }),
    ]);
    const [a, b, c] = parseIcs(text);
    expect(a!.start.toISOString()).toBe('2026-11-10T16:00:00.000Z');
    expect(a!.end.toISOString()).toBe('2026-11-10T16:30:00.000Z');
    expect(b!.end.toISOString()).toBe('2026-11-10T17:45:00.000Z');
    expect(c!.allDay).toBe(true);
  });

  it('une líneas dobladas, decodifica texto, detecta cancelaciones e ignora alarmas', () => {
    const text = ics([
      ['BEGIN:VEVENT', 'UID:d@x', 'DTSTART:20261112T150000Z', 'SUMMARY:Ana Ejemplo \\, consulta', 'DESCRIPTION:Línea uno\\nver https://www.doctoralia.com.mx/', ' citas/123 ok', 'STATUS:CANCELLED', 'BEGIN:VALARM', 'SUMMARY:Recordatorio', 'END:VALARM', 'END:VEVENT'].join('\r\n'),
    ]);
    const [ev] = parseIcs(text);
    expect(ev!.summary).toBe('Ana Ejemplo , consulta');
    expect(ev!.description).toContain('Línea uno\nver');
    expect(ev!.cancelled).toBe(true);
    expect(extractDoctoraliaUrl(ev!)).toBe('https://www.doctoralia.com.mx/citas/123');
  });

  it('interpreta duraciones ISO', () => {
    expect(parseDuration('PT1H30M')).toBe(90 * 60_000);
    expect(parseDuration('P1D')).toBe(24 * 3600_000);
  });
});

describe('sincronización con Doctoralia', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  const feed = (events: string[]) => (async () => new Response(ics(events), { headers: { 'content-type': 'text/calendar' } })) as unknown as typeof fetch;
  const cfg = { DOCTORALIA_ICS_URL: 'https://calendar.example.com/secreto.ics', DOCTORALIA_CALENDAR_URL: 'https://www.doctoralia.com.mx' };

  it('no hace nada si no está configurada', async () => {
    const r = await syncDoctoralia({ DOCTORALIA_ICS_URL: '', DOCTORALIA_CALENDAR_URL: '' }, db, { now });
    expect(r.status).toBe('skipped');
  });

  it('agrega, actualiza, vincula pacientes y cancela citas que desaparecen', async () => {
    const patientId = await createPatient('Leonor Sincronía Ramírez');
    const e1 = vevent({ UID: 's1@doc', DTSTART: '20261110T160000Z', DTEND: '20261110T163000Z', SUMMARY: 'Leonor Sincronía Ramírez - Consulta' });
    const e2 = vevent({ UID: 's2@doc', DTSTART: '20261111T160000Z', DTEND: '20261111T163000Z', SUMMARY: 'Videoconsulta: otra persona' });

    const first = await syncDoctoralia(cfg, db, { now, fetcher: feed([e1, e2]) });
    expect(first).toMatchObject({ status: 'ok', added: 2, cancelled: 0 });
    const list = (await (await call('/appointments?from=2026-11-09T00:00:00Z&to=2026-11-12T00:00:00Z')).json()) as AppointmentItem[];
    const a1 = list.find((a) => a.title?.startsWith('Leonor'))!;
    const a2 = list.find((a) => a.title?.startsWith('Videoconsulta'))!;
    expect(a1).toMatchObject({ source: 'doctoralia', patientId, externalUrl: 'https://www.doctoralia.com.mx' });
    expect(a2.modality).toBe('en_linea');

    // e1 cambia de hora; e2 desaparece del calendario.
    const moved = vevent({ UID: 's1@doc', DTSTART: '20261110T170000Z', DTEND: '20261110T173000Z', SUMMARY: 'Leonor Sincronía Ramírez - Consulta' });
    const second = await syncDoctoralia(cfg, db, { now, fetcher: feed([moved]) });
    expect(second).toMatchObject({ added: 0, updated: 1, cancelled: 1 });

    const status = (await (await call('/appointments/sync-status', {}, cfg)).json()) as { configured: boolean; lastRun: { status: string; cancelled: number } };
    expect(status).toMatchObject({ configured: true, lastRun: { status: 'ok', cancelled: 1 } });
  });

  it('registra el error sin exponer la dirección secreta', async () => {
    const failing = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const r = await syncDoctoralia(cfg, db, { now, fetcher: failing });
    expect(r.status).toBe('error');
    expect(r.message).not.toContain('secreto');
  });
});

describe('agenda (API)', () => {
  it('crea, lista, mueve y elimina citas directas', async () => {
    const patientId = await createPatient();
    const created = await call('/appointments', {
      method: 'POST',
      json: { patientId, startsAt: '2026-11-20T16:00:00.000Z', endsAt: '2026-11-20T16:45:00.000Z', modality: 'domicilio' },
    });
    expect(created.status).toBe(201);
    const appt = (await created.json()) as AppointmentItem;
    expect(appt).toMatchObject({ source: 'direct', patientName: 'José Pérez Núñez', modality: 'domicilio' });

    const moved = await call(`/appointments/${appt.id}`, { method: 'PATCH', json: { startsAt: '2026-11-21T16:00:00.000Z', endsAt: '2026-11-21T17:00:00.000Z' } });
    expect(((await moved.json()) as AppointmentItem).startsAt).toBe('2026-11-21T16:00:00.000Z');

    const range = (await (await call('/appointments?from=2026-11-21T00:00:00.000Z&to=2026-11-22T00:00:00.000Z')).json()) as AppointmentItem[];
    expect(range.map((a) => a.id)).toContain(appt.id);

    expect((await call(`/appointments/${appt.id}`, { method: 'DELETE' })).status).toBe(200);
  });

  it('valida horarios y exige paciente o título', async () => {
    const bad = await call('/appointments', { method: 'POST', json: { startsAt: '2026-11-20T17:00:00.000Z', endsAt: '2026-11-20T16:00:00.000Z' } });
    expect(bad.status).toBe(422);
  });

  it('las citas de Doctoralia no se mueven ni se borran, pero se pueden vincular y marcar', async () => {
    const patientId = await createPatient();
    await syncDoctoralia(
      { DOCTORALIA_ICS_URL: 'https://calendar.example.com/x.ics', DOCTORALIA_CALENDAR_URL: '' },
      db,
      { now: new Date('2026-11-05T12:00:00Z'), fetcher: (async () => new Response(ics([vevent({ UID: 'ro@doc', DTSTART: '20261125T160000Z', DTEND: '20261125T163000Z', SUMMARY: 'Cita sin nombre' })]))) as unknown as typeof fetch },
    );
    const [appt] = (await (await call('/appointments?from=2026-11-25T00:00:00.000Z&to=2026-11-26T00:00:00.000Z')).json()) as AppointmentItem[];
    expect(appt!.source).toBe('doctoralia');
    expect((await call(`/appointments/${appt!.id}`, { method: 'PATCH', json: { startsAt: '2026-11-25T18:00:00.000Z' } })).status).toBe(409);
    expect((await call(`/appointments/${appt!.id}`, { method: 'DELETE' })).status).toBe(409);
    const linked = await call(`/appointments/${appt!.id}`, { method: 'PATCH', json: { patientId, status: 'done' } });
    expect(await linked.json()).toMatchObject({ patientId, status: 'done' });
  });

  it('un asistente puede manejar la agenda', async () => {
    await seedUser('asistente-agenda@example.com', 'assistant');
    const res = await call('/appointments', { method: 'POST', json: { title: 'Bloqueo: congreso', startsAt: '2026-12-01T15:00:00.000Z', endsAt: '2026-12-01T23:00:00.000Z' } }, { DEV_USER_EMAIL: 'asistente-agenda@example.com' });
    expect(res.status).toBe(201);
  });

  it('el inicio muestra las citas de hoy', async () => {
    const start = new Date(Date.now() + 60 * 60_000);
    await call('/appointments', { method: 'POST', json: { title: 'Cita de hoy', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60_000).toISOString() } });
    const dash = (await (await call('/dashboard')).json()) as Dashboard;
    expect(Array.isArray(dash.todayAppointments)).toBe(true);
  });
});

describe('respaldo', () => {
  it('guarda cada tabla comprimida y un manifiesto en R2', async () => {
    await createPatient('Paciente Respaldo');
    const r = await backupDatabase(env, new Date('2026-11-05T09:00:00Z'));
    expect(r.prefix).toBe('d1/2026-11-05/');
    expect(r.tables.patients).toBeGreaterThan(0);
    const manifest = await env.BACKUPS.get('d1/2026-11-05/manifest.json');
    expect(await manifest!.json()).toMatchObject({ version: 1 });
    const obj = await env.BACKUPS.get('d1/2026-11-05/patients.json.gz');
    const rows = JSON.parse(await new Response(obj!.body.pipeThrough(new DecompressionStream('gzip'))).text()) as { full_name: string }[];
    expect(rows.some((p) => p.full_name === 'Paciente Respaldo')).toBe(true);
  });

  it('elimina respaldos con más de 35 días', async () => {
    await env.BACKUPS.put('d1/2026-01-01/patients.json.gz', 'viejo');
    const r = await backupDatabase(env, new Date('2026-11-05T09:00:00Z'));
    expect(r.deletedOld).toBeGreaterThanOrEqual(1);
    expect(await env.BACKUPS.get('d1/2026-01-01/patients.json.gz')).toBeNull();
  });
});
