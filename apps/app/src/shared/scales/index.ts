import { barthel } from './barthel';
import { frail } from './frail';
import { gds15 } from './gds15';
import { katz } from './katz';
import { lawton } from './lawton';
import { mnaSf } from './mnaSf';
import { sarcf } from './sarcf';
import { tinetti } from './tinetti';
import type { ScaleDefinition } from './types';
import { zarit } from './zarit';

export * from './types';

/** Catálogo de escalas en el orden en que se muestran. */
export const SCALES: ScaleDefinition[] = [katz, barthel, lawton, gds15, frail, sarcf, tinetti, mnaSf, zarit];

export const SCALES_BY_KEY: Record<string, ScaleDefinition> = Object.fromEntries(SCALES.map((s) => [s.key, s]));

/**
 * Escalas disponibles. Las que requieren licencia (licensed) solo se habilitan
 * si su clave aparece en la variable LICENSED_SCALES (p. ej. "mna-sf,zarit").
 */
export function enabledScales(licensedEnabled: string | undefined): ScaleDefinition[] {
  const allowed = new Set((licensedEnabled ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  return SCALES.filter((s) => !s.licensed || allowed.has(s.key));
}
