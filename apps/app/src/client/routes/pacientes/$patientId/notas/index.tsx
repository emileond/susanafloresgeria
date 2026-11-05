import { createFileRoute, Link } from '@tanstack/react-router';
import { FilePlus2, FileText, Lock } from 'lucide-react';
import { MODALITY_LABELS, NOTE_TYPE_LABELS } from '../../../../../shared/constants';
import { formatDate } from '../../../../../shared/format';
import type { NoteItem } from '../../../../../shared/types';
import { Button } from '../../../../components/ui/Button';
import { Badge, EmptyState, ErrorState } from '../../../../components/ui/misc';
import { PageLoader } from '../../../../components/ui/Spinner';
import { useNewNote } from '../../../../features/useNewNote';
import { useNotes } from '../../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/notas/')({ component: NotesList });

function excerpt(n: NoteItem): string {
  return (n.assessment || n.subjective || n.plan || n.body || '').slice(0, 220);
}

function NotesList() {
  const { patientId } = Route.useParams();
  const notes = useNotes(patientId);
  const newNote = useNewNote(patientId, (notes.data?.length ?? 0) > 0);

  if (notes.isPending) return <PageLoader />;
  if (notes.isError) return <ErrorState error={notes.error} onRetry={() => notes.refetch()} />;

  const byId = new Map(notes.data.map((n) => [n.id, n]));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-heading">Notas clínicas</h2>
        <Button onClick={newNote.start} loading={newNote.pending}>
          <FilePlus2 aria-hidden /> Nueva nota
        </Button>
      </div>

      {notes.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<FileText />} title="Sin notas todavía" text="Empiece con la nota de primera vez." action={<Button onClick={newNote.start}>Nueva nota</Button>} />
        </div>
      ) : (
        <ol className="relative mt-5 grid gap-3 border-l-2 border-line pl-5">
          {notes.data.map((n) => (
            <li key={n.id} className="relative">
              <span className={`absolute top-5 -left-[1.6rem] size-3 rounded-full ring-4 ring-white ${n.status === 'signed' ? 'bg-brand-700' : 'bg-amber-400'}`} aria-hidden />
              <Link to="/pacientes/$patientId/notas/$noteId" params={{ patientId, noteId: n.id }} className="card block p-4 transition-colors hover:border-ink/20 hover:bg-mist/40 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{NOTE_TYPE_LABELS[n.type]}</span>
                  <span className="text-muted">· {formatDate(n.visitDate)}</span>
                  <span className="text-sm text-muted">· {MODALITY_LABELS[n.modality]}</span>
                  {n.status === 'signed' ? (
                    <Badge tone="brand">
                      <Lock className="size-3" aria-hidden /> Firmada
                    </Badge>
                  ) : (
                    <Badge tone="warning">Borrador</Badge>
                  )}
                  {n.amendsNoteId && <Badge>Adenda{byId.get(n.amendsNoteId) ? ` de ${formatDate(byId.get(n.amendsNoteId)!.visitDate)}` : ''}</Badge>}
                </div>
                {excerpt(n) ? <p className="mt-2 line-clamp-2 text-ink/80">{excerpt(n)}</p> : <p className="mt-2 text-sm text-muted italic">Sin contenido aún</p>}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
