import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Check, Info, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { NOTE_TYPE_LABELS } from '../../../../../shared/constants';
import { formatDate, todayISO } from '../../../../../shared/format';
import { maxOf, missingAnswers, pointsOf, SCALES_BY_KEY, type Answers, type ScaleDefinition } from '../../../../../shared/scales';
import type { AssessmentInput } from '../../../../../shared/schemas';
import { Button } from '../../../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../../../components/ui/Field';
import { Badge, EmptyState } from '../../../../components/ui/misc';
import { ScoreGauge } from '../../../../components/scales/ScoreGauge';
import { RESPONDENT_LABELS, SEVERITY_STYLE, SEVERITY_TONE } from '../../../../features/scaleUi';
import { ApiError } from '../../../../lib/api';
import { cn } from '../../../../lib/cn';
import { useCreateAssessment, useMe, useNotes } from '../../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/escalas/$scaleKey')({ component: RunnerPage });

function RunnerPage() {
  const { patientId, scaleKey } = Route.useParams();
  const { data: me } = useMe();
  const scale = SCALES_BY_KEY[scaleKey];
  if (!scale || (me && !me.features.scales.includes(scale.key))) {
    return <EmptyState title="Escala no disponible" text="Esta escala no existe o no está habilitada." />;
  }
  return <Runner key={scale.key} scale={scale} patientId={patientId} />;
}

type AttachChoice = 'none' | 'new_note' | `note:${string}`;

function Runner({ scale, patientId }: { scale: ScaleDefinition; patientId: string }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [performedAt, setPerformedAt] = useState(todayISO());
  const [respondent, setRespondent] = useState<string>(scale.respondent);
  const [comment, setComment] = useState('');
  const notes = useNotes(patientId);
  const drafts = (notes.data ?? []).filter((n) => n.status === 'draft');
  const [attachChoice, setAttach] = useState<AttachChoice | null>(null);
  const create = useCreateAssessment(patientId);
  const navigate = useNavigate();

  const missing = missingAnswers(scale.items, answers);
  const complete = missing.length === 0;
  const result = useMemo(() => (complete ? scale.score(answers) : null), [complete, answers, scale]);
  const answered = scale.items.length - missing.length;

  // Mientras la doctora no elija otra cosa, se sugiere agregar el resultado al borrador de hoy (si existe).
  const todayDraft = drafts.find((d) => d.visitDate === todayISO());
  const attachValue: AttachChoice = attachChoice ?? (todayDraft ? `note:${todayDraft.id}` : 'none');

  const sections = [...new Set(scale.items.map((i) => i.section ?? ''))];

  const scrollToItem = (id?: string) => {
    if (id) document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /** Al responder una pregunta por primera vez, se avanza a la siguiente sin responder. */
  const choose = (itemId: string, optionIndex: number) => {
    setAnswers((prev) => {
      const next = { ...prev, [itemId]: optionIndex };
      if (prev[itemId] === undefined) {
        const idx = scale.items.findIndex((i) => i.id === itemId);
        const pending = [...scale.items.slice(idx + 1), ...scale.items.slice(0, idx)].find((i) => next[i.id] === undefined);
        if (pending) setTimeout(() => scrollToItem(pending.id), 120);
      }
      return next;
    });
  };

  const save = async () => {
    if (!complete) {
      toast.error(`Faltan ${missing.length} respuesta(s).`);
      scrollToItem(missing[0]);
      return;
    }
    const attachInput: AssessmentInput['attach'] =
      attachValue === 'none' ? { mode: 'none' } : attachValue === 'new_note' ? { mode: 'new_note' } : { mode: 'note', noteId: attachValue.slice(5) };
    try {
      const saved = await create.mutateAsync({
        scaleKey: scale.key,
        answers,
        performedAt,
        respondent: respondent as AssessmentInput['respondent'],
        comment: comment || undefined,
        attach: attachInput,
      });
      toast.success(`${scale.shortName}: ${saved.score}/${saved.maxScore} guardado${saved.noteId ? ' y agregado a la nota' : ''}`);
      void navigate({ to: '/pacientes/$patientId/escalas', params: { patientId } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    }
  };

  return (
    <div className="pb-28">
      <Link to="/pacientes/$patientId/escalas" params={{ patientId }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Escalas
      </Link>
      <h2 className="mt-3 text-xl font-bold sm:text-2xl">{scale.name}</h2>
      <p className="mt-1 text-muted">{scale.description}</p>
      {scale.notice && (
        <p className="mt-3 flex gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink/85">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden /> {scale.notice}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Fecha de aplicación">{(id) => <Input id={id} type="date" value={performedAt} max={todayISO()} onChange={(e) => setPerformedAt(e.target.value)} />}</Field>
        <Field label="Quién responde">
          {(id) => (
            <Select id={id} value={respondent} onChange={(e) => setRespondent(e.target.value)}>
              {Object.entries(RESPONDENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {sections.map((section) => {
        const sectionItems = scale.items.filter((i) => (i.section ?? '') === section);
        const subtotal = sectionItems.reduce((acc, i) => acc + pointsOf(i, answers), 0);
        const sectionDone = sectionItems.every((i) => answers[i.id] !== undefined);
        return (
          <fieldset key={section || 'all'} className="mt-6">
            {section && (
              <legend className="mb-3 flex w-full items-center justify-between gap-3">
                <span className="text-lg font-bold">{section}</span>
                <span className={cn('rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums', sectionDone ? 'bg-brand-50 text-brand-800' : 'bg-mist text-muted')}>
                  {subtotal}/{maxOf(sectionItems)}
                </span>
              </legend>
            )}
            <ol className="grid gap-3">
              {sectionItems.map((item) => {
                const idx = scale.items.indexOf(item);
                const done = answers[item.id] !== undefined;
                return (
                  <li key={item.id} id={`item-${item.id}`} className={cn('card scroll-mt-32 p-4 transition-colors sm:p-5', done && 'border-brand-100 bg-brand-50/30')}>
                    <p className="flex gap-2.5 font-semibold">
                      <span
                        className={cn(
                          'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          done ? 'bg-brand-700 text-white' : 'bg-mist text-muted',
                        )}
                        aria-hidden
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : idx + 1}
                      </span>
                      <span>{item.text}</span>
                    </p>
                    {item.help && <p className="mt-1 pl-8.5 text-sm text-muted">{item.help}</p>}
                    <div
                      role="radiogroup"
                      aria-label={item.text}
                      className={cn('mt-3 grid gap-2 sm:pl-8.5', item.options.length === 2 && item.options.every((o) => o.label.length < 6) ? 'grid-cols-2 sm:max-w-sm' : '')}
                    >
                      {item.options.map((opt, oi) => {
                        const selected = answers[item.id] === oi;
                        return (
                          <button
                            key={oi}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => choose(item.id, oi)}
                            className={cn(
                              'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[15px] transition-colors',
                              selected ? 'border-brand-700 bg-white font-semibold text-brand-800 ring-2 ring-brand-100' : 'border-line bg-white hover:border-ink/25 hover:bg-mist/60',
                            )}
                          >
                            <span className="flex items-center gap-2.5">
                              <span className={cn('inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-brand-700' : 'border-ink/25')} aria-hidden>
                                {selected && <span className="size-2 rounded-full bg-brand-700" />}
                              </span>
                              {opt.label}
                            </span>
                            <span className={cn('shrink-0 rounded-md px-1.5 text-xs font-bold tabular-nums', selected ? 'bg-brand-700 text-white' : 'bg-mist text-muted')}>{opt.value}</span>
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ol>
          </fieldset>
        );
      })}

      {/* Resultado completo al terminar */}
      {result && (
        <section aria-live="polite" className={cn('mt-8 rounded-2xl p-5 ring-1 sm:p-6', SEVERITY_STYLE[result.severity].soft, SEVERITY_STYLE[result.severity].ring)}>
          <p className="text-sm font-bold tracking-wide text-muted uppercase">Resultado</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className={cn('text-4xl font-bold tabular-nums', SEVERITY_STYLE[result.severity].text)}>
              {result.score}
              <span className="text-lg opacity-70">/{result.maxScore}</span>
            </span>
            <span className={cn('text-xl font-bold', SEVERITY_STYLE[result.severity].text)}>{result.interpretation}</span>
          </div>
          {result.details?.length ? (
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
              {result.details.map((d) => (
                <span key={d.label}>
                  {d.label}: <strong>{d.value}</strong>
                </span>
              ))}
            </p>
          ) : null}
          <ScoreGauge scale={scale} score={result.score} className="mt-4" />
        </section>
      )}

      <div className="mt-6 grid gap-4">
        <Field label="Comentario (opcional)">{(id) => <Textarea id={id} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Condiciones de aplicación, observaciones…" />}</Field>
        <Field label="Agregar el resultado a una nota" hint="El resultado se escribe al final del apartado «Objetivo» de la nota.">
          {(id) => (
            <Select id={id} value={attachValue} onChange={(e) => setAttach(e.target.value as AttachChoice)}>
              <option value="none">No agregar a una nota</option>
              <option value="new_note">Crear una nota nueva (borrador)</option>
              {drafts.map((d) => (
                <option key={d.id} value={`note:${d.id}`}>
                  Borrador: {NOTE_TYPE_LABELS[d.type]} del {formatDate(d.visitDate)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-xs text-muted">Referencia: {scale.reference}</p>
      </div>

      {/* Barra fija: progreso o puntuación en vivo */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-white/95 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="h-1 bg-mist" aria-hidden>
          <div className="h-full bg-brand-700 transition-all duration-300" style={{ width: `${(answered / scale.items.length) * 100}%` }} />
        </div>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
            {result ? (
              <>
                <span className={cn('text-2xl font-bold tabular-nums', SEVERITY_STYLE[result.severity].text)}>
                  {result.score}
                  <span className="text-base font-semibold opacity-70">/{result.maxScore}</span>
                </span>
                <Badge tone={SEVERITY_TONE[result.severity]} className="truncate text-sm">
                  {result.interpretation}
                </Badge>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold">
                  {answered} de {scale.items.length} respondidas
                </span>
                {answered > 0 && (
                  <button className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => scrollToItem(missing[0])}>
                    Ir a la siguiente pendiente
                  </button>
                )}
              </>
            )}
          </div>
          <Button onClick={save} loading={create.isPending} disabled={!complete} className="shrink-0">
            <Save aria-hidden /> <span className="hidden sm:inline">Guardar resultado</span>
            <span className="sm:hidden">Guardar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
