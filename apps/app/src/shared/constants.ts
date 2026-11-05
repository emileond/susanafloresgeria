/** Catálogos compartidos entre la API y la interfaz. */

export const TIME_ZONE = 'America/Mexico_City';

export const ROLES = ['doctor', 'assistant', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const SEXES = ['F', 'M', 'X'] as const;
export const SEX_LABELS: Record<(typeof SEXES)[number], string> = { F: 'Femenino', M: 'Masculino', X: 'Otro / no especificado' };

export const NOTE_TYPES = ['primera_vez', 'evolucion', 'interconsulta', 'libre'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  primera_vez: 'Primera vez',
  evolucion: 'Nota de evolución',
  interconsulta: 'Interconsulta',
  libre: 'Nota libre',
};

export const MODALITIES = ['consultorio', 'domicilio', 'en_linea'] as const;
export type Modality = (typeof MODALITIES)[number];
export const MODALITY_LABELS: Record<Modality, string> = {
  consultorio: 'Consultorio',
  domicilio: 'Domicilio',
  en_linea: 'En línea',
};

export const NOTE_STATUSES = ['draft', 'signed'] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const FILE_CATEGORIES = ['laboratorio', 'imagen', 'foto', 'receta', 'documento', 'otro'] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];
export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  laboratorio: 'Laboratorio',
  imagen: 'Estudio de imagen',
  foto: 'Fotografía',
  receta: 'Receta',
  documento: 'Documento',
  otro: 'Otro',
};

/** Tipos de archivo permitidos (lista blanca) y tamaño máximo. */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/** Signos vitales que se registran en las notas. */
export const VITALS = [
  { key: 'taSys', label: 'TA sistólica', unit: 'mmHg' },
  { key: 'taDia', label: 'TA diastólica', unit: 'mmHg' },
  { key: 'fc', label: 'Frec. cardiaca', unit: 'lpm' },
  { key: 'fr', label: 'Frec. respiratoria', unit: 'rpm' },
  { key: 'temp', label: 'Temperatura', unit: '°C' },
  { key: 'spo2', label: 'SpO₂', unit: '%' },
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'height', label: 'Talla', unit: 'cm' },
  { key: 'glucose', label: 'Glucosa capilar', unit: 'mg/dL' },
] as const;
export type VitalKey = (typeof VITALS)[number]['key'];
