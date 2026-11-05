import { band, sumAnswers, yesNo, type ScaleDefinition, type ScaleItem, type Band } from './types';

const items: ScaleItem[] = [
  { id: 'fatiga', text: 'Fatiga: ¿se ha sentido cansado(a) todo o la mayor parte del tiempo en las últimas 4 semanas?', options: yesNo(1) },
  { id: 'resistencia', text: 'Resistencia: ¿tiene dificultad para subir 10 escalones sin descansar y sin ayuda?', options: yesNo(1) },
  { id: 'deambulacion', text: 'Deambulación: ¿tiene dificultad para caminar unos 100 metros (una cuadra) sin descansar y sin ayuda?', options: yesNo(1) },
  {
    id: 'enfermedades',
    text: 'Enfermedades: ¿tiene 5 o más de las siguientes?',
    help: 'Hipertensión, diabetes, cáncer (excepto cáncer de piel menor), enfermedad pulmonar crónica, infarto, insuficiencia cardiaca, angina, asma, artritis, evento vascular cerebral, enfermedad renal.',
    options: yesNo(1),
  },
  { id: 'peso', text: 'Pérdida de peso: ¿ha perdido más del 5 % de su peso en el último año?', options: yesNo(1) },
];

const BANDS: Band[] = [
  { min: 3, interpretation: 'Frágil', severity: 'severe' },
  { min: 1, interpretation: 'Prefrágil', severity: 'mild' },
  { min: 0, interpretation: 'Robusto', severity: 'normal' },
];

export const frail: ScaleDefinition = {
  key: 'frail',
  version: 1,
  name: 'Escala FRAIL',
  shortName: 'FRAIL',
  description: 'Tamizaje rápido de fragilidad: fatiga, resistencia, deambulación, enfermedades y pérdida de peso (0–5).',
  domain: 'Fragilidad y sarcopenia',
  respondent: 'paciente',
  minutes: 2,
  higherIsBetter: false,
  bands: BANDS,
  reference: 'Morley JE, Malmstrom TK, Miller DK. J Nutr Health Aging. 2012;16:601-8.',
  items,
  score(answers) {
    const score = sumAnswers(answers, items);
    const b = band(score, BANDS);
    return { score, maxScore: 5, interpretation: b.interpretation, severity: b.severity };
  },
};
