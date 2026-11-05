/**
 * Datos de quien prescribe, impresos en cada receta (Reglamento de Insumos para la Salud, art. 29:
 * nombre, domicilio y cédula profesional; para especialistas, también la cédula de especialidad y
 * la institución que expidió el título). Coinciden con apps/web/src/config/site.ts.
 * Al emitir una receta se guarda una copia de estos datos con ella: si cambian, las recetas anteriores no.
 */
export const PRESCRIBER = {
  name: 'Dra. Susana Flores Alonso',
  specialty: 'Geriatra',
  degrees: [
    { title: 'Médica Cirujana', school: 'Universidad Michoacana de San Nicolás de Hidalgo', cedulaLabel: 'Céd. Prof.', cedula: '11529865' },
    { title: 'Especialidad en Geriatría', school: 'Universidad Autónoma de Yucatán', cedulaLabel: 'Céd. Esp.', cedula: '14059596' },
  ],
  address: ['Consultorio de Geriatría y Envejecimiento Saludable', 'Av. Panorama 905-A, Col. Valle del Campestre', 'C.P. 37160, León, Gto.'],
} as const;

/** Vías de administración frecuentes (sugerencias; el campo acepta texto libre). */
export const ROUTE_SUGGESTIONS = [
  'Oral',
  'Sublingual',
  'Tópica',
  'Transdérmica',
  'Oftálmica',
  'Ótica',
  'Nasal',
  'Inhalada',
  'Rectal',
  'Vaginal',
  'Subcutánea',
  'Intramuscular',
  'Intravenosa',
] as const;

/** Campos que exige el art. 30 en cada medicamento antes de emitir. */
export const REQUIRED_ITEM_FIELDS = [
  { key: 'drug', label: 'denominación genérica' },
  { key: 'dose', label: 'dosis' },
  { key: 'route', label: 'vía de administración' },
  { key: 'frequency', label: 'frecuencia' },
  { key: 'duration', label: 'duración del tratamiento' },
] as const;
