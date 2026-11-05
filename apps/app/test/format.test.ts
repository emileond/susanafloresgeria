import { describe, expect, it } from 'vitest';
import { ageFromBirthDate, normalizeSearch } from '../src/shared/format';

describe('formato', () => {
  it('calcula la edad cumplida', () => {
    const today = new Date('2026-11-04T18:00:00Z');
    expect(ageFromBirthDate('1941-03-12', today)).toBe(85);
    expect(ageFromBirthDate('1941-11-05', today)).toBe(84);
    expect(ageFromBirthDate('1941-11-04', today)).toBe(85);
  });

  it('normaliza texto para búsqueda', () => {
    expect(normalizeSearch('  María  Ángeles NÚÑEZ ')).toBe('maria angeles nunez');
  });
});
