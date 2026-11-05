import { z } from 'zod';
import { BLOOD_TYPES, FILE_CATEGORIES, MODALITIES, NOTE_TYPES, SEXES, VITALS } from './constants';
import { HISTORY_SECTIONS } from './history';

/** Esquemas de validación compartidos: los usa la API (Hono) y los formularios (react-hook-form). */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida');

export const birthDateSchema = isoDate.refine((v) => {
  const d = new Date(v);
  return d.getTime() <= Date.now() && d.getUTCFullYear() >= 1900;
}, 'Fecha de nacimiento inválida');

const phone = optionalText(30);

export const contactInput = z.object({
  name: trimmed(120).min(2, 'Escriba el nombre'),
  relationship: optionalText(60),
  phone,
  isPrimary: z.boolean().optional(),
});
export type ContactInput = z.input<typeof contactInput>;

/** Alta rápida: lo mínimo para empezar el expediente. */
export const patientCreateInput = z.object({
  fullName: trimmed(160).min(3, 'Escriba el nombre completo'),
  birthDate: birthDateSchema,
  sex: z.enum(SEXES),
  phone,
  caregiver: contactInput.optional(),
});
export type PatientCreateInput = z.input<typeof patientCreateInput>;

export const patientUpdateInput = z.object({
  fullName: trimmed(160).min(3).optional(),
  birthDate: birthDateSchema.optional(),
  sex: z.enum(SEXES).optional(),
  phone,
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{18}$/, 'La CURP tiene 18 caracteres')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  address: optionalText(300),
  bloodType: z.enum(BLOOD_TYPES).optional().or(z.literal('').transform(() => undefined)),
  allergies: optionalText(500),
  notes: optionalText(2000),
});
export type PatientUpdateInput = z.input<typeof patientUpdateInput>;

const vitalsShape = Object.fromEntries(VITALS.map((v) => [v.key, z.number().finite().nonnegative().max(1000).optional()]));
export const vitalsSchema = z.object(vitalsShape).partial();

export const noteInput = z.object({
  type: z.enum(NOTE_TYPES),
  modality: z.enum(MODALITIES),
  visitDate: isoDate,
  subjective: optionalText(20000),
  objective: optionalText(20000),
  assessment: optionalText(20000),
  plan: optionalText(20000),
  body: optionalText(40000),
  vitals: vitalsSchema.optional(),
});
export type NoteInput = z.input<typeof noteInput>;
export const noteUpdateInput = noteInput.partial();

const historyShape = Object.fromEntries(HISTORY_SECTIONS.map((s) => [s.key, optionalText(20000)]));
export const historyInput = z.object({
  data: z.object(historyShape).partial(),
  source: z.enum(['manual', 'ai_assisted']).default('manual'),
});
export type HistoryInput = z.input<typeof historyInput>;

export const fileMetaInput = z.object({
  category: z.enum(FILE_CATEGORIES),
  description: optionalText(500),
  studyDate: isoDate.optional().or(z.literal('').transform(() => undefined)),
  noteId: z.uuid().optional(),
});

export const medicationInput = z.object({
  name: trimmed(160).min(2, 'Escriba el medicamento'),
  dose: optionalText(80),
  frequency: optionalText(80),
  indication: optionalText(200),
  prescriber: optionalText(120),
  startDate: isoDate.optional().or(z.literal('').transform(() => undefined)),
});
export type MedicationInput = z.input<typeof medicationInput>;
export const medicationUpdateInput = medicationInput.partial().extend({
  active: z.boolean().optional(),
  endDate: isoDate.optional().or(z.literal('').transform(() => undefined)),
});

export const searchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(30),
  includeArchived: z.boolean().optional(),
});

/** Aplicación de una escala. El servidor recalcula la puntuación a partir de las respuestas. */
export const assessmentInput = z.object({
  scaleKey: z.string().min(1).max(40),
  answers: z.record(z.string().max(20), z.number().int().min(0).max(20)),
  performedAt: isoDate,
  respondent: z.enum(['paciente', 'cuidador', 'observacion']).optional(),
  comment: optionalText(1000),
  /** Agregar el resultado a una nota: ninguna, una nota nueva o un borrador existente. */
  attach: z
    .discriminatedUnion('mode', [
      z.object({ mode: z.literal('none') }),
      z.object({ mode: z.literal('new_note') }),
      z.object({ mode: z.literal('note'), noteId: z.uuid() }),
    ])
    .default({ mode: 'none' }),
});
export type AssessmentInput = z.input<typeof assessmentInput>;

/** Un medicamento de la receta. En borrador todo es opcional; al emitir se exigen los campos del art. 30. */
export const prescriptionItemInput = z.object({
  drug: trimmed(160),
  brand: optionalText(120),
  presentation: optionalText(160),
  dose: optionalText(120),
  route: optionalText(60),
  frequency: optionalText(120),
  duration: optionalText(120),
  quantity: optionalText(120),
  instructions: optionalText(600),
  medicationId: z.uuid().optional(),
});
export type PrescriptionItemInput = z.input<typeof prescriptionItemInput>;

const prescriptionFields = {
  date: isoDate,
  noteId: z.uuid().nullable().optional(),
  items: z.array(prescriptionItemInput).max(20, 'Máximo 20 medicamentos por receta'),
  diagnosis: optionalText(500),
  generalInstructions: optionalText(4000),
  weightKg: z.number().finite().positive().max(400).nullable().optional(),
};

export const prescriptionCreateInput = z.object({
  ...prescriptionFields,
  date: isoDate.optional(),
  items: prescriptionFields.items.optional(),
  /** Prellenar con estos medicamentos de la lista del paciente. */
  fromMedicationIds: z.array(z.uuid()).max(20).optional(),
});
export type PrescriptionCreateInput = z.input<typeof prescriptionCreateInput>;

export const prescriptionUpdateInput = z.object(prescriptionFields).partial();
export type PrescriptionUpdateInput = z.input<typeof prescriptionUpdateInput>;

export const prescriptionIssueInput = z.object({
  /** Agregar a la lista de medicamentos del paciente los que aún no estén activos. */
  addToMedications: z.boolean().default(false),
});

export const prescriptionCancelInput = z.object({
  reason: trimmed(500).min(5, 'Escriba el motivo de la cancelación'),
});

export const aiHistoryDraftInput = z.object({
  noteIds: z.array(z.uuid()).min(1, 'Seleccione al menos una nota').max(30),
});

const isoDateTime = z.iso.datetime({ offset: true });
export const APPOINTMENT_STATUSES = ['scheduled', 'done', 'cancelled', 'no_show'] as const;

/** Cita directa (agendada en la app). */
export const appointmentInput = z
  .object({
    patientId: z.uuid().nullable().optional(),
    title: optionalText(160),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    modality: z.enum(MODALITIES).default('consultorio'),
    status: z.enum(APPOINTMENT_STATUSES).default('scheduled'),
    notes: optionalText(1000),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), { message: 'La hora de fin debe ser posterior al inicio', path: ['endsAt'] })
  .refine((v) => Date.parse(v.endsAt) - Date.parse(v.startsAt) <= 12 * 3600_000, { message: 'La cita no puede durar más de 12 horas', path: ['endsAt'] })
  .refine((v) => Boolean(v.patientId) || Boolean(v.title), { message: 'Elija un paciente o escriba un título', path: ['title'] });
export type AppointmentInput = z.input<typeof appointmentInput>;

export const appointmentUpdateInput = z.object({
  patientId: z.uuid().nullable().optional(),
  title: optionalText(160),
  startsAt: isoDateTime.optional(),
  endsAt: isoDateTime.optional(),
  modality: z.enum(MODALITIES).optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  notes: optionalText(1000),
});
export type AppointmentUpdateInput = z.input<typeof appointmentUpdateInput>;

export const appointmentRangeQuery = z
  .object({ from: isoDateTime, to: isoDateTime })
  .refine((v) => Date.parse(v.to) > Date.parse(v.from) && Date.parse(v.to) - Date.parse(v.from) <= 92 * 24 * 3600_000, 'Rango inválido');
