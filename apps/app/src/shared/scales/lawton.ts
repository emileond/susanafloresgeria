import { band, sumAnswers, type ScaleDefinition, type ScaleItem } from './types';

const items: ScaleItem[] = [
  { id: 'telefono', text: 'Capacidad para usar el teléfono', options: [
    { value: 1, label: 'Utiliza el teléfono por iniciativa propia' },
    { value: 1, label: 'Es capaz de marcar bien algunos números conocidos' },
    { value: 1, label: 'Es capaz de contestar el teléfono, pero no de marcar' },
    { value: 0, label: 'No utiliza el teléfono' },
  ] },
  { id: 'compras', text: 'Hacer compras', options: [
    { value: 1, label: 'Realiza todas las compras necesarias de forma independiente' },
    { value: 0, label: 'Realiza de forma independiente pequeñas compras' },
    { value: 0, label: 'Necesita ir acompañado para cualquier compra' },
    { value: 0, label: 'Totalmente incapaz de comprar' },
  ] },
  { id: 'comida', text: 'Preparación de la comida', options: [
    { value: 1, label: 'Organiza, prepara y sirve las comidas por sí solo adecuadamente' },
    { value: 0, label: 'Prepara adecuadamente las comidas si se le dan los ingredientes' },
    { value: 0, label: 'Prepara, calienta y sirve las comidas, pero no sigue una dieta adecuada' },
    { value: 0, label: 'Necesita que le preparen y sirvan las comidas' },
  ] },
  { id: 'casa', text: 'Cuidado de la casa', options: [
    { value: 1, label: 'Mantiene la casa solo o con ayuda ocasional (para trabajos pesados)' },
    { value: 1, label: 'Realiza tareas ligeras, como lavar los platos o hacer las camas' },
    { value: 1, label: 'Realiza tareas ligeras, pero no mantiene un nivel de limpieza adecuado' },
    { value: 1, label: 'Necesita ayuda en todas las labores de la casa' },
    { value: 0, label: 'No participa en ninguna labor de la casa' },
  ] },
  { id: 'ropa', text: 'Lavado de la ropa', options: [
    { value: 1, label: 'Lava por sí solo toda su ropa' },
    { value: 1, label: 'Lava por sí solo pequeñas prendas' },
    { value: 0, label: 'Todo el lavado de ropa lo realiza otra persona' },
  ] },
  { id: 'transporte', text: 'Uso de medios de transporte', options: [
    { value: 1, label: 'Viaja solo en transporte público o maneja su propio auto' },
    { value: 1, label: 'Es capaz de tomar un taxi, pero no usa otro medio de transporte' },
    { value: 1, label: 'Viaja en transporte público cuando va acompañado' },
    { value: 0, label: 'Solo usa taxi o automóvil con ayuda de otros' },
    { value: 0, label: 'No viaja' },
  ] },
  { id: 'medicacion', text: 'Responsabilidad respecto a su medicación', options: [
    { value: 1, label: 'Toma su medicación a la hora y con la dosis correctas' },
    { value: 0, label: 'Toma su medicación si se le prepara la dosis previamente' },
    { value: 0, label: 'No es capaz de tomar su medicación' },
  ] },
  { id: 'dinero', text: 'Manejo de asuntos económicos', options: [
    { value: 1, label: 'Se encarga de sus asuntos económicos por sí solo' },
    { value: 1, label: 'Realiza las compras del día, pero necesita ayuda en grandes compras, bancos, etc.' },
    { value: 0, label: 'Incapaz de manejar dinero' },
  ] },
];

const BANDS = [
  { min: 8, interpretation: 'Independiente en actividades instrumentales', severity: 'normal' as const },
  { min: 6, interpretation: 'Dependencia ligera', severity: 'mild' as const },
  { min: 4, interpretation: 'Dependencia moderada', severity: 'moderate' as const },
  { min: 2, interpretation: 'Dependencia severa', severity: 'severe' as const },
  { min: 0, interpretation: 'Dependencia total', severity: 'severe' as const },
];

/**
 * Las opciones de un mismo ítem pueden compartir valor (así es la escala original),
 * por eso las respuestas se guardan por índice de opción y se convierten a puntos al calificar.
 */
export const lawton: ScaleDefinition = {
  key: 'lawton',
  version: 1,
  name: 'Escala de Lawton y Brody (actividades instrumentales)',
  shortName: 'Lawton-Brody',
  description: 'Independencia en 8 actividades instrumentales: teléfono, compras, comida, casa, ropa, transporte, medicación y dinero (0–8).',
  domain: 'Funcionalidad',
  respondent: 'paciente',
  minutes: 5,
  higherIsBetter: true,
  reference: 'Lawton MP, Brody EM. Gerontologist. 1969;9:179-86.',
  notice: 'Puntuación sobre 8 ítems. En algunos protocolos se excluyen comida, casa y ropa en hombres (0–5).',
  items,
  score(answers) {
    const score = sumAnswers(answers, items);
    const b = band(score, BANDS);
    return { score, maxScore: 8, interpretation: b.interpretation, severity: b.severity };
  },
};
