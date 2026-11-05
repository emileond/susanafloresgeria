import { TIME_ZONE } from './constants';

/** Edad cumplida en años a partir de una fecha AAAA-MM-DD. */
export function ageFromBirthDate(birthDate: string, today: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(today)
    .split('-')
    .map(Number) as [number, number, number];
  const [ty, tm, td] = parts;
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age;
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria del consultorio. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Normaliza texto para búsqueda: minúsculas y sin acentos. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDate(value: string | number | Date, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, ...opts }).format(date);
}

export function formatDateTime(value: string | number | Date): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
