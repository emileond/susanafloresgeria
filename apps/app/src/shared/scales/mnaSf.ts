import { band, sumAnswers, type ScaleDefinition, type ScaleItem, type Band } from './types';

const items: ScaleItem[] = [
  { id: 'a', text: 'A. ¿Ha comido menos en los últimos 3 meses por falta de apetito, problemas digestivos o dificultad para masticar o tragar?', options: [{ value: 0, label: 'Disminución severa de la ingesta' }, { value: 1, label: 'Disminución moderada' }, { value: 2, label: 'Sin disminución' }] },
  { id: 'b', text: 'B. Pérdida de peso en los últimos 3 meses', options: [{ value: 0, label: 'Más de 3 kg' }, { value: 1, label: 'No lo sabe' }, { value: 2, label: 'Entre 1 y 3 kg' }, { value: 3, label: 'Sin pérdida de peso' }] },
  { id: 'c', text: 'C. Movilidad', options: [{ value: 0, label: 'De la cama al sillón' }, { value: 1, label: 'Autonomía dentro de casa' }, { value: 2, label: 'Sale del domicilio' }] },
  { id: 'd', text: 'D. ¿Ha tenido una enfermedad aguda o estrés psicológico en los últimos 3 meses?', options: [{ value: 0, label: 'Sí' }, { value: 2, label: 'No' }] },
  { id: 'e', text: 'E. Problemas neuropsicológicos', options: [{ value: 0, label: 'Demencia o depresión grave' }, { value: 1, label: 'Demencia leve' }, { value: 2, label: 'Sin problemas psicológicos' }] },
  {
    id: 'f',
    text: 'F. Índice de masa corporal (o circunferencia de pantorrilla si no se puede medir el IMC)',
    options: [
      { value: 0, label: 'IMC menor de 19' },
      { value: 1, label: 'IMC de 19 a menos de 21' },
      { value: 2, label: 'IMC de 21 a menos de 23' },
      { value: 3, label: 'IMC de 23 o más' },
      { value: 0, label: 'Sin IMC: pantorrilla menor de 31 cm' },
      { value: 3, label: 'Sin IMC: pantorrilla de 31 cm o más' },
    ],
  },
];

const BANDS: Band[] = [
  { min: 12, interpretation: 'Estado nutricional normal', severity: 'normal' },
  { min: 8, interpretation: 'Riesgo de malnutrición', severity: 'moderate' },
  { min: 0, interpretation: 'Malnutrición', severity: 'severe' },
];

export const mnaSf: ScaleDefinition = {
  key: 'mna-sf',
  version: 1,
  name: 'Mini Nutritional Assessment, forma corta (MNA-SF)',
  shortName: 'MNA-SF',
  description: 'Tamizaje del estado nutricional en 6 preguntas (0–14).',
  domain: 'Nutrición',
  respondent: 'paciente',
  minutes: 4,
  higherIsBetter: true,
  bands: BANDS,
  reference: 'Kaiser MJ, et al. J Nutr Health Aging. 2009;13:782-8. © Société des Produits Nestlé SA.',
  licensed: true,
  notice: 'MNA® es marca registrada de Société des Produits Nestlé S.A. Confirme las condiciones de uso antes de habilitarla.',
  items,
  score(answers) {
    const score = sumAnswers(answers, items);
    const b = band(score, BANDS);
    return { score, maxScore: 14, interpretation: b.interpretation, severity: b.severity };
  },
};
