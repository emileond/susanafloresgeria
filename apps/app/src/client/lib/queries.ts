import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ContactInput,
  HistoryInput,
  MedicationInput,
  NoteInput,
  PatientCreateInput,
  PatientUpdateInput,
} from '../../shared/schemas';
import type {
  Dashboard,
  FileItem,
  HistoryResponse,
  Me,
  MedicationItem,
  NoteItem,
  PatientDetail,
  PatientListItem,
} from '../../shared/types';
import { api } from './api';

/** Llaves de caché centralizadas para invalidar de forma consistente. */
export const qk = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  patients: (q = '') => ['patients', q] as const,
  patient: (id: string) => ['patient', id] as const,
  notes: (patientId: string) => ['patient', patientId, 'notes'] as const,
  note: (id: string) => ['note', id] as const,
  history: (patientId: string) => ['patient', patientId, 'history'] as const,
  files: (patientId: string) => ['patient', patientId, 'files'] as const,
  medications: (patientId: string) => ['patient', patientId, 'medications'] as const,
};

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: () => api<Me>('/me'), staleTime: 5 * 60_000 });
export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: () => api<Dashboard>('/dashboard') });

export const usePatients = (q: string) =>
  useQuery({
    queryKey: qk.patients(q),
    queryFn: () => api<PatientListItem[]>('/patients/search', { method: 'POST', json: { q: q || undefined, limit: 50 } }),
    placeholderData: (prev) => prev,
  });

export const usePatient = (id: string) => useQuery({ queryKey: qk.patient(id), queryFn: () => api<PatientDetail>(`/patients/${id}`) });

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatientCreateInput) => api<{ id: string }>('/patients', { method: 'POST', json: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['patients'] });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatientUpdateInput) => api(`/patients/${id}`, { method: 'PATCH', json: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.patient(id) });
      void qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useArchivePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archive: boolean) => api(`/patients/${id}/${archive ? 'archive' : 'unarchive'}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.patient(id) });
      void qc.invalidateQueries({ queryKey: ['patients'] });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useContactMutations(patientId: string) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: qk.patient(patientId) });
  return {
    create: useMutation({
      mutationFn: (input: ContactInput) => api(`/patients/${patientId}/contacts`, { method: 'POST', json: input }),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: ContactInput & { id: string }) =>
        api(`/patients/${patientId}/contacts/${id}`, { method: 'PATCH', json: input }),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api(`/patients/${patientId}/contacts/${id}`, { method: 'DELETE' }),
      onSuccess: done,
    }),
  };
}

// Notas
export const useNotes = (patientId: string) =>
  useQuery({ queryKey: qk.notes(patientId), enabled: !!patientId, queryFn: () => api<NoteItem[]>(`/patients/${patientId}/notes`) });
export const useNote = (id: string) => useQuery({ queryKey: qk.note(id), queryFn: () => api<NoteItem>(`/notes/${id}`) });

export function useNoteMutations(patientId: string) {
  const qc = useQueryClient();
  const refresh = (note?: NoteItem) => {
    if (note) qc.setQueryData(qk.note(note.id), note);
    void qc.invalidateQueries({ queryKey: qk.notes(patientId) });
    void qc.invalidateQueries({ queryKey: qk.patient(patientId) });
    void qc.invalidateQueries({ queryKey: qk.dashboard });
  };
  return {
    create: useMutation({
      mutationFn: (input: NoteInput) => api<NoteItem>(`/patients/${patientId}/notes`, { method: 'POST', json: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<NoteInput> & { id: string }) => api<NoteItem>(`/notes/${id}`, { method: 'PATCH', json: input }),
      onSuccess: (note) => qc.setQueryData(qk.note(note.id), note),
    }),
    sign: useMutation({ mutationFn: (id: string) => api<NoteItem>(`/notes/${id}/sign`, { method: 'POST' }), onSuccess: refresh }),
    addendum: useMutation({ mutationFn: (id: string) => api<NoteItem>(`/notes/${id}/addendum`, { method: 'POST' }), onSuccess: refresh }),
    discard: useMutation({ mutationFn: (id: string) => api(`/notes/${id}`, { method: 'DELETE' }), onSuccess: () => refresh() }),
  };
}

// Historia clínica
export const useHistory = (patientId: string) =>
  useQuery({ queryKey: qk.history(patientId), enabled: !!patientId, queryFn: () => api<HistoryResponse>(`/patients/${patientId}/history`) });

export function useSaveHistory(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HistoryInput) => api<{ version: number }>(`/patients/${patientId}/history`, { method: 'POST', json: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.history(patientId) });
      void qc.invalidateQueries({ queryKey: qk.patient(patientId) });
    },
  });
}

// Archivos
export const useFiles = (patientId: string) =>
  useQuery({ queryKey: qk.files(patientId), enabled: !!patientId, queryFn: () => api<FileItem[]>(`/patients/${patientId}/files`) });

export function useFileMutations(patientId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.files(patientId) });
    void qc.invalidateQueries({ queryKey: qk.patient(patientId) });
  };
  return {
    upload: useMutation({
      mutationFn: (form: FormData) => api<FileItem>(`/patients/${patientId}/files`, { method: 'POST', body: form }),
      onSuccess: refresh,
    }),
    archive: useMutation({ mutationFn: (id: string) => api(`/files/${id}/archive`, { method: 'POST' }), onSuccess: refresh }),
  };
}

// Medicamentos
export const useMedications = (patientId: string) =>
  useQuery({ queryKey: qk.medications(patientId), enabled: !!patientId, queryFn: () => api<MedicationItem[]>(`/patients/${patientId}/medications`) });

export function useMedicationMutations(patientId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.medications(patientId) });
    void qc.invalidateQueries({ queryKey: qk.patient(patientId) });
  };
  return {
    create: useMutation({
      mutationFn: (input: MedicationInput) => api(`/patients/${patientId}/medications`, { method: 'POST', json: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<MedicationInput> & { id: string; active?: boolean }) =>
        api(`/medications/${id}`, { method: 'PATCH', json: input }),
      onSuccess: refresh,
    }),
  };
}
