import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, CalendarPlus, ClipboardList, FilePlus2, Pill, Upload } from 'lucide-react';
import { SEX_LABELS } from '../../../shared/constants';
import { ageFromBirthDate, formatDate } from '../../../shared/format';
import { Button } from '../../components/ui/Button';
import { Badge, ErrorState } from '../../components/ui/misc';
import { PageLoader } from '../../components/ui/Spinner';
import { useNewNote } from '../../features/useNewNote';
import { cn } from '../../lib/cn';
import { useMe, usePatient } from '../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId')({ component: PatientLayout });

const TABS = [
  { to: '/pacientes/$patientId', label: 'Resumen', exact: true, clinical: false },
  { to: '/pacientes/$patientId/notas', label: 'Notas', exact: false, clinical: true },
  { to: '/pacientes/$patientId/historia', label: 'Historia clínica', exact: false, clinical: true },
  { to: '/pacientes/$patientId/archivos', label: 'Archivos', exact: false, clinical: true },
  { to: '/pacientes/$patientId/medicamentos', label: 'Medicamentos', exact: false, clinical: true },
  { to: '/pacientes/$patientId/datos', label: 'Datos y contactos', exact: false, clinical: false },
] as const;

function PatientLayout() {
  const { patientId } = Route.useParams();
  const patient = usePatient(patientId);
  const { data: me } = useMe();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/pacientes/${patientId}`;
  const newNote = useNewNote(patientId, (patient.data?.summary.notesCount ?? 0) > 0);

  if (patient.isPending) return <PageLoader />;
  if (patient.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <ErrorState error={patient.error} onRetry={() => patient.refetch()} />
      </div>
    );
  }
  const p = patient.data;
  const clinical = me?.canEditClinical ?? false;
  const polypharmacy = p.summary.activeMedications >= 5;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-10 sm:px-8 sm:pt-8">
      <Link to="/pacientes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Pacientes
      </Link>

      {/* Encabezado del expediente: siempre visible lo más importante */}
      <header className="mt-3 rounded-3xl bg-brand-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-[1.75rem]">{p.fullName}</h1>
              {p.archivedAt && <Badge>Archivado</Badge>}
            </div>
            <p className="mt-1 text-ink/75">
              {ageFromBirthDate(p.birthDate)} años · {SEX_LABELS[p.sex]} · Nac. {formatDate(p.birthDate)}
              {p.bloodType ? ` · ${p.bloodType}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.allergies ? (
                <Badge tone="danger" className="text-sm">
                  <AlertTriangle className="size-3.5" aria-hidden /> Alergias: {p.allergies}
                </Badge>
              ) : (
                <Badge className="bg-white">Sin alergias registradas</Badge>
              )}
              {clinical && (
                <Badge tone={polypharmacy ? 'warning' : 'neutral'} className={cn('text-sm', !polypharmacy && 'bg-white')}>
                  <Pill className="size-3.5" aria-hidden /> {p.summary.activeMedications} medicamentos activos
                  {polypharmacy ? ' · polifarmacia' : ''}
                </Badge>
              )}
              <Badge className="bg-white text-sm">{p.lastVisitAt ? `Última consulta: ${formatDate(p.lastVisitAt)}` : 'Sin consultas firmadas'}</Badge>
            </div>
          </div>
          {clinical && (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button onClick={newNote.start} loading={newNote.pending}>
                <FilePlus2 aria-hidden /> Nueva nota
              </Button>
              <Link to="/pacientes/$patientId/archivos" params={{ patientId }} search={{ subir: true }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 font-semibold hover:bg-mist">
                <Upload className="size-4.5" aria-hidden /> Subir archivo
              </Link>
              <Button variant="secondary" disabled title="Disponible en la siguiente versión">
                <ClipboardList aria-hidden /> Aplicar escala
              </Button>
              <Link to="/agenda" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 font-semibold hover:bg-mist">
                <CalendarPlus className="size-4.5" aria-hidden /> Agendar
              </Link>
            </div>
          )}
        </div>
      </header>

      <nav aria-label="Secciones del expediente" className="-mx-4 mt-5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.filter((t) => clinical || !t.clinical).map((t) => {
            const href = t.to.replace('$patientId', patientId);
            const active = t.exact ? pathname === base || pathname === `${base}/` : pathname.startsWith(href);
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  params={{ patientId }}
                  className={cn(
                    '-mb-px inline-block border-b-2 px-3 py-3 text-[15px] font-semibold whitespace-nowrap',
                    active ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
