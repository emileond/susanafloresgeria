import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ClipboardList, Clock, FileText } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '../../../../../shared/format';
import { SCALES, SCALES_BY_KEY, type ScaleDefinition } from '../../../../../shared/scales';
import type { AssessmentItem } from '../../../../../shared/types';
import { Dialog } from '../../../../components/ui/Dialog';
import { Badge, EmptyState, ErrorState } from '../../../../components/ui/misc';
import { PageLoader } from '../../../../components/ui/Spinner';
import { RESPONDENT_LABELS, SEVERITY_TONE } from '../../../../features/scaleUi';
import { useAssessments, useMe } from '../../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/escalas/')({ component: ScalesPage });

function Trend({ scale, results }: { scale: ScaleDefinition; results: AssessmentItem[] }) {
  if (results.length < 2) return null;
  const [last, prev] = results as [AssessmentItem, AssessmentItem];
  if (last.score === prev.score) return <span className="inline-flex items-center gap-0.5 text-xs text-muted"><ArrowRight className="size-3.5" aria-hidden /> Sin cambio</span>;
  const better = scale.higherIsBetter ? last.score > prev.score : last.score < prev.score;
  const Icon = last.score > prev.score ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${better ? 'text-emerald-700' : 'text-red-700'}`}>
      <Icon className="size-3.5" aria-hidden /> {better ? 'Mejoró' : 'Empeoró'} vs. {prev.score}
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
    <div className="grid gap-8">
      <section aria-labelledby="aplicar">
        <h2 id="aplicar" className="section-heading">
          Aplicar una escala
        </h2>
        <div className="mt-3 grid gap-5">
          {domains.map((d) => (
            <div key={d}>
              <p className="mb-2 text-sm font-semibold text-muted">{d}</p>
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
                        className="card flex flex-col p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-bold">{s.shortName}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <Clock className="size-3.5" aria-hidden /> {s.minutes} min
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</span>
                        {last ? (
                          <span className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                            <Badge tone={SEVERITY_TONE[last.severity]}>
                              {last.score}/{last.maxScore}
                            </Badge>
                            <span className="text-muted">{formatDate(last.performedAt)}</span>
                          </span>
                        ) : (
                          <span className="mt-3 text-sm text-muted">No aplicada</span>
                        )}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="resultados">
        <h2 id="resultados" className="section-heading">
          Resultados
        </h2>
        {list.data.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={<ClipboardList />} title="Aún no hay escalas aplicadas" text="Los resultados quedan en el expediente y pueden agregarse a una nota." />
          </div>
        ) : (
          <div className="mt-3 grid gap-4">
            {[...byScale.entries()].map(([key, results]) => {
              const scale = SCALES_BY_KEY[key];
              if (!scale) return null;
              return (
                <div key={key} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-mist/50 px-4 py-2.5">
                    <span className="font-bold">{scale.shortName}</span>
                    <Trend scale={scale} results={results} />
                  </div>
                  <ul className="divide-y divide-line">
                    {results.map((a) => (
                      <li key={a.id}>
                        <button onClick={() => setViewing(a)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-mist/50">
                          <span className="w-28 text-sm text-muted">{formatDate(a.performedAt)}</span>
                          <Badge tone={SEVERITY_TONE[a.severity]} className="text-sm">
                            {a.score}/{a.maxScore}
                          </Badge>
                          <span className="flex-1 font-medium">{a.interpretation}</span>
                          {a.details?.map((d) => (
                            <span key={d.label} className="text-sm text-muted">
                              {d.label}: {d.value}
                            </span>
                          ))}
                          {a.noteId && <FileText className="size-4 text-brand-700" aria-label="Agregado a una nota" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {viewing && <AssessmentDialog a={viewing} patientId={patientId} onClose={() => setViewing(null)} />}
    </div>
  );
}

function AssessmentDialog({ a, patientId, onClose }: { a: AssessmentItem; patientId: string; onClose: () => void }) {
  const scale = SCALES_BY_KEY[a.scaleKey];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={scale?.name ?? a.scaleKey}
      description={`${formatDate(a.performedAt)} · ${RESPONDENT_LABELS[a.respondent ?? ''] ?? ''}${a.createdByName ? ` · ${a.createdByName}` : ''}`}
    >
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-mist p-4">
        <span className="text-3xl font-bold">
          {a.score}
          <span className="text-lg font-semibold text-muted">/{a.maxScore}</span>
        </span>
        <Badge tone={SEVERITY_TONE[a.severity]} className="text-sm">
          {a.interpretation}
        </Badge>
        {a.details?.map((d) => (
          <span key={d.label} className="text-sm text-muted">
            {d.label}: <strong className="text-ink">{d.value}</strong>
          </span>
        ))}
      </div>
      {a.comment && <p className="mt-4 rounded-xl border border-line p-3 text-sm">{a.comment}</p>}
      {a.noteId && (
        <Link to="/pacientes/$patientId/notas/$noteId" params={{ patientId, noteId: a.noteId }} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
          <FileText className="size-4" aria-hidden /> Ver la nota donde se registró
        </Link>
      )}
      {scale && (
        <ol className="mt-5 grid gap-2">
          {scale.items.map((item) => {
            const opt = item.options[a.answers[item.id] ?? -1];
            return (
              <li key={item.id} className="flex items-start justify-between gap-3 border-b border-line pb-2 text-sm last:border-0">
                <span>
                  <span className="font-semibold">{item.text}</span>
                  <span className="block text-muted">{opt?.label ?? '—'}</span>
                </span>
                <span className="shrink-0 font-semibold">{opt?.value ?? '—'}</span>
              </li>
            );
          })}
        </ol>
      )}
      {scale && <p className="mt-4 text-xs text-muted">Referencia: {scale.reference}</p>}
    </Dialog>
  );
}
