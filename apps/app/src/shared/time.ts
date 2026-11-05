import { TIME_ZONE } from './constants';

/** Utilidades de fecha y hora en la zona del consultorio (America/Mexico_City), sin dependencias. */

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en el instante dado. */
export function tzOffsetMs(instant: number, timeZone: string = TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - instant;
}

/** Convierte una hora "de reloj" en una zona horaria a un instante UTC. */
export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string = TIME_ZONE): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let ts = guess - tzOffsetMs(guess, timeZone);
  ts = guess - tzOffsetMs(ts, timeZone);
  return new Date(ts);
}

export interface ZonedParts {
  dateKey: string; // AAAA-MM-DD
  hour: number;
  minute: number;
  weekday: number; // 0 = lunes … 6 = domingo
}

export function zonedParts(date: Date | string, timeZone: string = TIME_ZONE): ZonedParts {
  const d = typeof date === 'string' ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return { dateKey: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), minute: Number(get('minute')), weekday: weekdays.indexOf(get('weekday')) };
}

/** Instante en que empieza el día (00:00) de una fecha AAAA-MM-DD en la zona del consultorio. */
export function startOfDayKey(dateKey: string, timeZone: string = TIME_ZONE): Date {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone);
}

export function atTime(dateKey: string, hour: number, minute: number, timeZone: string = TIME_ZONE): Date {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return zonedTimeToUtc(y, m, d, hour, minute, 0, timeZone);
}

export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Lunes de la semana de la fecha dada. */
export function weekStartKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDaysKey(dateKey, -dow);
}

export const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
