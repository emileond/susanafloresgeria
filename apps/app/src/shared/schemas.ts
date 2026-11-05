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
