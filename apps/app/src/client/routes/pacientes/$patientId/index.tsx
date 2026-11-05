import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight, FileText, Phone, Pill, ScrollText, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { NOTE_TYPE_LABELS } from '../../../../shared/constants';
import { formatDate } from '../../../../shared/format';
import { Badge } from '../../../components/ui/misc';
import { useMe, useMedications, useNotes, usePatient } from '../../../lib/queries';

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
  if (!p) return null;

  const activeMeds = (meds.data ?? []).filter((m) => m.active);
  const lastSigned = (notes.data ?? []).find((n) => n.status === 'signed');
  const primary = p.contacts.find((c) => c.isPrimary) ?? p.contacts[0];

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
