import { sumAnswers, type ScaleDefinition, type ScaleItem } from './types';

const difficulty = (worst: string) => [
  { value: 0, label: 'Ninguna' },
  { value: 1, label: 'Alguna' },
  { value: 2, label: worst },
];

const items: ScaleItem[] = [
  { id: 'fuerza', text: 'Fuerza: ¿qué tanta dificultad tiene para levantar y cargar 4.5 kg (10 libras)?', options: difficulty('Mucha o incapaz') },
  { id: 'caminar', text: 'Asistencia para caminar: ¿qué tanta dificultad tiene para cruzar caminando una habitación?', options: difficulty('Mucha, usa apoyos o incapaz') },
  { id: 'levantarse', text: 'Levantarse de una silla: ¿qué tanta dificultad tiene para pasar de una silla o cama a estar de pie?', options: difficulty('Mucha o incapaz sin ayuda') },
  { id: 'escaleras', text: 'Subir escaleras: ¿qué tanta dificultad tiene para subir 10 escalones?', options: difficulty('Mucha o incapaz') },
  { id: 'caidas', text: 'Caídas: ¿cuántas veces se ha caído en el último año?', options: [{ value: 0, label: 'Ninguna' }, { value: 1, label: '1 a 3 caídas' }, { value: 2, label: '4 o más caídas' }] },
];

export const sarcf: ScaleDefinition = {
  key: 'sarcf',
  version: 1,
  name: 'SARC-F (tamizaje de sarcopenia)',
  shortName: 'SARC-F',
  description: 'Cinco preguntas sobre fuerza, marcha, levantarse, escaleras y caídas (0–10). Una puntuación ≥ 4 sugiere sarcopenia.',
  domain: 'Fragilidad y sarcopenia',
  respondent: 'paciente',
  minutes: 2,
  higherIsBetter: false,
  bands: [
    { min: 4, interpretation: 'Tamizaje positivo: sugiere sarcopenia', severity: 'moderate' },
    { min: 0, interpretation: 'Tamizaje negativo', severity: 'normal' },
  ],
  reference: 'Malmstrom TK, Morley JE. J Am Med Dir Assoc. 2013;14:531-2.',
  notice: 'Es un tamizaje: un resultado positivo se confirma con fuerza de prensión, masa muscular y desempeño físico.',
  items,
  score(answers) {
    const score = sumAnswers(answers, items);
    return score >= 4
      ? { score, maxScore: 10, interpretation: 'Tamizaje positivo: sugiere sarcopenia', severity: 'moderate' }
      : { score, maxScore: 10, interpretation: 'Tamizaje negativo', severity: 'normal' };
  },
};
