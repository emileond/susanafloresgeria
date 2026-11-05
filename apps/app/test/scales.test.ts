import { describe, expect, it } from 'vitest';
import { enabledScales, maxOf, minOf, missingAnswers, scaleRanges, SCALES, SCALES_BY_KEY, type Answers, type ScaleDefinition } from '../src/shared/scales';

/** Respuestas eligiendo, en cada ítem, la opción con más (o menos) puntos. */
function extreme(scale: ScaleDefinition, pick: 'max' | 'min'): Answers {
  return Object.fromEntries(
    scale.items.map((item) => {
      const values = item.options.map((o) => o.value);
      const target = pick === 'max' ? Math.max(...values) : Math.min(...values);
      return [item.id, values.indexOf(target)];
    }),
  );
}
/** Elige en cada ítem la primera opción que valga `value`. */
const byValue = (scale: ScaleDefinition, values: Record<string, number>): Answers =>
  Object.fromEntries(scale.items.map((i) => [i.id, i.options.findIndex((o) => o.value === (values[i.id] ?? Math.min(...i.options.map((x) => x.value))))]));

describe('catálogo de escalas', () => {
  it('tiene ids de ítems únicos y opciones en cada ítem', () => {
    for (const s of SCALES) {
      const ids = s.items.map((i) => i.id);
      expect(new Set(ids).size, s.key).toBe(ids.length);
      for (const i of s.items) expect(i.options.length, `${s.key}.${i.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('el puntaje máximo coincide con el declarado', () => {
    for (const s of SCALES) {
      const r = s.score(extreme(s, 'max'));
      expect(r.score, s.key).toBe(r.maxScore);
    }
  });

  it('los rangos de interpretación cubren todo el puntaje sin huecos ni traslapes', () => {
    for (const s of SCALES) {
      const ranges = scaleRanges(s);
      expect(ranges[0]!.from, s.key).toBe(minOf(s.items));
      expect(ranges.at(-1)!.to, s.key).toBe(maxOf(s.items));
      for (let i = 1; i < ranges.length; i++) expect(ranges[i]!.from, s.key).toBe(ranges[i - 1]!.to + 1);
    }
  });

  it('la interpretación coincide con el rango del puntaje (excepto la letra de Katz)', () => {
    for (const s of SCALES.filter((x) => x.key !== 'katz')) {
      for (const pick of ['min', 'max'] as const) {
        const r = s.score(extreme(s, pick));
        const range = scaleRanges(s).find((x) => r.score >= x.from && r.score <= x.to)!;
        expect(r.interpretation, `${s.key} ${pick}`).toBe(range.interpretation);
      }
    }
  });

  it('oculta las escalas con licencia salvo que se habiliten', () => {
    expect(enabledScales('').map((s) => s.key)).not.toContain('zarit');
    expect(enabledScales('zarit').map((s) => s.key)).toContain('zarit');
    expect(enabledScales('zarit').map((s) => s.key)).not.toContain('mna-sf');
  });

  it('detecta respuestas faltantes o fuera de rango', () => {
    const s = SCALES_BY_KEY.frail!;
    expect(missingAnswers(s.items, { fatiga: 0 })).toHaveLength(4);
    expect(missingAnswers(s.items, { fatiga: 0, resistencia: 0, deambulacion: 0, enfermedades: 0, peso: 7 })).toEqual(['peso']);
  });
});

describe('Katz', () => {
  const s = SCALES_BY_KEY.katz!;
  const deps = (...ids: string[]) => byValue(s, Object.fromEntries(s.items.map((i) => [i.id, ids.includes(i.id) ? 0 : 1])));
  const letter = (a: Answers) => s.score(a).details?.[0]?.value;
  it('clasifica con la letra correcta', () => {
    expect(letter(deps())).toBe('A');
    expect(letter(deps('alimentacion'))).toBe('B');
    expect(letter(deps('bano', 'continencia'))).toBe('C');
    expect(letter(deps('bano', 'vestido', 'alimentacion'))).toBe('D');
    expect(letter(deps('bano', 'vestido', 'retrete', 'continencia'))).toBe('E');
    expect(letter(deps('bano', 'vestido', 'retrete', 'movilidad', 'alimentacion'))).toBe('F');
    expect(letter(deps('bano', 'vestido', 'retrete', 'movilidad', 'continencia', 'alimentacion'))).toBe('G');
    expect(letter(deps('vestido', 'continencia'))).toBe('Otro');
  });
  it('cuenta actividades independientes', () => {
    expect(s.score(deps('bano', 'continencia')).score).toBe(4);
  });
});

describe('Barthel', () => {
  const s = SCALES_BY_KEY.barthel!;
  it('interpreta los puntos de corte', () => {
    expect(s.score(extreme(s, 'max'))).toMatchObject({ score: 100, interpretation: 'Independiente' });
    expect(s.score(extreme(s, 'min'))).toMatchObject({ score: 0, interpretation: 'Dependencia total' });
    // 100 - 5 (lavarse) - 5 (escaleras) = 90 → moderada
    const a = byValue(s, { comer: 10, lavarse: 0, vestirse: 10, arreglarse: 5, deposiciones: 10, miccion: 10, retrete: 10, trasladarse: 15, deambular: 15, escaleras: 5 });
    expect(s.score(a)).toMatchObject({ score: 90, interpretation: 'Dependencia moderada' });
  });
});

describe('Lawton-Brody', () => {
  const s = SCALES_BY_KEY.lawton!;
  it('suma por índice de opción aunque varias opciones valgan lo mismo', () => {
    // Opción 2 de teléfono (vale 1), opción 1 de compras (vale 0)...
    const a: Answers = { telefono: 2, compras: 1, comida: 0, casa: 3, ropa: 2, transporte: 4, medicacion: 0, dinero: 1 };
    expect(s.score(a)).toMatchObject({ score: 5, interpretation: 'Dependencia moderada' });
  });
});

describe('GDS-15', () => {
  const s = SCALES_BY_KEY.gds15!;
  it('puntúa las preguntas invertidas', () => {
    // Todas "Sí": puntúan las 10 directas; las 5 invertidas (1,5,7,11,13) no.
    const allYes = Object.fromEntries(s.items.map((i) => [i.id, 0]));
    expect(s.score(allYes)).toMatchObject({ score: 10, interpretation: 'Síntomas depresivos moderados' });
    expect(s.score(extreme(s, 'min'))).toMatchObject({ score: 0, interpretation: 'Normal' });
  });
  it('5 puntos sugieren depresión', () => {
    const a = byValue(s, { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1 });
    expect(s.score(a)).toMatchObject({ score: 5, severity: 'mild' });
  });
});

describe('FRAIL, SARC-F, Tinetti, MNA-SF y Zarit', () => {
  it('FRAIL', () => {
    const s = SCALES_BY_KEY.frail!;
    expect(s.score(byValue(s, {})).interpretation).toBe('Robusto');
    expect(s.score(byValue(s, { fatiga: 1, peso: 1 })).interpretation).toBe('Prefrágil');
    expect(s.score(byValue(s, { fatiga: 1, peso: 1, resistencia: 1 })).interpretation).toBe('Frágil');
  });
  it('SARC-F: positivo desde 4', () => {
    const s = SCALES_BY_KEY.sarcf!;
    expect(s.score(byValue(s, { fuerza: 2, caidas: 1 })).severity).toBe('normal');
    expect(s.score(byValue(s, { fuerza: 2, caidas: 2 })).interpretation).toMatch(/positivo/);
  });
  it('Tinetti: subpuntuaciones de 16 y 12', () => {
    const s = SCALES_BY_KEY.tinetti!;
    const r = s.score(extreme(s, 'max'));
    expect(r.score).toBe(28);
    expect(r.details).toEqual([
      { label: 'Equilibrio', value: '16/16' },
      { label: 'Marcha', value: '12/12' },
    ]);
    expect(s.score(extreme(s, 'min')).interpretation).toBe('Riesgo alto de caídas');
  });
  it('MNA-SF y Zarit', () => {
    const mna = SCALES_BY_KEY['mna-sf']!;
    expect(mna.score(extreme(mna, 'max'))).toMatchObject({ score: 14, interpretation: 'Estado nutricional normal' });
    const z = SCALES_BY_KEY.zarit!;
    expect(z.score(extreme(z, 'min'))).toMatchObject({ score: 22, interpretation: 'Sin sobrecarga' });
  });
});
