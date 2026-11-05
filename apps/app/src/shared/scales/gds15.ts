import { band, sumAnswers, type ScaleDefinition, type ScaleItem, type ScaleOption } from './types';

/** "Sí" o "No" suma 1 punto según la dirección de cada pregunta. */
const q = (id: string, text: string, depressiveAnswer: 'si' | 'no'): ScaleItem => {
  const options: ScaleOption[] = [
    { value: depressiveAnswer === 'si' ? 1 : 0, label: 'Sí' },
    { value: depressiveAnswer === 'no' ? 1 : 0, label: 'No' },
  ];
  return { id, text, options };
};

const items: ScaleItem[] = [
  q('q1', '¿En general, está satisfecho(a) con su vida?', 'no'),
  q('q2', '¿Ha abandonado muchas de sus actividades e intereses?', 'si'),
  q('q3', '¿Siente que su vida está vacía?', 'si'),
  q('q4', '¿Se encuentra a menudo aburrido(a)?', 'si'),
  q('q5', '¿Está de buen humor la mayor parte del tiempo?', 'no'),
  q('q6', '¿Tiene miedo de que le pase algo malo?', 'si'),
  q('q7', '¿Se siente feliz la mayor parte del tiempo?', 'no'),
  q('q8', '¿Se siente a menudo desamparado(a) o indefenso(a)?', 'si'),
  q('q9', '¿Prefiere quedarse en casa en lugar de salir y hacer cosas nuevas?', 'si'),
  q('q10', '¿Cree que tiene más problemas de memoria que la mayoría de la gente?', 'si'),
  q('q11', '¿Piensa que es maravilloso estar vivo(a)?', 'no'),
  q('q12', '¿Se siente inútil o que no vale nada tal como está ahora?', 'si'),
  q('q13', '¿Se siente lleno(a) de energía?', 'no'),
  q('q14', '¿Siente que su situación no tiene esperanza?', 'si'),
  q('q15', '¿Cree que la mayoría de la gente está mejor que usted?', 'si'),
];

const BANDS = [
  { min: 12, interpretation: 'Síntomas depresivos severos', severity: 'severe' as const },
  { min: 9, interpretation: 'Síntomas depresivos moderados', severity: 'moderate' as const },
  { min: 5, interpretation: 'Síntomas depresivos leves (sugiere depresión)', severity: 'mild' as const },
  { min: 0, interpretation: 'Normal', severity: 'normal' as const },
];

export const gds15: ScaleDefinition = {
  key: 'gds15',
  version: 1,
  name: 'Escala de Depresión Geriátrica de Yesavage (GDS-15)',
  shortName: 'GDS-15',
  description: 'Tamizaje de síntomas depresivos en personas mayores; 15 preguntas de sí/no sobre la última semana.',
  domain: 'Ánimo',
  respondent: 'paciente',
  minutes: 7,
  higherIsBetter: false,
  reference: 'Sheikh JI, Yesavage JA. Clin Gerontol. 1986;5:165-73. Versión en español: Martínez de la Iglesia J, et al. Medifam. 2002;12:620-30.',
  notice: 'Pregunte por cómo se ha sentido durante la última semana. Es un tamizaje: un resultado alterado requiere valoración clínica.',
  items,
  score(answers) {
    const score = sumAnswers(answers, items);
    const b = band(score, BANDS);
    return { score, maxScore: 15, interpretation: b.interpretation, severity: b.severity };
  },
};
