import type { FileCategory, Modality, NoteStatus, NoteType, Role } from './constants';
import type { HistoryData } from './history';

/** Formas de las respuestas de la API (las fechas llegan como texto ISO). */

export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
  canEditClinical: boolean;
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
