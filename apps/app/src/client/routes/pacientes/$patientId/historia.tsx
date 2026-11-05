import { createFileRoute } from '@tanstack/react-router';
import { History, PenLine, Save, ScrollText, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatDateTime } from '../../../../shared/format';
import { HISTORY_SECTIONS, type HistoryData, type HistorySectionKey } from '../../../../shared/history';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Field';
import { Badge, EmptyState, ErrorState } from '../../../components/ui/misc';
import { PageLoader } from '../../../components/ui/Spinner';
import { ApiError } from '../../../lib/api';
import { useHistory, useSaveHistory } from '../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/historia')({ component: HistoryPage });

function HistoryPage() {
  const { patientId } = Route.useParams();
  const history = useHistory(patientId);
  const save = useSaveHistory(patientId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HistoryData>({});
  const [showVersions, setShowVersions] = useState(false);

  if (history.isPending) return <PageLoader />;
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  const current = history.data.current;

  const startEditing = () => {
    setDraft({ ...(current?.data ?? {}) });
    setEditing(true);
  };

  const onSave = async () => {
    try {
      const { version } = await save.mutateAsync({ data: draft, source: 'manual' });
      toast.success(`Historia clínica guardada (versión ${version})`);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    }
  };

  const filled = HISTORY_SECTIONS.filter((s) => current?.data[s.key]?.trim()).length;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-heading">Historia clínica</h2>
          {current ? (
            <p className="text-sm text-muted">
              Versión {current.version} · {formatDateTime(current.createdAt)}
              {current.createdByName ? ` · ${current.createdByName}` : ''} · {filled}/{HISTORY_SECTIONS.length} secciones
              {current.source === 'ai_assisted' && (
                <Badge tone="brand" className="ml-2">
                  <Sparkles className="size-3" aria-hidden /> Con asistencia de IA
                </Badge>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted">Aún no se ha capturado.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && history.data.versions.length > 1 && (
            <Button variant="ghost" onClick={() => setShowVersions((v) => !v)}>
              <History aria-hidden /> Versiones ({history.data.versions.length})
            </Button>
          )}
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={onSave} loading={save.isPending}>
                <Save aria-hidden /> Guardar versión
              </Button>
            </>
          ) : (
            <Button onClick={startEditing}>
              <PenLine aria-hidden /> {current ? 'Editar' : 'Capturar historia'}
            </Button>
          )}
        </div>
      </div>

      {showVersions && !editing && (
        <ul className="card mt-4 divide-y divide-line text-sm">
          {history.data.versions.map((v) => (
            <li key={v.version} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <span className="font-semibold">Versión {v.version}</span>
              <span className="text-muted">
                {formatDateTime(v.createdAt)}
                {v.createdByName ? ` · ${v.createdByName}` : ''}
              </span>
              {v.source === 'ai_assisted' && <Badge tone="brand">IA</Badge>}
            </li>
          ))}
        </ul>
      )}

      {!current && !editing ? (
        <div className="mt-5">
          <EmptyState
            icon={<ScrollText />}
            title="Sin historia clínica"
            text="Capture los antecedentes, el padecimiento actual, la exploración y el plan. Cada guardado crea una versión nueva."
            action={<Button onClick={startEditing}>Capturar historia</Button>}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {HISTORY_SECTIONS.map((s) => {
            const value = editing ? draft[s.key] ?? '' : current?.data[s.key] ?? '';
            if (!editing && !value.trim()) {
              return (
                <section key={s.key} className="rounded-2xl border border-dashed border-line px-5 py-3.5">
                  <h3 className="text-[15px] font-bold text-muted">{s.label}</h3>
                  <p className="text-sm text-muted/80">Sin información</p>
                </section>
              );
            }
            return (
              <section key={s.key} className="card p-5">
                <label htmlFor={`h-${s.key}`} className="block text-[15px] font-bold">
                  {s.label}
                </label>
                {editing ? (
                  <>
                    <p className="mt-0.5 text-sm text-muted">{s.hint}</p>
                    <Textarea
                      id={`h-${s.key}`}
                      className="mt-2"
                      rows={3}
                      value={value}
                      onChange={(e) => setDraft((d) => ({ ...d, [s.key as HistorySectionKey]: e.target.value }))}
                    />
                  </>
                ) : (
                  <p className="mt-1.5 leading-relaxed whitespace-pre-line">{value}</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
