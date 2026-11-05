import { band, sumAnswers, type ScaleDefinition, type ScaleItem, type Band } from './types';

const FREQ = [
  { value: 1, label: 'Nunca' },
  { value: 2, label: 'Rara vez' },
  { value: 3, label: 'Algunas veces' },
  { value: 4, label: 'Bastantes veces' },
  { value: 5, label: 'Casi siempre' },
];

const QUESTIONS = [
  '¿Piensa que su familiar le pide más ayuda de la que realmente necesita?',
  '¿Piensa que por el tiempo que dedica a su familiar no tiene suficiente tiempo para usted?',
  '¿Se siente agobiado(a) por intentar compatibilizar el cuidado de su familiar con otras responsabilidades (trabajo, familia)?',
  '¿Siente vergüenza por la conducta de su familiar?',
  '¿Se siente enfadado(a) cuando está cerca de su familiar?',
  '¿Piensa que cuidar a su familiar afecta negativamente su relación con otros miembros de su familia?',
  '¿Tiene miedo por el futuro de su familiar?',
  '¿Piensa que su familiar depende de usted?',
  '¿Se siente tenso(a) cuando está cerca de su familiar?',
  '¿Piensa que su salud ha empeorado por tener que cuidar a su familiar?',
  '¿Piensa que no tiene tanta intimidad como le gustaría por tener que cuidar a su familiar?',
  '¿Piensa que su vida social se ha visto afectada negativamente por tener que cuidar a su familiar?',
  '¿Se siente incómodo(a) por distanciarse de sus amistades por tener que cuidar a su familiar?',
  '¿Piensa que su familiar le considera la única persona que le puede cuidar?',
  '¿Piensa que no tiene suficientes ingresos para los gastos de cuidar a su familiar, además de sus otros gastos?',
  '¿Piensa que no será capaz de cuidar a su familiar por mucho más tiempo?',
  '¿Siente que ha perdido el control de su vida desde que comenzó la enfermedad de su familiar?',
  '¿Desearía poder dejar el cuidado de su familiar a otra persona?',
  '¿Se siente indeciso(a) sobre qué hacer con su familiar?',
  '¿Piensa que debería hacer más por su familiar?',
  '¿Piensa que podría cuidar mejor a su familiar?',
  'Globalmente, ¿con qué frecuencia siente que cuidar a su familiar es una carga?',
];

const items: ScaleItem[] = QUESTIONS.map((text, i) => ({ id: `z${i + 1}`, text, options: FREQ }));

const BANDS: Band[] = [
  { min: 56, interpretation: 'Sobrecarga intensa del cuidador', severity: 'severe' },
  { min: 47, interpretation: 'Sobrecarga leve del cuidador', severity: 'moderate' },
  { min: 0, interpretation: 'Sin sobrecarga', severity: 'normal' },
];

export const zarit: ScaleDefinition = {
  key: 'zarit',
  version: 1,
  name: 'Escala de sobrecarga del cuidador de Zarit',
  shortName: 'Zarit',
  description: 'Sobrecarga del cuidador principal en 22 preguntas (22–110). La responde el cuidador.',
  domain: 'Cuidador',
  respondent: 'cuidador',
  minutes: 10,
  higherIsBetter: false,
  bands: BANDS,
  reference: 'Zarit SH, et al. Gerontologist. 1980;20:649-55. Versión en español y puntos de corte: Martín M, et al. Rev Gerontol. 1996;6:338-46.',
  licensed: true,
  notice: 'La Zarit Burden Interview tiene derechos de autor (Mapi Research Trust). Confirme la licencia antes de habilitarla.',
  items,
  score(answers) {
    const score = sumAnswers(answers, items);
    const b = band(score, BANDS);
    return { score, maxScore: 110, interpretation: b.interpretation, severity: b.severity };
  },
};
