import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { todayISO } from '../../shared/format';
import { ApiError } from '../lib/api';
import { useNoteMutations } from '../lib/queries';

/** Crea un borrador de nota y abre el editor. */
export function useNewNote(patientId: string, hasNotes: boolean) {
  const { create } = useNoteMutations(patientId);
  const navigate = useNavigate();
  const start = async () => {
    try {
      const note = await create.mutateAsync({
        type: hasNotes ? 'evolucion' : 'primera_vez',
        modality: 'consultorio',
        visitDate: todayISO(),
      });
      void navigate({ to: '/pacientes/$patientId/notas/$noteId', params: { patientId, noteId: note.id } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo crear la nota.');
    }
  };
  return { start, pending: create.isPending };
}
