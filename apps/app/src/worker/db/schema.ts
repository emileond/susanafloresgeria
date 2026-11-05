import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Esquema D1 del expediente clínico.
 * - IDs UUIDv7 (ordenables por tiempo).
 * - Fechas/horas en milisegundos UTC; fechas clínicas sin hora como texto AAAA-MM-DD.
 * - Los datos clínicos no se borran: se archivan, se versionan o se corrigen con adenda.
 */

const id = () => text('id').primaryKey();
const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
};
const authorship = {
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
};

export const users = sqliteTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role', { enum: ['doctor', 'assistant', 'admin'] }).notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

export const patients = sqliteTable(
  'patients',
  {
    id: id(),
    fullName: text('full_name').notNull(),
    searchName: text('search_name').notNull(),
    birthDate: text('birth_date').notNull(),
    sex: text('sex', { enum: ['F', 'M', 'X'] }).notNull(),
    curp: text('curp'),
    phone: text('phone'),
    address: text('address'),
    bloodType: text('blood_type'),
    allergies: text('allergies'),
    notes: text('notes'),
    lastVisitAt: text('last_visit_at'),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    ...timestamps,
    ...authorship,
  },
  (t) => [index('patients_search_idx').on(t.searchName), index('patients_updated_idx').on(t.updatedAt)],
);

export const patientContacts = sqliteTable(
  'patient_contacts',
  {
    id: id(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    name: text('name').notNull(),
    relationship: text('relationship'),
    phone: text('phone'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
    ...authorship,
  },
  (t) => [index('contacts_patient_idx').on(t.patientId)],
);

export const clinicalHistories = sqliteTable(
  'clinical_histories',
  {
    id: id(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    version: integer('version').notNull(),
    data: text('data', { mode: 'json' }).notNull().$type<Record<string, string | undefined>>(),
    source: text('source', { enum: ['manual', 'ai_assisted'] }).notNull().default('manual'),
    ...timestamps,
    ...authorship,
  },
  (t) => [uniqueIndex('history_patient_version_unique').on(t.patientId, t.version)],
);

export const notes = sqliteTable(
  'notes',
  {
    id: id(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    type: text('type', { enum: ['primera_vez', 'evolucion', 'interconsulta', 'libre'] }).notNull(),
    modality: text('modality', { enum: ['consultorio', 'domicilio', 'en_linea'] }).notNull(),
    visitDate: text('visit_date').notNull(),
    subjective: text('subjective'),
    objective: text('objective'),
    assessment: text('assessment'),
    plan: text('plan'),
    body: text('body'),
    vitals: text('vitals', { mode: 'json' }).$type<Record<string, number | undefined>>(),
    status: text('status', { enum: ['draft', 'signed'] }).notNull().default('draft'),
    signedAt: integer('signed_at', { mode: 'timestamp_ms' }),
    signedBy: text('signed_by').references(() => users.id),
    /** Si es una adenda, la nota firmada que corrige o complementa. */
    amendsNoteId: text('amends_note_id'),
    ...timestamps,
    ...authorship,
  },
  (t) => [index('notes_patient_idx').on(t.patientId, t.visitDate)],
);

export const files = sqliteTable(
  'files',
  {
    id: id(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    noteId: text('note_id').references(() => notes.id),
    category: text('category', { enum: ['laboratorio', 'imagen', 'foto', 'receta', 'documento', 'otro'] }).notNull(),
    r2Key: text('r2_key').notNull(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    sha256: text('sha256').notNull(),
    studyDate: text('study_date'),
    description: text('description'),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    ...timestamps,
    ...authorship,
  },
  (t) => [index('files_patient_idx').on(t.patientId)],
);

export const medications = sqliteTable(
  'medications',
  {
    id: id(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    name: text('name').notNull(),
    dose: text('dose'),
    frequency: text('frequency'),
    indication: text('indication'),
    prescriber: text('prescriber'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
    ...authorship,
  },
  (t) => [index('meds_patient_idx').on(t.patientId)],
);

/** Resultados de escalas geriátricas. La puntuación la calcula el servidor; un resultado guardado no se modifica. */
export const assessments = sqliteTable(
  'assessments',
  {
    id: id(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    noteId: text('note_id').references(() => notes.id),
    scaleKey: text('scale_key').notNull(),
    scaleVersion: integer('scale_version').notNull(),
    answers: text('answers', { mode: 'json' }).notNull().$type<Record<string, number>>(),
    score: integer('score').notNull(),
    maxScore: integer('max_score').notNull(),
    interpretation: text('interpretation').notNull(),
    severity: text('severity', { enum: ['normal', 'mild', 'moderate', 'severe'] }).notNull(),
    details: text('details', { mode: 'json' }).$type<{ label: string; value: string }[]>(),
    /** Quién respondió (paciente, cuidador u observación) y comentario breve. */
    respondent: text('respondent'),
    comment: text('comment'),
    performedAt: text('performed_at').notNull(),
    ...timestamps,
    ...authorship,
  },
  (t) => [index('assessments_patient_idx').on(t.patientId, t.scaleKey, t.performedAt)],
);

/** Bitácora de accesos y cambios (NOM-024): quién, qué, cuándo. Nunca guarda contenido clínico. */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    userId: text('user_id').references(() => users.id),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    patientId: text('patient_id'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    at: integer('at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [index('audit_patient_idx').on(t.patientId, t.at), index('audit_at_idx').on(t.at)],
);

export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type PatientContact = typeof patientContacts.$inferSelect;
export type ClinicalHistory = typeof clinicalHistories.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type FileRecord = typeof files.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
