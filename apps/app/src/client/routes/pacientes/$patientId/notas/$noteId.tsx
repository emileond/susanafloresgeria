import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Check, FilePlus2, Lock, PenLine, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MODALITIES, MODALITY_LABELS, NOTE_TYPE_LABELS, NOTE_TYPES, VITALS, type Modality, type NoteType } from '../../../../../shared/constants';
import { formatDate, formatDateTime } from '../../../../../shared/format';
import type { NoteItem, Vitals } from '../../../../../shared/types';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../../../../components/ui/Field';
import { Badge, ErrorState } from '../../../../components/ui/misc';
import { PageLoader, Spinner } from '../../../../components/ui/Spinner';
import { ApiError } from '../../../../lib/api';
import { useNote, useNoteMutations, useNotes } from '../../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/notas/$noteId')({ component: NotePage });

const SOAP = [
  { key: 'subjective', label: 'Subjetivo', hint: 'Motivo de consulta, síntomas y lo que refieren el paciente y la familia.' },
  { key: 'objective', label: 'Objetivo', hint: 'Exploración física, hallazgos y resultados.' },
  { key: 'assessment', label: 'Análisis / diagnóstico', hint: 'Impresión diagnóstica y problemas activos.' },
  { key: 'plan', label: 'Plan', hint: 'Tratamiento, indicaciones, estudios y seguimiento.' },
] as const;
type SoapKey = (typeof SOAP)[number]['key'] | 'body';

interface Draft {
  type: NoteType;
  modality: Modality;
  visitDate: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  body: string;
  vitals: Vitals;
}

const toDraft = (n: NoteItem): Draft => ({
  type: n.type,
  modality: n.modality,
  visitDate: n.visitDate,
  subjective: n.subjective ?? '',
  objective: n.objective ?? '',
  assessment: n.assessment ?? '',
  plan: n.plan ?? '',
  body: n.body ?? '',
  vitals: n.vitals ?? {},
});

function NotePage() {
  const { patientId, noteId } = Route.useParams();
  const note = useNote(noteId);
  if (note.isPending) return <PageLoader />;
  if (note.isError) return <ErrorState error={note.error} onRetry={() => note.refetch()} />;
  return note.data.status === 'signed' ? (
    <SignedNote note={note.data} patientId={patientId} />
  ) : (
    <NoteEditor key={note.data.id} note={note.data} patientId={patientId} />
  );
}

function BackToNotes({ patientId }: { patientId: string }) {
  return (
    <Link to="/pacientes/$patientId/notas" params={{ patientId }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Todas las notas
    </Link>
  );
}

/** Editor de borrador con autoguardado. */
function NoteEditor({ note, patientId }: { note: NoteItem; patientId: string }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(note));
  const [dirty, setDirty] = useState(false);
  const [confirmSign, setConfirmSign] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showExtra, setShowExtra] = useState(Boolean(note.body));
  const m = useNoteMutations(patientId);
  const navigate = useNavigate();
  const latest = useRef(draft);
  latest.current = draft;

  const save = async () => {
    const d = latest.current;
    const vitals = Object.fromEntries(Object.entries(d.vitals).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v)));
    await m.update.mutateAsync({ id: note.id, ...d, vitals });
    setDirty(false);
  };

  // Autoguardado 1.2 s después de dejar de escribir.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      save().catch((err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar el borrador.'));
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty]);

  // Aviso si intenta salir con cambios sin guardar.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const sign = async () => {
    try {
      if (dirty) await save();
      await m.sign.mutateAsync(note.id);
      toast.success('Nota firmada');
      setConfirmSign(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo firmar la nota.');
    }
  };

  const discard = async () => {
    try {
      await m.discard.mutateAsync(note.id);
      toast.success('Borrador descartado');
      void navigate({ to: '/pacientes/$patientId/notas', params: { patientId } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo descartar.');
    }
  };

  const saving = m.update.isPending;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackToNotes patientId={patientId} />
        <span className="inline-flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
          {saving ? (
            <>
              <Spinner className="size-3.5" /> Guardando…
            </>
          ) : dirty ? (
            'Cambios sin guardar'
          ) : (
            <>
              <Check className="size-4 text-emerald-600" aria-hidden /> Borrador guardado
            </>
          )}
        </span>
      </div>

      {note.amendsNoteId && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta es una <strong>adenda</strong>. Complementa o corrige{' '}
          <Link to="/pacientes/$patientId/notas/$noteId" params={{ patientId, noteId: note.amendsNoteId }} className="font-semibold underline">
            la nota firmada original
          </Link>
          .
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Tipo de nota">
          {(id) => (
            <Select id={id} value={draft.type} onChange={(e) => set('type', e.target.value as NoteType)}>
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {NOTE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Modalidad">
          {(id) => (
            <Select id={id} value={draft.modality} onChange={(e) => set('modality', e.target.value as Modality)}>
              {MODALITIES.map((t) => (
                <option key={t} value={t}>
                  {MODALITY_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fecha de la consulta">{(id) => <Input id={id} type="date" value={draft.visitDate} onChange={(e) => set('visitDate', e.target.value)} />}</Field>
      </div>

      <fieldset className="mt-6">
        <legend className="field-label">Signos vitales</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {VITALS.map((v) => (
            <label key={v.key} className="block">
              <span className="text-xs font-semibold text-muted">
                {v.label} <span className="font-normal">({v.unit})</span>
              </span>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                className="mt-1"
                value={draft.vitals[v.key] ?? ''}
                onChange={(e) => set('vitals', { ...draft.vitals, [v.key]: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-5">
        {SOAP.map((s) => (
          <Field key={s.key} label={s.label} hint={s.hint}>
            {(id) => <Textarea id={id} rows={4} value={draft[s.key]} onChange={(e) => set(s.key as SoapKey, e.target.value)} />}
          </Field>
        ))}
        {showExtra ? (
          <Field label="Notas adicionales">{(id) => <Textarea id={id} rows={4} value={draft.body} onChange={(e) => set('body', e.target.value)} />}</Field>
        ) : (
          <button className="justify-self-start text-sm font-semibold text-brand-700 hover:underline" onClick={() => setShowExtra(true)}>
            + Agregar notas adicionales
          </button>
        )}
      </div>

      <div className="sticky bottom-20 z-10 mt-8 flex flex-col-reverse gap-2 rounded-2xl border border-line bg-white/95 p-3 backdrop-blur sm:flex-row sm:justify-between lg:bottom-4">
        <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
          <Trash2 aria-hidden /> Descartar borrador
        </Button>
        <Button onClick={() => setConfirmSign(true)}>
          <PenLine aria-hidden /> Firmar nota
        </Button>
      </div>

      <Dialog
        open={confirmSign}
        onOpenChange={setConfirmSign}
        title="¿Firmar esta nota?"
        description="Una vez firmada no podrá modificarse. Las correcciones se hacen agregando una adenda."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmSign(false)}>
              Seguir editando
            </Button>
            <Button onClick={sign} loading={m.sign.isPending}>
              <Lock aria-hidden /> Firmar
            </Button>
          </>
        }
      >
        <p className="text-muted">
          {NOTE_TYPE_LABELS[draft.type]} del {formatDate(draft.visitDate)} · {MODALITY_LABELS[draft.modality]}
        </p>
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="¿Descartar el borrador?"
        description="Se eliminará este borrador. Las notas firmadas no se ven afectadas."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={discard} loading={m.discard.isPending}>
              Descartar
            </Button>
          </>
        }
      >
        <p className="text-muted">Esta acción no se puede deshacer.</p>
      </Dialog>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <section>
      <h3 className="text-sm font-bold tracking-wide text-brand-700 uppercase">{title}</h3>
      <p className="mt-1.5 leading-relaxed whitespace-pre-line">{text}</p>
    </section>
  );
}

/** Vista de nota firmada (solo lectura) con sus adendas. */
function SignedNote({ note, patientId }: { note: NoteItem; patientId: string }) {
  const m = useNoteMutations(patientId);
  const all = useNotes(patientId);
  const navigate = useNavigate();
  const addenda = (all.data ?? []).filter((n) => n.amendsNoteId === note.id);
  const vitals = VITALS.filter((v) => note.vitals?.[v.key] !== undefined);

  const addAddendum = async () => {
    try {
      const created = await m.addendum.mutateAsync(note.id);
      void navigate({ to: '/pacientes/$patientId/notas/$noteId', params: { patientId, noteId: created.id } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo crear la adenda.');
    }
  };

  return (
    <div>
      <BackToNotes patientId={patientId} />
      <article className="card mt-4 p-5 sm:p-7">
        <header className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xl font-bold">{NOTE_TYPE_LABELS[note.type]}</p>
            <p className="mt-0.5 text-muted">
              {formatDate(note.visitDate, { dateStyle: 'full' })} · {MODALITY_LABELS[note.modality]}
            </p>
          </div>
          <Badge tone="brand" className="self-start text-sm">
            <Lock className="size-3.5" aria-hidden /> Firmada {note.signedAt ? formatDateTime(note.signedAt) : ''}
            {note.signedByName ? ` · ${note.signedByName}` : ''}
          </Badge>
        </header>

        {note.amendsNoteId && (
          <p className="mt-4 text-sm text-muted">
            Adenda de{' '}
            <Link to="/pacientes/$patientId/notas/$noteId" params={{ patientId, noteId: note.amendsNoteId }} className="font-semibold text-brand-700 underline">
              la nota original
            </Link>
            .
          </p>
        )}

        {vitals.length > 0 && (
          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-mist p-4 sm:grid-cols-4">
            {vitals.map((v) => (
              <div key={v.key}>
                <dt className="text-xs font-semibold text-muted">{v.label}</dt>
                <dd className="font-semibold">
                  {note.vitals?.[v.key]} <span className="text-sm font-normal text-muted">{v.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 grid gap-5">
          <Section title="Subjetivo" text={note.subjective} />
          <Section title="Objetivo" text={note.objective} />
          <Section title="Análisis / diagnóstico" text={note.assessment} />
          <Section title="Plan" text={note.plan} />
          <Section title="Notas adicionales" text={note.body} />
        </div>
      </article>

      {addenda.length > 0 && (
        <div className="mt-4 grid gap-2">
          <p className="text-sm font-bold">Adendas</p>
          {addenda.map((a) => (
            <Link key={a.id} to="/pacientes/$patientId/notas/$noteId" params={{ patientId, noteId: a.id }} className="card flex items-center justify-between p-4 hover:bg-mist/50">
              <span>
                Adenda del {formatDate(a.visitDate)} {a.status === 'draft' && <Badge tone="warning">Borrador</Badge>}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button variant="secondary" onClick={addAddendum} loading={m.addendum.isPending}>
          <FilePlus2 aria-hidden /> Agregar adenda
        </Button>
      </div>
    </div>
  );
}
