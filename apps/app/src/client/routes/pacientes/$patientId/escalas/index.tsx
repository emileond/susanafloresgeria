import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, ClipboardList, Clock, FileText, Play, RotateCcw, UserRound } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '../../../../../shared/format';
import { SCALES, SCALES_BY_KEY, type ScaleDefinition } from '../../../../../shared/scales';
import type { AssessmentItem } from '../../../../../shared/types';
import { ScoreGauge } from '../../../../components/scales/ScoreGauge';
import { ScoreHistory } from '../../../../components/scales/ScoreHistory';
import { Dialog } from '../../../../components/ui/Dialog';
import { EmptyState, ErrorState } from '../../../../components/ui/misc';
import { PageLoader } from '../../../../components/ui/Spinner';
import { DOMAIN_ICON, RESPONDENT_LABELS, SEVERITY_STYLE } from '../../../../features/scaleUi';
import { cn } from '../../../../lib/cn';
import { useAssessments, useMe } from '../../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/escalas/')({ component: ScalesPage });

/** Compara el último resultado con el anterior, considerando si "más es mejor" en la escala. */
function Trend({ scale, results }: { scale: ScaleDefinition; results: AssessmentItem[] }) {
  if (results.length < 2) return <span className="text-xs text-muted">Primera aplicación</span>;
  const [last, prev] = results as [AssessmentItem, AssessmentItem];
  const diff = last.score - prev.score;
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
        <ArrowRight className="size-3.5" aria-hidden /> Sin cambio vs. {formatDate(prev.performedAt)}
      </span>
    );
  const better = scale.higherIsBetter ? diff > 0 : diff < 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', better ? 'text-emerald-700' : 'text-red-700')}>
      <Icon className="size-3.5" aria-hidden />
      {better ? 'Mejoró' : 'Empeoró'} {diff > 0 ? '+' : ''}
      {diff} vs. {formatDate(prev.performedAt)}
    </span>
  );
}

function ScoreBadge({ a, size = 'md' }: { a: AssessmentItem; size?: 'md' | 'lg' }) {
  const s = SEVERITY_STYLE[a.severity];
  return (
    <span className={cn('inline-flex items-baseline rounded-xl px-2.5 py-1 font-bold tabular-nums ring-1', s.soft, s.text, s.ring, size === 'lg' ? 'text-2xl' : 'text-base')}>
      {a.score}
      <span className={cn('font-semibold opacity-70', size === 'lg' ? 'text-sm' : 'text-xs')}>/{a.maxScore}</span>
    </span>
  );
}

function ScalesPage() {
  const { patientId } = Route.useParams();
  const { data: me } = useMe();
  const list = useAssessments(patientId);
  const [viewing, setViewing] = useState<AssessmentItem | null>(null);
  const enabled = SCALES.filter((s) => me?.features.scales.includes(s.key));

  if (list.isPending) return <PageLoader />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;

  const byScale = new Map<string, AssessmentItem[]>();
  for (const a of list.data) byScale.set(a.scaleKey, [...(byScale.get(a.scaleKey) ?? []), a]);
  const domains = [...new Set(enabled.map((s) => s.domain))];

  return (
    <div className="grid gap-10">
      {/* Resultados más recientes: lo primero que la doctora necesita ver */}
      {list.data.length > 0 && (
        <section aria-labelledby="resultados">
          <h2 id="resultados" className="section-heading">
            Resultados
          </h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {[...byScale.entries()].map(([key, results]) => {
              const scale = SCALES_BY_KEY[key];
              if (!scale) return null;
              const last = results[0]!;
              const s = SEVERITY_STYLE[last.severity];
              return (
                <article key={key} className="card flex flex-col overflow-hidden">
                  <div className={cn('h-1.5', s.bar)} aria-hidden />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold">{scale.shortName}</h3>
                        <p className="text-xs text-muted">
                          {formatDate(last.performedAt)} · {RESPONDENT_LABELS[last.respondent ?? ''] ?? ''}
                        </p>
                      </div>
                      <ScoreBadge a={last} size="lg" />
                    </div>
                    <p className={cn('mt-3 text-[15px] font-bold', s.text)}>{last.interpretation}</p>
                    {last.details && last.details.length > 0 && (
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
                        {last.details.map((d) => (
                          <span key={d.label}>
                            {d.label}: <strong className="text-ink">{d.value}</strong>
                          </span>
                        ))}
                      </p>
                    )}
                    <ScoreGauge scale={scale} score={last.score} showLegend={false} className="mt-3" />
                    <div className="mt-2">
                      <Trend scale={scale} results={results} />
                    </div>
                    {results.length > 1 && (
                      <div className="mt-3 rounded-xl bg-mist/60 p-2">
                        <ScoreHistory scale={scale} results={results} />
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                      <button onClick={() => setViewing(last)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                        Ver respuestas <ChevronRight className="size-4" aria-hidden />
                      </button>
                      <Link
                        to="/pacientes/$patientId/escalas/$scaleKey"
                        params={{ patientId, scaleKey: key }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-mist"
                      >
                        <RotateCcw className="size-4 text-brand-700" aria-hidden /> Aplicar de nuevo
                      </Link>
                    </div>
                    {results.length > 1 && (
                      <details className="mt-3 border-t border-line pt-3">
                        <summary className="cursor-pointer text-sm font-semibold text-muted">Historial ({results.length})</summary>
                        <ul className="mt-2 divide-y divide-line">
                          {results.map((a) => (
                            <li key={a.id}>
                              <button onClick={() => setViewing(a)} className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-mist/50">
                                <span className="w-24 shrink-0 text-muted">{formatDate(a.performedAt)}</span>
                                <ScoreBadge a={a} />
                                <span className="min-w-0 flex-1 truncate">{a.interpretation}</span>
                                {a.noteId && <FileText className="size-4 shrink-0 text-brand-700" aria-label="Registrado en una nota" />}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="aplicar">
        <h2 id="aplicar" className="section-heading">
          {list.data.length ? 'Aplicar otra escala' : 'Aplicar una escala'}
        </h2>
        {list.data.length === 0 && (
          <div className="mt-3">
            <EmptyState icon={<ClipboardList />} title="Aún no hay escalas aplicadas" text="Elija una escala; el resultado queda en el expediente y puede agregarse a una nota." />
          </div>
        )}
        <div className="mt-4 grid gap-6">
          {domains.map((d) => {
            const Icon = DOMAIN_ICON[d];
            return (
              <div key={d}>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink/80">
                  <span className="inline-flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {d}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {enabled
                    .filter((s) => s.domain === d)
                    .map((s) => {
                      const last = byScale.get(s.key)?.[0];
                      return (
                        <Link
                          key={s.key}
                          to="/pacientes/$patientId/escalas/$scaleKey"
                          params={{ patientId, scaleKey: s.key }}
                          className="group card flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_6px_20px_-12px_rgba(83,65,196,0.5)]"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-bold">{s.shortName}</span>
                            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
                              <Play className="size-3.5 translate-x-px" aria-hidden />
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</span>
                          <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3.5" aria-hidden /> {s.minutes} min
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="size-3.5" aria-hidden /> {RESPONDENT_LABELS[s.respondent]}
                            </span>
                            {last && (
                              <span className={cn('font-semibold', SEVERITY_STYLE[last.severity].text)}>
                                Último: {last.score}/{last.maxScore} · {formatDate(last.performedAt)}
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {viewing && <AssessmentDialog a={viewing} patientId={patientId} onClose={() => setViewing(null)} />}
    </div>
  );
}

function AssessmentDialog({ a, patientId, onClose }: { a: AssessmentItem; patientId: string; onClose: () => void }) {
  const scale = SCALES_BY_KEY[a.scaleKey];
  const s = SEVERITY_STYLE[a.severity];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={scale?.name ?? a.scaleKey}
      description={`${formatDate(a.performedAt, { dateStyle: 'long' })} · ${RESPONDENT_LABELS[a.respondent ?? ''] ?? ''}${a.createdByName ? ` · aplicó ${a.createdByName}` : ''}`}
    >
      <div className={cn('rounded-2xl p-4 ring-1', s.soft, s.ring)}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className={cn('text-4xl font-bold tabular-nums', s.text)}>
            {a.score}
            <span className="text-lg opacity-70">/{a.maxScore}</span>
          </span>
          <span className={cn('text-lg font-bold', s.text)}>{a.interpretation}</span>
        </div>
        {a.details?.length ? (
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
            {a.details.map((d) => (
              <span key={d.label}>
                {d.label}: <strong>{d.value}</strong>
              </span>
            ))}
          </p>
        ) : null}
        {scale && <ScoreGauge scale={scale} score={a.score} className="mt-3" />}
      </div>
      {a.comment && <p className="mt-4 rounded-xl border border-line p-3 text-sm">{a.comment}</p>}
      {a.noteId && (
        <Link to="/pacientes/$patientId/notas/$noteId" params={{ patientId, noteId: a.noteId }} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
          <FileText className="size-4" aria-hidden /> Ver la nota donde se registró
        </Link>
      )}
      {scale && (
        <>
          <p className="mt-6 mb-2 text-sm font-bold">Respuestas</p>
          <ol className="grid gap-1.5">
            {scale.items.map((item, i) => {
              const opt = item.options[a.answers[item.id] ?? -1];
              const best = Math.max(...item.options.map((o) => o.value));
              const worst = Math.min(...item.options.map((o) => o.value));
              // Resalta los ítems que alejan del resultado ideal.
              const deficit = opt && (scale.higherIsBetter ? opt.value < best : opt.value > worst);
              return (
                <li key={item.id} className={cn('flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm', deficit ? 'bg-amber-50' : 'bg-mist/50')}>
                  <span>
                    <span className="font-semibold">
                      {i + 1}. {item.text}
                    </span>
                    <span className="block text-ink/75">{opt?.label ?? '—'}</span>
                  </span>
                  <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-bold', deficit ? 'bg-amber-200/70 text-amber-900' : 'bg-white text-muted')}>{opt?.value ?? '—'}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-muted">Referencia: {scale.reference}</p>
        </>
      )}
    </Dialog>
  );
}
