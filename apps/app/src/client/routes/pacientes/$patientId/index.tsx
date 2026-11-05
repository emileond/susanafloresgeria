import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, ChevronRight, ClipboardList, FileText, Phone, Pill, ScrollText, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { NOTE_TYPE_LABELS } from '../../../../shared/constants';
import { formatDate } from '../../../../shared/format';
import { SCALES_BY_KEY } from '../../../../shared/scales';
import { Badge } from '../../../components/ui/misc';
import { ScoreGauge } from '../../../components/scales/ScoreGauge';
import { SEVERITY_STYLE } from '../../../features/scaleUi';
import { useAssessments, useMe, useMedications, useNotes, usePatient, usePatientAppointments } from '../../../lib/queries';
import { hhmm, zonedParts } from '../../../../shared/time';
import { MODALITY_LABELS } from '../../../../shared/constants';

export const Route = createFileRoute('/pacientes/$patientId/')({ component: Summary });

function Card({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold [&_svg]:size-5 [&_svg]:text-brand-700">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const seeAll = (to: string, patientId: string, label = 'Ver todo') => (
  <Link to={to} params={{ patientId }} className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-700 hover:underline">
    {label} <ChevronRight className="size-4" aria-hidden />
  </Link>
);

function Summary() {
  const { patientId } = Route.useParams();
  const { data: p } = usePatient(patientId);
  const { data: me } = useMe();
  const clinical = me?.canEditClinical ?? false;
  const meds = useMedications(clinical ? patientId : '');
  const notes = useNotes(clinical ? patientId : '');
  const assessments = useAssessments(clinical ? patientId : '');
  const appts = usePatientAppointments(patientId);
  const upcoming = (appts.data ?? [])
    .filter((a) => Date.parse(a.endsAt) >= Date.now() && a.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (!p) return null;

  const activeMeds = (meds.data ?? []).filter((m) => m.active);
  const lastSigned = (notes.data ?? []).find((n) => n.status === 'signed');
  const primary = p.contacts.find((c) => c.isPrimary) ?? p.contacts[0];
  // Último resultado de cada escala (la lista viene ordenada del más reciente al más antiguo).
  const latest = (assessments.data ?? []).filter((a, i, arr) => arr.findIndex((x) => x.scaleKey === a.scaleKey) === i);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Familiar o cuidador" icon={<UserRound />} action={seeAll('/pacientes/$patientId/datos', patientId, 'Editar')}>
        {primary ? (
          <div>
            <p className="font-semibold">
              {primary.name}
              {primary.relationship ? <span className="font-normal text-muted"> · {primary.relationship}</span> : null}
            </p>
            {primary.phone && (
              <a href={`tel:${primary.phone.replace(/\s/g, '')}`} className="mt-1 inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                <Phone className="size-4" aria-hidden /> {primary.phone}
              </a>
            )}
            {p.contacts.length > 1 && <p className="mt-2 text-sm text-muted">+{p.contacts.length - 1} contacto(s) más</p>}
          </div>
        ) : (
          <p className="text-muted">Sin familiar o cuidador registrado.</p>
        )}
      </Card>

      <Card
        title="Próximas citas"
        icon={<CalendarDays />}
        action={
          <Link to="/agenda" search={{ nuevo: patientId }} className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-700 hover:underline">
            Agendar <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      >
        {upcoming.length ? (
          <ul className="grid gap-2">
            {upcoming.slice(0, 3).map((a) => {
              const st = zonedParts(a.startsAt);
              return (
                <li key={a.id} className="flex items-center gap-3">
                  <span className={`h-8 w-1 rounded-full ${a.source === 'doctoralia' ? 'bg-teal-500' : 'bg-brand-600'}`} aria-hidden />
                  <span>
                    <span className="block font-semibold">
                      {formatDate(a.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} · {hhmm(st.hour, st.minute)}
                    </span>
                    <span className="block text-sm text-muted">
                      {MODALITY_LABELS[a.modality]} · {a.source === 'doctoralia' ? 'Doctoralia' : 'Agendada aquí'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">Sin citas próximas.</p>
        )}
      </Card>

      {clinical && (
        <Card title="Medicamentos activos" icon={<Pill />} action={seeAll('/pacientes/$patientId/medicamentos', patientId)}>
          {activeMeds.length ? (
            <ul className="grid gap-1.5">
              {activeMeds.slice(0, 6).map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-sm text-muted">{[m.dose, m.frequency].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
              {activeMeds.length > 6 && <li className="text-sm text-muted">+{activeMeds.length - 6} más</li>}
            </ul>
          ) : (
            <p className="text-muted">Sin medicamentos registrados.</p>
          )}
        </Card>
      )}

      {clinical && (
        <Card title="Última nota firmada" icon={<FileText />} action={seeAll('/pacientes/$patientId/notas', patientId)}>
          {lastSigned ? (
            <Link to="/pacientes/$patientId/notas/$noteId" params={{ patientId, noteId: lastSigned.id }} className="block rounded-xl hover:bg-mist/60">
              <p className="text-sm text-muted">
                {NOTE_TYPE_LABELS[lastSigned.type]} · {formatDate(lastSigned.visitDate)}
              </p>
              {lastSigned.assessment && (
                <p className="mt-2 line-clamp-3">
                  <span className="font-semibold">Análisis: </span>
                  {lastSigned.assessment}
                </p>
              )}
              {lastSigned.plan && (
                <p className="mt-1 line-clamp-3">
                  <span className="font-semibold">Plan: </span>
                  {lastSigned.plan}
                </p>
              )}
            </Link>
          ) : (
            <p className="text-muted">
              Aún no hay notas firmadas.
              {p.summary.draftNotes > 0 && (
                <Badge tone="warning" className="ml-2">
                  {p.summary.draftNotes} borrador(es)
                </Badge>
              )}
            </p>
          )}
        </Card>
      )}

      {clinical && (
        <Card title="Escalas recientes" icon={<ClipboardList />} action={seeAll('/pacientes/$patientId/escalas', patientId)}>
          {latest.length ? (
            <ul className="grid gap-3">
              {latest.slice(0, 4).map((a) => {
                const scale = SCALES_BY_KEY[a.scaleKey];
                const st = SEVERITY_STYLE[a.severity];
                return (
                  <li key={a.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{scale?.shortName ?? a.scaleKey}</span>
                      <span className={`text-sm font-bold tabular-nums ${st.text}`}>
                        {a.score}/{a.maxScore}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      <span className={`font-semibold ${st.text}`}>{a.interpretation}</span> · {formatDate(a.performedAt)}
                    </p>
                    {scale && <ScoreGauge scale={scale} score={a.score} showLegend={false} className="-mt-3" />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted">Aún no se han aplicado escalas.</p>
          )}
        </Card>
      )}

      {clinical && (
        <Card title="Historia clínica" icon={<ScrollText />} action={seeAll('/pacientes/$patientId/historia', patientId, 'Abrir')}>
          <p className="text-muted">
            {p.summary.historyVersion ? `Versión ${p.summary.historyVersion}.` : 'Aún no se ha capturado.'} {p.summary.filesCount} archivo(s) en el expediente.
          </p>
        </Card>
      )}

      {p.notes && (
        <Card title="Observaciones administrativas" icon={<FileText />}>
          <p className="whitespace-pre-line">{p.notes}</p>
        </Card>
      )}
    </div>
  );
}
