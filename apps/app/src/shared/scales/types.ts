/**
 * Definición genérica de escalas geriátricas.
 * La puntuación se calcula SIEMPRE en el servidor con estas mismas funciones (no se confía en el cliente).
 */

export interface ScaleOption {
  value: number;
  label: string;
}

export interface ScaleItem {
  id: string;
  text: string;
  help?: string;
  /** Agrupa ítems en la pantalla (p. ej. "Equilibrio" y "Marcha" en Tinetti). */
  section?: string;
  options: ScaleOption[];
}

export type Severity = 'normal' | 'mild' | 'moderate' | 'severe';

export interface ScaleResult {
  score: number;
  maxScore: number;
  /** Texto corto de interpretación, p. ej. "Dependencia moderada". */
  interpretation: string;
  severity: Severity;
  /** Subpuntuaciones u otros datos útiles (p. ej. Katz letra C; Tinetti equilibrio 12/16). */
  details?: { label: string; value: string }[];
}

/** Respuestas: índice de la opción elegida por ítem (no el valor, porque varias opciones pueden valer lo mismo). */
export type Answers = Record<string, number>;

export interface ScaleDefinition {
  key: string;
  version: number;
  name: string;
  shortName: string;
  description: string;
  domain: 'Funcionalidad' | 'Ánimo' | 'Fragilidad y sarcopenia' | 'Marcha y caídas' | 'Nutrición' | 'Cuidador';
  /** Quién responde. */
  respondent: 'paciente' | 'cuidador' | 'observacion';
  minutes: number;
  /** "Mayor es mejor" (Barthel) o "mayor es peor" (GDS); sirve para mostrar tendencias. */
  higherIsBetter: boolean;
  items: ScaleItem[];
  score: (answers: Answers) => ScaleResult;
  reference: string;
  /** Requiere confirmar condiciones de uso/licencia antes de habilitarse. */
  licensed?: boolean;
  notice?: string;
}

/** Puntos de la opción elegida en un ítem. */
export const pointsOf = (item: ScaleItem, answers: Answers): number => item.options[answers[item.id] ?? -1]?.value ?? 0;
export const sumAnswers = (answers: Answers, items: ScaleItem[]) => items.reduce((acc, item) => acc + pointsOf(item, answers), 0);

/** Verifica que cada ítem tenga una opción válida. Devuelve los ids faltantes o inválidos. */
export function missingAnswers(items: ScaleItem[], answers: Answers): string[] {
  return items.filter((i) => {
    const idx = answers[i.id];
    return idx === undefined || !Number.isInteger(idx) || idx < 0 || idx >= i.options.length;
  }).map((i) => i.id);
}
export const maxOf = (items: ScaleItem[]) => items.reduce((acc, item) => acc + Math.max(...item.options.map((o) => o.value)), 0);

/** Devuelve el primer tramo cuyo mínimo se alcanza (los tramos van de mayor a menor). */
export function band<T extends { min: number }>(score: number, bands: T[]): T {
  return bands.find((b) => score >= b.min) ?? bands[bands.length - 1]!;
}

export const yesNo = (yesValue: number): ScaleOption[] => [
  { value: yesValue, label: 'Sí' },
  { value: yesValue === 1 ? 0 : 1, label: 'No' },
];
