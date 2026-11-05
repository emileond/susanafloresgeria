import { Check, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { NOTE_TYPE_LABELS } from '../../shared/constants';
import { formatDate } from '../../shared/format';
import { HISTORY_SECTIONS, type HistoryData, type HistorySectionKey } from '../../shared/history';
import type { AiHistoryDraft } from '../../shared/types';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Textarea } from '../components/ui/Field';
import { Badge } from '../components/ui/misc';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { useAiHistoryDraft, useNotes, useSaveHistory } from '../lib/queries';

/** Paso 1: elegir las notas que el asistente leerá. */
export function AiSelectDialog({ patientId, open, onOpenChange, onDraft }: { patientId: string; open: boolean; onOpenChange: (o: boolean) => void; onDraft: (d: AiHistoryDraft) => void }) {
  const notes = useNotes(patientId);
  const draft = useAiHistoryDraft(patientId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Por defecto: las notas firmadas más recientes (hasta 30).
  useEffect(() => {
    if (open && notes.data) setSelected(new Set(notes.data.filter((n) => n.status === 'signed').slice(0, 30).map((n) => n.id)));
  }, [open, notes.data]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generate = async () => {
    try {
      const result = await draft.mutateAsync([...selected]);
      if (Object.keys(result.proposals).length === 0) {
        toast.info('El asistente no encontró información nueva para la historia clínica.');
        return;
      }
      onDraft(result);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo generar la propuesta.');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !draft.isPending && onOpenChange(o)}
      size="lg"
      title="Completar historia clínica con IA"
      description="El asistente lee las notas seleccionadas y propone el contenido de cada sección. Usted revisa y decide qué guardar."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={draft.isPending}>
            Cancelar
          </Button>
          <Button onClick={generate} loading={draft.isPending} disabled={selected.size === 0}>
            <Sparkles aria-hidden /> {draft.isPending ? 'Generando propuesta…' : 'Generar propuesta'}
          </Button>
        </>
      }
    >
      <p className="flex gap-2.5 rounded-xl bg-mist p-3.5 text-sm text-ink/85">
        <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-brand-700" aria-hidden />
        Se envía solo el texto clínico de las notas, sin nombre, CURP, teléfonos ni correos. Nada se guarda hasta que usted lo acepte.
      </p>
      <p className="mt-5 mb-2 text-sm font-semibold">
        Notas a considerar ({selected.size} de {notes.data?.length ?? 0})
      </p>
      <ul className="grid max-h-72 grid-cols-1 gap-1.5 overflow-x-hidden overflow-y-auto">
        {(notes.data ?? []).map((n) => (
          <li key={n.id} className="min-w-0">
            <label className={cn('flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5', selected.has(n.id) ? 'border-brand-300 bg-brand-50/60' : 'border-line')}>
              <input type="checkbox" className="mt-1 size-4 accent-brand-700" checked={selected.has(n.id)} onChange={() => toggle(n.id)} />
              <span className="min-w-0">
                <span className="block font-semibold">
                  {NOTE_TYPE_LABELS[n.type]} · {formatDate(n.visitDate)} {n.status === 'draft' && <Badge tone="warning">Borrador</Badge>}
                </span>
                <span className="block truncate text-sm text-muted">{n.assessment || n.subjective || n.plan || n.body || 'Sin contenido'}</span>
              </span>
            </label>
          </li>
        ))}
        {notes.data?.length === 0 && <li className="text-sm text-muted">Este paciente aún no tiene notas.</li>}
      </ul>
    </Dialog>
  );
}

type Decision = 'accepted' | 'discarded' | undefined;

/** Paso 2: revisar la propuesta sección por sección. */
export function AiReview({ patientId, draft, current, onDone }: { patientId: string; draft: AiHistoryDraft; current: HistoryData; onDone: () => void }) {
  const save = useSaveHistory(patientId);
  const keys = HISTORY_SECTIONS.map((s) => s.key).filter((k) => draft.proposals[k]);
  const [texts, setTexts] = useState<Partial<Record<HistorySectionKey, string>>>(() => Object.fromEntries(keys.map((k) => [k, draft.proposals[k] ?? ''])));
  const [decisions, setDecisions] = useState<Partial<Record<HistorySectionKey, Decision>>>({});
  const accepted = keys.filter((k) => decisions[k] === 'accepted');
  const pending = keys.filter((k) => !decisions[k]);

  const submit = async () => {
    const data: HistoryData = { ...current };
    for (const k of accepted) data[k] = texts[k];
    try {
      const { version } = await save.mutateAsync({ data, source: 'ai_assisted' });
      toast.success(`Historia clínica guardada (versión ${version})`);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    }
  };

  return (
    <div className="mt-5">
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 sm:p-5">
        <p className="flex items-center gap-2 font-bold text-brand-800">
          <Sparkles className="size-5" aria-hidden /> Propuesta del asistente
        </p>
        <p className="mt-1 text-sm text-ink/80">
          Basada en {draft.notesUsed} nota(s). Revise cada sección: puede editar el texto, aceptarlo o descartarlo. Solo se guardan las secciones aceptadas, como una versión nueva.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDecisions(Object.fromEntries(keys.map((k) => [k, 'accepted'])))}>
            Aceptar todas
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Descartar propuesta
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {keys.map((k) => {
          const section = HISTORY_SECTIONS.find((s) => s.key === k)!;
          const d = decisions[k];
          return (
            <section key={k} className={cn('card p-5', d === 'accepted' && 'border-emerald-300 bg-emerald-50/40', d === 'discarded' && 'opacity-60')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[15px] font-bold">{section.label}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant={d === 'accepted' ? 'primary' : 'secondary'} aria-pressed={d === 'accepted'} onClick={() => setDecisions((x) => ({ ...x, [k]: 'accepted' }))}>
                    <Check aria-hidden /> Aceptar
                  </Button>
                  <Button size="sm" variant="ghost" aria-pressed={d === 'discarded'} onClick={() => setDecisions((x) => ({ ...x, [k]: 'discarded' }))}>
                    <X aria-hidden /> Descartar
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">Actual</p>
                  <p className="mt-1 rounded-xl bg-mist p-3 text-sm whitespace-pre-line text-ink/80">{current[k]?.trim() || 'Sin información'}</p>
                </div>
                <div>
                  <label htmlFor={`ai-${k}`} className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
                    Propuesta (editable)
                  </label>
                  <Textarea id={`ai-${k}`} className="mt-1 text-sm" rows={4} value={texts[k] ?? ''} disabled={d === 'discarded'} onChange={(e) => setTexts((t) => ({ ...t, [k]: e.target.value }))} />
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-20 z-10 mt-6 flex flex-col gap-2 rounded-2xl border border-line bg-white/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <p className="px-1 text-sm text-muted">
          {accepted.length} aceptada(s) · {pending.length} por revisar
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={save.isPending} disabled={accepted.length === 0}>
            Guardar versión ({accepted.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
