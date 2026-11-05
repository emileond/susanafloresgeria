import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { normalizeSearch } from '../../shared/format';
import { appointments, patients, syncRuns, type Appointment } from '../db/schema';
import { newId } from '../lib/ids';
import type { DB } from '../types';
import { parseIcs, type IcsEvent } from './ics';

/**
 * Sincroniza las citas de Doctoralia desde una dirección iCal privada (secreto DOCTORALIA_ICS_URL),
 * p. ej. la del calendario de Google al que Doctoralia envía las citas. No se guarda ninguna contraseña.
 * - Crea o actualiza citas `doctoralia` por UID (solo lectura en la app).
 * - Marca como canceladas las citas futuras que desaparecen del calendario.
 * - Vincula al paciente solo si el nombre coincide con exactamente un paciente.
 */

const PAST_DAYS = 30;
const FUTURE_DAYS = 180;
const MAX_BYTES = 5 * 1024 * 1024;
const DAY = 24 * 3600_000;

export interface SyncResult {
  status: 'ok' | 'error' | 'skipped';
  added: number;
  updated: number;
  cancelled: number;
  message?: string;
}

/** Busca un enlace de Doctoralia en el evento (URL, descripción o ubicación). */
export function extractDoctoraliaUrl(ev: Pick<IcsEvent, 'url' | 'description' | 'location'>): string | null {
  for (const text of [ev.url, ev.description, ev.location]) {
    const m = /https:\/\/[^\s"<>]*doctoralia[^\s"<>]*/i.exec(text ?? '');
    if (m) return m[0].replace(/[).,;]+$/, '');
  }
  return null;
}

export function guessModality(ev: Pick<IcsEvent, 'summary' | 'description' | 'location'>): Appointment['modality'] {
  const text = normalizeSearch(`${ev.summary} ${ev.description} ${ev.location}`);
  if (/en linea|online|videoconsulta|telemedicina|videollamada/.test(text)) return 'en_linea';
  if (/domicilio/.test(text)) return 'domicilio';
  return 'consultorio';
}

async function fetchFeed(url: string, fetcher: typeof fetch): Promise<string> {
  const res = await fetcher(url, { headers: { accept: 'text/calendar' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`El calendario respondió con estado ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('El calendario es demasiado grande');
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('La dirección no devolvió un calendario iCal');
  return text;
}

export async function syncDoctoralia(env: Pick<Env, 'DOCTORALIA_ICS_URL' | 'DOCTORALIA_CALENDAR_URL'>, db: DB, opts: { now?: Date; fetcher?: typeof fetch } = {}): Promise<SyncResult> {
  const url = env.DOCTORALIA_ICS_URL?.trim();
  if (!url) return { status: 'skipped', added: 0, updated: 0, cancelled: 0, message: 'Sin calendario configurado' };
  const now = opts.now ?? new Date();
  const startedAt = new Date();
  const result: SyncResult = { status: 'ok', added: 0, updated: 0, cancelled: 0 };

  try {
    const text = await fetchFeed(url, opts.fetcher ?? fetch);
    const from = now.getTime() - PAST_DAYS * DAY;
    const to = now.getTime() + FUTURE_DAYS * DAY;
    // Solo citas con hora (los eventos de día completo suelen ser avisos o bloqueos del calendario).
    const events = parseIcs(text).filter((e) => !e.allDay && e.end.getTime() >= from && e.start.getTime() <= to);

    const [existing, activePatients] = await Promise.all([
      db.select().from(appointments).where(and(eq(appointments.source, 'doctoralia'), gte(appointments.endsAt, new Date(from)))),
      db.select({ id: patients.id, searchName: patients.searchName }).from(patients).where(isNull(patients.archivedAt)),
    ]);
    const byUid = new Map(existing.map((a) => [a.externalUid, a]));
    const feedUids = new Set(events.map((e) => e.uid));

    const matchPatient = (ev: IcsEvent): string | null => {
      const text = ` ${normalizeSearch(`${ev.summary} ${ev.description}`)} `;
      const hits = activePatients.filter((p) => p.searchName.length >= 6 && text.includes(` ${p.searchName} `));
      return hits.length === 1 ? hits[0]!.id : null;
    };

    const statements = [];
    for (const ev of events) {
      const current = byUid.get(ev.uid);
      const status: Appointment['status'] = ev.cancelled ? 'cancelled' : (current?.status ?? 'scheduled');
      const values = {
        title: ev.summary || 'Cita de Doctoralia',
        startsAt: ev.start,
        endsAt: ev.end,
        externalUrl: extractDoctoraliaUrl(ev) ?? (env.DOCTORALIA_CALENDAR_URL?.trim() || null),
        modality: guessModality(ev),
      };
      if (!current) {
        statements.push(
          db.insert(appointments).values({ id: newId(), source: 'doctoralia', externalUid: ev.uid, patientId: matchPatient(ev), status, ...values }),
        );
        result.added++;
      } else {
        const changed =
          current.title !== values.title ||
          current.startsAt.getTime() !== values.startsAt.getTime() ||
          current.endsAt.getTime() !== values.endsAt.getTime() ||
          current.externalUrl !== values.externalUrl ||
          current.status !== status;
        if (changed) {
          statements.push(
            db
              .update(appointments)
              .set({ ...values, status, patientId: current.patientId ?? matchPatient(ev), updatedAt: new Date() })
              .where(eq(appointments.id, current.id)),
          );
          result.updated++;
        }
      }
    }

    // Citas futuras que ya no están en el calendario: se cancelaron en Doctoralia.
    for (const a of existing) {
      if (a.externalUid && !feedUids.has(a.externalUid) && a.startsAt.getTime() > now.getTime() && a.status === 'scheduled') {
        statements.push(db.update(appointments).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(appointments.id, a.id)));
        result.cancelled++;
      }
    }

    for (let i = 0; i < statements.length; i += 50) {
      const chunk = statements.slice(i, i + 50);
      if (chunk.length) await db.batch(chunk as [(typeof chunk)[0], ...typeof chunk]);
    }
  } catch (err) {
    result.status = 'error';
    // Mensaje genérico: nunca se registra la dirección del calendario (es un secreto).
    result.message = err instanceof Error && !err.message.includes('http') ? err.message : 'No se pudo leer el calendario';
  }

  // Se conserva un mes de historial de sincronizaciones.
  await db.delete(syncRuns).where(and(eq(syncRuns.source, 'doctoralia'), lt(syncRuns.startedAt, new Date(now.getTime() - 30 * DAY))));
  await db.insert(syncRuns).values({
    id: newId(),
    source: 'doctoralia',
    startedAt,
    finishedAt: new Date(),
    status: result.status === 'error' ? 'error' : 'ok',
    added: result.added,
    updated: result.updated,
    cancelled: result.cancelled,
    message: result.message ?? null,
  });
  return result;
}
