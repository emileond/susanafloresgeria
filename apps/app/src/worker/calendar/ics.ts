import { TIME_ZONE } from '../../shared/constants';
import { zonedTimeToUtc } from '../../shared/time';

/**
 * Lector mínimo de iCalendar (RFC 5545) para la sincronización con el calendario de Doctoralia
 * (vía la dirección privada iCal de Google Calendar). Solo lee VEVENT con los campos necesarios.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  url: string;
  start: Date;
  end: Date;
  allDay: boolean;
  cancelled: boolean;
  recurring: boolean;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Une las líneas "dobladas" (las que continúan con espacio o tabulador al inicio). */
export const unfold = (text: string) => text.replace(/\r?\n[ \t]/g, '');

function parseProp(line: string): Prop | null {
  // El primer ":" fuera de comillas separa nombre/parámetros del valor.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [rawName, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: (rawName ?? '').toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

export { zonedTimeToUtc } from '../../shared/time';

function validTimeZone(tz: string | undefined): string {
  if (!tz) return TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return TIME_ZONE;
  }
}

function parseDateProp(p: Prop): { date: Date; allDay: boolean } | null {
  const v = p.value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || p.params.VALUE === 'DATE') {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    return { date: zonedTimeToUtc(+m[1]!, +m[2]!, +m[3]!, 0, 0, 0, validTimeZone(p.params.TZID)), allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00', z] = m;
  if (z) return { date: new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s)), allDay: false };
  return { date: zonedTimeToUtc(+y!, +mo!, +d!, +h!, +mi!, +s, validTimeZone(p.params.TZID)), allDay: false };
}

/** Duración ISO 8601 (p. ej. PT30M, PT1H, P1D) en milisegundos. */
export function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, sign, w = '0', d = '0', h = '0', mi = '0', s = '0'] = m;
  const ms = (((+w * 7 + +d) * 24 + +h) * 60 + +mi) * 60_000 + +s * 1000;
  return sign === '-' ? -ms : ms;
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text).split(/\r?\n/);
  const events: IcsEvent[] = [];
  let current: Prop[] | null = null;
  let depth = 0; // Ignora componentes anidados como VALARM.

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = [];
      depth = 0;
      continue;
    }
    if (!current) continue;
    if (line.startsWith('BEGIN:')) {
      depth++;
      continue;
    }
    if (line.startsWith('END:') && line !== 'END:VEVENT') {
      depth--;
      continue;
    }
    if (line === 'END:VEVENT') {
      const ev = toEvent(current);
      if (ev) events.push(ev);
      current = null;
      continue;
    }
    if (depth > 0) continue;
    const prop = parseProp(line);
    if (prop) current.push(prop);
  }
  return events;
}

function toEvent(props: Prop[]): IcsEvent | null {
  const get = (name: string) => props.find((p) => p.name === name);
  const uid = get('UID')?.value.trim();
  const startProp = get('DTSTART');
  if (!uid || !startProp) return null;
  const start = parseDateProp(startProp);
  if (!start) return null;

  let end: Date;
  const endProp = get('DTEND');
  const parsedEnd = endProp ? parseDateProp(endProp) : null;
  const duration = get('DURATION') ? parseDuration(get('DURATION')!.value) : null;
  if (parsedEnd) end = parsedEnd.date;
  else if (duration !== null) end = new Date(start.date.getTime() + duration);
  else end = new Date(start.date.getTime() + (start.allDay ? 24 * 3600_000 : 30 * 60_000));

  return {
    uid,
    summary: unescapeText(get('SUMMARY')?.value ?? '').trim(),
    description: unescapeText(get('DESCRIPTION')?.value ?? '').trim(),
    location: unescapeText(get('LOCATION')?.value ?? '').trim(),
    url: (get('URL')?.value ?? '').trim(),
    start: start.date,
    end,
    allDay: start.allDay,
    cancelled: (get('STATUS')?.value ?? '').trim().toUpperCase() === 'CANCELLED',
    recurring: Boolean(get('RRULE')),
  };
}
