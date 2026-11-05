/**
 * Secciones de la historia clínica, basadas en el contenido mínimo de la NOM-004-SSA3-2012
 * (interrogatorio, exploración física, resultados, diagnósticos y plan).
 */
export const HISTORY_SECTIONS = [
  {
    key: 'heredofamiliares',
    label: 'Antecedentes heredofamiliares',
    hint: 'Enfermedades relevantes en padres, hermanos e hijos (diabetes, hipertensión, demencia, cáncer…).',
  },
  {
    key: 'personalesPatologicos',
    label: 'Antecedentes personales patológicos',
    hint: 'Enfermedades crónicas, cirugías, hospitalizaciones, traumatismos, alergias, transfusiones.',
  },
  {
    key: 'personalesNoPatologicos',
    label: 'Antecedentes personales no patológicos',
    hint: 'Escolaridad, ocupación, vivienda, con quién vive, tabaquismo, alcohol, actividad física, alimentación, vacunas.',
  },
  {
    key: 'ginecoObstetricos',
    label: 'Antecedentes gineco-obstétricos',
    hint: 'Menarca, menopausia, gestas, partos, cesáreas, abortos (si aplica).',
  },
  {
    key: 'padecimientoActual',
    label: 'Padecimiento actual',
    hint: 'Motivo de consulta, inicio, evolución y estado actual.',
  },
  {
    key: 'aparatosSistemas',
    label: 'Interrogatorio por aparatos y sistemas',
    hint: 'Síntomas por sistema; incluir síndromes geriátricos (caídas, memoria, ánimo, continencia, sueño, nutrición).',
  },
  {
    key: 'exploracionFisica',
    label: 'Exploración física',
    hint: 'Habitus exterior, signos vitales y exploración por regiones.',
  },
  {
    key: 'resultadosEstudios',
    label: 'Resultados de estudios',
    hint: 'Laboratorio, gabinete y escalas aplicadas relevantes.',
  },
  {
    key: 'diagnosticos',
    label: 'Diagnósticos o problemas clínicos',
    hint: 'Diagnósticos y problemas activos.',
  },
  {
    key: 'plan',
    label: 'Plan y pronóstico',
    hint: 'Tratamiento, indicaciones, estudios solicitados, seguimiento y pronóstico.',
  },
] as const;

export type HistorySectionKey = (typeof HISTORY_SECTIONS)[number]['key'];
export type HistoryData = Partial<Record<HistorySectionKey, string>>;
