import type { FileCategory, Modality, NoteStatus, NoteType, Role } from './constants';
import type { HistoryData } from './history';

/** Formas de las respuestas de la API (las fechas llegan como texto ISO). */

export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
  canEditClinical: boolean;
  features: { ai: boolean; scales: string[] };
}

export interface PatientListItem {
  id: string;
  fullName: string;
  birthDate: string;
  sex: 'F' | 'M' | 'X';
  phone: string | null;
  allergies: string | null;
  lastVisitAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface PatientDetail extends PatientListItem {
  curp: string | null;
  address: string | null;
  bloodType: string | null;
  notes: string | null;
  createdAt: string;
  contacts: Contact[];
  summary: {
    activeMedications: number;
    notesCount: number;
    draftNotes: number;
    filesCount: number;
    assessmentsCount: number;
    /** Recetas emitidas vigentes (no cuenta borradores ni canceladas). */
    prescriptionsCount: number;
    historyVersion: number | null;
    lastNote: { id: string; visitDate: string; type: NoteType } | null;
  };
}

export type Vitals = Partial<Record<string, number>>;

export interface NoteItem {
  id: string;
  patientId: string;
  type: NoteType;
  modality: Modality;
  visitDate: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  body: string | null;
  vitals: Vitals | null;
  status: NoteStatus;
  signedAt: string | null;
  signedByName: string | null;
  amendsNoteId: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}

export interface HistoryVersionMeta {
  version: number;
  source: 'manual' | 'ai_assisted';
  createdAt: string;
  createdByName: string | null;
}

export interface HistoryResponse {
  current: (HistoryVersionMeta & { data: HistoryData }) | null;
  versions: HistoryVersionMeta[];
}

export interface FileItem {
  id: string;
  patientId: string;
  noteId: string | null;
  category: FileCategory;
  filename: string;
  mime: string;
  size: number;
  studyDate: string | null;
  description: string | null;
  createdAt: string;
  createdByName: string | null;
}

export interface MedicationItem {
  id: string;
  patientId: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  indication: string | null;
  prescriber: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  updatedAt: string;
}

export interface Dashboard {
  totals: { patients: number; draftNotes: number };
  recentPatients: PatientListItem[];
  draftNotes: { id: string; patientId: string; patientName: string; visitDate: string; type: NoteType }[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export interface AssessmentItem {
  id: string;
  patientId: string;
  noteId: string | null;
  scaleKey: string;
  scaleVersion: number;
  answers: Record<string, number>;
  score: number;
  maxScore: number;
  interpretation: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  details: { label: string; value: string }[] | null;
  respondent: string | null;
  comment: string | null;
  performedAt: string;
  createdAt: string;
  createdByName: string | null;
}

export interface PrescriptionItem {
  drug: string;
  brand?: string;
  presentation?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
  medicationId?: string;
}

/** Datos del paciente y de quien prescribe tal como quedaron impresos al emitir la receta. */
export interface PrescriptionSnapshot {
  patient: { fullName: string; birthDate: string; age: number; sex: 'F' | 'M' | 'X'; allergies: string | null };
  prescriber: {
    name: string;
    specialty: string;
    degrees: { title: string; school: string; cedulaLabel: string; cedula: string }[];
    address: string[];
  };
}

export type PrescriptionStatus = 'draft' | 'issued' | 'cancelled';

export interface Prescription {
  id: string;
  patientId: string;
  noteId: string | null;
  folio: number | null;
  date: string;
  items: PrescriptionItem[];
  diagnosis: string | null;
  generalInstructions: string | null;
  weightKg: number | null;
  status: PrescriptionStatus;
  /** Datos impresos tal como quedaron al emitir (null en borradores). */
  snapshot: PrescriptionSnapshot | null;
  issuedAt: string | null;
  issuedByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  sourceId: string | null;
  sourceFolio: number | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}

export interface AiHistoryDraft {
  /** Propuesta por sección (solo las secciones con información nueva o integrada). */
  proposals: Partial<Record<string, string>>;
  notesUsed: number;
  model: string;
}
