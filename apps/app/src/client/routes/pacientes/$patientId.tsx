import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Cake,
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  Droplet,
  FilePlus2,
  FileSignature,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Phone,
  Pill,
  ScrollText,
  Upload,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { SEX_LABELS } from '../../../shared/constants';
import { ageFromBirthDate, formatDate, initials } from '../../../shared/format';
import type { PatientDetail } from '../../../shared/types';
import { Button } from '../../components/ui/Button';
import { Badge, ErrorState } from '../../components/ui/misc';
import { PageLoader } from '../../components/ui/Spinner';
import { useNewNote } from '../../features/useNewNote';
import { cn } from '../../lib/cn';
import { useMe, usePatient } from '../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId')({ component: PatientLayout });

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
  clinical: boolean;
  count?: (p: PatientDetail) => number;
}

const TABS: Tab[] = [
  { to: '/pacientes/$patientId', label: 'Resumen', icon: LayoutDashboard, exact: true, clinical: false },
  { to: '/pacientes/$patientId/notas', label: 'Notas', icon: FileText, exact: false, clinical: true, count: (p) => p.summary.notesCount },
  { to: '/pacientes/$patientId/historia', label: 'Historia clínica', icon: ScrollText, exact: false, clinical: true },
  { to: '/pacientes/$patientId/escalas', label: 'Escalas', icon: ClipboardList, exact: false, clinical: true, count: (p) => p.summary.assessmentsCount },
  { to: '/pacientes/$patientId/archivos', label: 'Archivos', icon: FolderOpen, exact: false, clinical: true, count: (p) => p.summary.filesCount },
  { to: '/pacientes/$patientId/medicamentos', label: 'Medicamentos', icon: Pill, exact: false, clinical: true, count: (p) => p.summary.activeMedications },
  { to: '/pacientes/$patientId/recetas', label: 'Recetas', icon: FileSignature, exact: false, clinical: true, count: (p) => p.summary.prescriptionsCount },
  { to: '/pacientes/$patientId/datos', label: 'Datos', icon: UserRound, exact: false, clinical: false },
];

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-4 text-brand-600" aria-hidden />
      {children}
    </span>
  );
}

const actionClass = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-2.5 text-sm sm:gap-2 sm:px-3.5 sm:text-[15px] font-semibold text-ink hover:border-ink/20 hover:bg-mist [&_svg]:size-4.5 [&_svg]:text-brand-700';

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
  const caregiver = p.contacts.find((c) => c.isPrimary) ?? p.contacts[0];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-10 sm:px-8 sm:pt-6">
      <Link to="/pacientes" className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Pacientes
      </Link>

      {/* Encabezado del expediente: lo más importante siempre a la vista */}
      <header className="mt-2 overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white">
        <div className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-lg font-bold text-white sm:size-16 sm:text-2xl" aria-hidden>
              {initials(p.fullName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[1.4rem] leading-tight sm:text-[1.85rem]">{p.fullName}</h1>
                {p.archivedAt && <Badge>Archivado</Badge>}
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/80 sm:text-[15px]">
                <Fact icon={Cake}>
                  <strong className="font-semibold text-ink">{ageFromBirthDate(p.birthDate)} años</strong>
                  <span className="text-muted">({formatDate(p.birthDate)})</span>
                </Fact>
                <Fact icon={UserRound}>{SEX_LABELS[p.sex]}</Fact>
                {p.bloodType && <Fact icon={Droplet}>{p.bloodType}</Fact>}
                <Fact icon={CalendarCheck}>{p.lastVisitAt ? `Última consulta ${formatDate(p.lastVisitAt)}` : 'Sin consultas firmadas'}</Fact>
              </p>
              {caregiver && (
                <p className="mt-1 text-sm text-muted">
                  {caregiver.relationship ? `${caregiver.relationship}: ` : 'Contacto: '}
                  <span className="font-semibold text-ink/85">{caregiver.name}</span>
                  {caregiver.phone && (
                    <a href={`tel:${caregiver.phone.replace(/\s/g, '')}`} className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                      <Phone className="size-3.5" aria-hidden /> {caregiver.phone}
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>

          {clinical && (
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap lg:max-w-[22rem] lg:justify-end">
              <Button onClick={newNote.start} loading={newNote.pending} className="col-span-3 sm:col-span-1">
                <FilePlus2 aria-hidden /> Nueva nota
              </Button>
              <Link to="/pacientes/$patientId/escalas" params={{ patientId }} className={actionClass}>
                <ClipboardList aria-hidden /> <span className="sm:hidden">Escala</span>
                <span className="hidden sm:inline">Aplicar escala</span>
              </Link>
              <Link to="/pacientes/$patientId/archivos" params={{ patientId }} search={{ subir: true }} className={actionClass}>
                <Upload aria-hidden /> <span className="sm:hidden">Archivo</span>
                <span className="hidden sm:inline">Subir archivo</span>
              </Link>
              <Link to="/agenda" className={actionClass}>
                <CalendarPlus aria-hidden /> Agendar
              </Link>
            </div>
          )}
        </div>

        {/* Alertas clínicas */}
        <div className="flex flex-wrap gap-2 border-t border-brand-100/80 bg-white/60 px-4 py-3 sm:px-6">
          {p.allergies ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-800 ring-1 ring-red-200">
              <AlertTriangle className="size-4" aria-hidden /> Alergias: {p.allergies}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm text-muted ring-1 ring-line">Sin alergias registradas</span>
          )}
          {clinical && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1',
                polypharmacy ? 'bg-amber-50 font-semibold text-amber-900 ring-amber-200' : 'bg-white text-ink/80 ring-line',
              )}
            >
              <Pill className="size-4" aria-hidden /> {p.summary.activeMedications} medicamento{p.summary.activeMedications === 1 ? '' : 's'} activo{p.summary.activeMedications === 1 ? '' : 's'}
              {polypharmacy && ' · polifarmacia'}
            </span>
          )}
          {clinical && p.summary.draftNotes > 0 && (
            <Link
              to="/pacientes/$patientId/notas"
              params={{ patientId }}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
            >
              <FileText className="size-4" aria-hidden /> {p.summary.draftNotes} nota{p.summary.draftNotes === 1 ? '' : 's'} sin firmar
            </Link>
          )}
        </div>
      </header>

      {/* Pestañas: fijas al desplazarse para cambiar de sección rápido */}
      <nav aria-label="Secciones del expediente" className="sticky top-14 z-20 -mx-4 mt-4 border-b border-line bg-white/95 px-4 backdrop-blur sm:mx-0 sm:px-0 lg:top-0">
        <ul className="-mb-px flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {TABS.filter((t) => clinical || !t.clinical).map((t) => {
            const href = t.to.replace('$patientId', patientId);
            const active = t.exact ? pathname === base || pathname === `${base}/` : pathname.startsWith(href);
            const n = t.count?.(p);
            return (
              <li key={t.to} className="shrink-0">
                <Link
                  to={t.to}
                  params={{ patientId }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group inline-flex items-center gap-1.5 border-b-2 px-2.5 py-3 text-[15px] font-semibold whitespace-nowrap transition-colors',
                    active ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted hover:border-line hover:text-ink',
                  )}
                >
                  <t.icon className={cn('size-4.5', active ? 'text-brand-700' : 'text-muted group-hover:text-ink')} aria-hidden />
                  {t.label}
                  {n !== undefined && n > 0 && (
                    <span className={cn('rounded-full px-1.5 py-px text-xs font-bold tabular-nums', active ? 'bg-brand-100 text-brand-800' : 'bg-mist text-muted')}>{n}</span>
                  )}
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
