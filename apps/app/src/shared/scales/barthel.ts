import { band, maxOf, sumAnswers, type ScaleDefinition, type ScaleItem, type Band } from './types';

const items: ScaleItem[] = [
  { id: 'comer', text: 'Comer', options: [{ value: 10, label: 'Independiente: capaz de comer por sí solo en un tiempo razonable' }, { value: 5, label: 'Necesita ayuda para cortar la carne, untar la mantequilla, etc.' }, { value: 0, label: 'Dependiente' }] },
  { id: 'lavarse', text: 'Lavarse (baño)', options: [{ value: 5, label: 'Independiente: se lava completo, entra y sale solo del baño' }, { value: 0, label: 'Dependiente' }] },
  { id: 'vestirse', text: 'Vestirse', options: [{ value: 10, label: 'Independiente: se pone y quita la ropa, se abrocha, se ata los zapatos' }, { value: 5, label: 'Necesita ayuda, pero hace al menos la mitad de las tareas en un tiempo razonable' }, { value: 0, label: 'Dependiente' }] },
  { id: 'arreglarse', text: 'Arreglarse (aseo personal)', options: [{ value: 5, label: 'Independiente: se lava cara y manos, se peina, se afeita, se maquilla' }, { value: 0, label: 'Dependiente' }] },
  { id: 'deposiciones', text: 'Deposiciones (continencia fecal)', options: [{ value: 10, label: 'Continente: ningún episodio de incontinencia' }, { value: 5, label: 'Accidente ocasional (máximo uno por semana) o necesita ayuda con enemas o supositorios' }, { value: 0, label: 'Incontinente' }] },
  { id: 'miccion', text: 'Micción (continencia urinaria)', options: [{ value: 10, label: 'Continente o capaz de cuidar la sonda' }, { value: 5, label: 'Accidente ocasional (máximo uno en 24 h) o necesita ayuda con la sonda' }, { value: 0, label: 'Incontinente' }] },
  { id: 'retrete', text: 'Uso del retrete', options: [{ value: 10, label: 'Independiente: entra y sale solo, se limpia y se arregla la ropa' }, { value: 5, label: 'Necesita alguna ayuda, pero puede hacer algo solo' }, { value: 0, label: 'Dependiente' }] },
  { id: 'trasladarse', text: 'Trasladarse (sillón–cama)', options: [{ value: 15, label: 'Independiente' }, { value: 10, label: 'Mínima ayuda física o supervisión verbal' }, { value: 5, label: 'Gran ayuda (una persona fuerte o dos), pero se mantiene sentado solo' }, { value: 0, label: 'Dependiente: necesita grúa o ayuda de dos personas; no se mantiene sentado' }] },
  { id: 'deambular', text: 'Deambulación', options: [{ value: 15, label: 'Independiente: camina solo 50 metros (puede usar bastón, no andadera con ruedas)' }, { value: 10, label: 'Necesita ayuda física o supervisión para caminar 50 metros' }, { value: 5, label: 'Independiente en silla de ruedas, sin ayuda, 50 metros' }, { value: 0, label: 'Dependiente' }] },
  { id: 'escaleras', text: 'Subir y bajar escaleras', options: [{ value: 10, label: 'Independiente: sube y baja un piso sin ayuda ni supervisión' }, { value: 5, label: 'Necesita ayuda física o supervisión' }, { value: 0, label: 'Dependiente: incapaz' }] },
];

const BANDS: Band[] = [
  { min: 100, interpretation: 'Independiente', severity: 'normal' },
  { min: 91, interpretation: 'Dependencia escasa', severity: 'mild' },
  { min: 61, interpretation: 'Dependencia moderada', severity: 'moderate' },
  { min: 21, interpretation: 'Dependencia severa', severity: 'severe' },
  { min: 0, interpretation: 'Dependencia total', severity: 'severe' },
];

export const barthel: ScaleDefinition = {
  key: 'barthel',
  version: 1,
  name: 'Índice de Barthel',
  shortName: 'Barthel',
  description: 'Grado de independencia en 10 actividades básicas de la vida diaria (0–100).',
  domain: 'Funcionalidad',
  respondent: 'observacion',
  minutes: 5,
  higherIsBetter: true,
  bands: BANDS,
  reference: 'Mahoney FI, Barthel DW. Md State Med J. 1965;14:61-5. Puntos de corte: Shah S, et al. J Clin Epidemiol. 1989;42:703-9.',
  items,
  score(answers) {
    const score = sumAnswers(answers, items);
    const b = band(score, BANDS);
    return { score, maxScore: maxOf(items), interpretation: b.interpretation, severity: b.severity };
  },
};
