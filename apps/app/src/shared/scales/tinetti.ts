import { band, maxOf, sumAnswers, type ScaleDefinition, type ScaleItem, type Band } from './types';

const E = 'Equilibrio';
const M = 'Marcha';

const balance: ScaleItem[] = [
  { id: 'e1', section: E, text: 'Equilibrio sentado', options: [{ value: 0, label: 'Se inclina o se desliza en la silla' }, { value: 1, label: 'Se mantiene seguro' }] },
  { id: 'e2', section: E, text: 'Levantarse', options: [{ value: 0, label: 'Imposible sin ayuda' }, { value: 1, label: 'Capaz, pero usa los brazos para ayudarse' }, { value: 2, label: 'Capaz sin usar los brazos' }] },
  { id: 'e3', section: E, text: 'Intentos para levantarse', options: [{ value: 0, label: 'Incapaz sin ayuda' }, { value: 1, label: 'Capaz, pero necesita más de un intento' }, { value: 2, label: 'Capaz con un solo intento' }] },
  { id: 'e4', section: E, text: 'Equilibrio de pie inmediato (primeros 5 segundos)', options: [{ value: 0, label: 'Inestable (se tambalea, mueve los pies, balanceo marcado del tronco)' }, { value: 1, label: 'Estable, pero usa andadera, bastón o se sujeta de algo' }, { value: 2, label: 'Estable sin andadera, bastón ni otros apoyos' }] },
  { id: 'e5', section: E, text: 'Equilibrio de pie', options: [{ value: 0, label: 'Inestable' }, { value: 1, label: 'Estable con base amplia (talones a más de 10 cm) o con bastón u otro apoyo' }, { value: 2, label: 'Base estrecha sin apoyo' }] },
  { id: 'e6', section: E, text: 'Empujón (pies juntos; el examinador empuja ligeramente el esternón 3 veces)', options: [{ value: 0, label: 'Empieza a caerse' }, { value: 1, label: 'Se tambalea, se sujeta, pero se mantiene' }, { value: 2, label: 'Estable' }] },
  { id: 'e7', section: E, text: 'Ojos cerrados (en la posición anterior)', options: [{ value: 0, label: 'Inestable' }, { value: 1, label: 'Estable' }] },
  { id: 'e8a', section: E, text: 'Vuelta de 360°: pasos', options: [{ value: 0, label: 'Pasos discontinuos' }, { value: 1, label: 'Pasos continuos' }] },
  { id: 'e8b', section: E, text: 'Vuelta de 360°: estabilidad', options: [{ value: 0, label: 'Inestable (se tambalea, se sujeta)' }, { value: 1, label: 'Estable' }] },
  { id: 'e9', section: E, text: 'Sentarse', options: [{ value: 0, label: 'Inseguro: calcula mal la distancia, cae en la silla' }, { value: 1, label: 'Usa los brazos o el movimiento es brusco' }, { value: 2, label: 'Seguro, movimiento suave' }] },
];

const gait: ScaleItem[] = [
  { id: 'm10', section: M, text: 'Inicio de la marcha (inmediatamente después de pedirle que camine)', options: [{ value: 0, label: 'Vacila o necesita varios intentos para empezar' }, { value: 1, label: 'No vacila' }] },
  { id: 'm11a', section: M, text: 'Pie derecho: longitud del paso', options: [{ value: 0, label: 'No sobrepasa al pie izquierdo' }, { value: 1, label: 'Sobrepasa al pie izquierdo' }] },
  { id: 'm11b', section: M, text: 'Pie derecho: altura del paso', options: [{ value: 0, label: 'No se separa completamente del suelo' }, { value: 1, label: 'Se separa completamente del suelo' }] },
  { id: 'm11c', section: M, text: 'Pie izquierdo: longitud del paso', options: [{ value: 0, label: 'No sobrepasa al pie derecho' }, { value: 1, label: 'Sobrepasa al pie derecho' }] },
  { id: 'm11d', section: M, text: 'Pie izquierdo: altura del paso', options: [{ value: 0, label: 'No se separa completamente del suelo' }, { value: 1, label: 'Se separa completamente del suelo' }] },
  { id: 'm12', section: M, text: 'Simetría del paso', options: [{ value: 0, label: 'Los pasos derecho e izquierdo no son iguales' }, { value: 1, label: 'Los pasos parecen iguales' }] },
  { id: 'm13', section: M, text: 'Fluidez del paso', options: [{ value: 0, label: 'Se detiene entre pasos' }, { value: 1, label: 'Los pasos parecen continuos' }] },
  { id: 'm14', section: M, text: 'Trayectoria (observar un pie durante unos 3 metros)', options: [{ value: 0, label: 'Desviación grave' }, { value: 1, label: 'Desviación leve o moderada, o usa ayudas' }, { value: 2, label: 'Sin desviación ni ayudas' }] },
  { id: 'm15', section: M, text: 'Tronco', options: [{ value: 0, label: 'Balanceo marcado o usa ayudas' }, { value: 1, label: 'Sin balanceo, pero flexiona rodillas o espalda, o separa los brazos' }, { value: 2, label: 'Sin balanceo, sin flexión, sin usar brazos ni ayudas' }] },
  { id: 'm16', section: M, text: 'Postura al caminar', options: [{ value: 0, label: 'Talones separados' }, { value: 1, label: 'Talones casi juntos al caminar' }] },
];

const items = [...balance, ...gait];

const BANDS: Band[] = [
  { min: 25, interpretation: 'Riesgo bajo de caídas', severity: 'normal' },
  { min: 19, interpretation: 'Riesgo moderado de caídas', severity: 'moderate' },
  { min: 0, interpretation: 'Riesgo alto de caídas', severity: 'severe' },
];

export const tinetti: ScaleDefinition = {
  key: 'tinetti',
  version: 1,
  name: 'Escala de Tinetti (marcha y equilibrio)',
  shortName: 'Tinetti',
  description: 'Valoración observada del equilibrio (16 puntos) y la marcha (12 puntos) para estimar el riesgo de caídas (0–28).',
  domain: 'Marcha y caídas',
  respondent: 'observacion',
  minutes: 10,
  higherIsBetter: true,
  bands: BANDS,
  reference: 'Tinetti ME. J Am Geriatr Soc. 1986;34:119-26.',
  items,
  score(answers) {
    const b1 = sumAnswers(answers, balance);
    const g1 = sumAnswers(answers, gait);
    const score = b1 + g1;
    const b = band(score, BANDS);
    return {
      score,
      maxScore: maxOf(items),
      interpretation: b.interpretation,
      severity: b.severity,
      details: [
        { label: 'Equilibrio', value: `${b1}/${maxOf(balance)}` },
        { label: 'Marcha', value: `${g1}/${maxOf(gait)}` },
      ],
    };
  },
};
