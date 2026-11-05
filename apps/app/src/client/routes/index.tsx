import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, FilePen, Plus, Search, Users } from 'lucide-react';
import { NOTE_TYPE_LABELS } from '../../shared/constants';
import { formatDate, todayISO } from '../../shared/format';
import { useUi } from '../components/AppShell';
import { PatientRow } from '../components/PatientRow';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/misc';
import { PageLoader } from '../components/ui/Spinner';
import { useDashboard, useMe } from '../lib/queries';

export const Route = createFileRoute('/')({ component: Home });

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('es-MX', { hour: 'numeric', hour12: false, timeZone: 'America/Mexico_City' }).format(new Date()));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Home() {
  const { data: me } = useMe();
  const dash = useDashboard();
  const ui = useUi();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <p className="text-sm font-semibold text-brand-700">{capitalize(formatDate(todayISO(), { dateStyle: 'full' }))}</p>
      <h1 className="mt-1 text-2xl sm:text-3xl">
        {greeting()}
        {me ? `, ${me.name.split(' ').slice(0, 2).join(' ')}` : ''}
      </h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button onClick={ui.openNewPatient} className="flex items-center gap-3 rounded-2xl bg-brand-700 px-5 py-4 text-left text-white hover:bg-brand-800">
          <Plus className="size-6" aria-hidden />
          <span>
            <span className="block font-bold">Nuevo paciente</span>
            <span className="block text-sm text-white/80">Alta en segundos</span>
          </span>
        </button>
        <button onClick={ui.openSearch} className="flex items-center gap-3 rounded-2xl border border-line px-5 py-4 text-left hover:bg-mist">
          <Search className="size-6 text-brand-700" aria-hidden />
          <span>
            <span className="block font-bold">Buscar paciente</span>
            <span className="block text-sm text-muted">Por nombre o teléfono</span>
          </span>
        </button>
        <Link to="/agenda" className="flex items-center gap-3 rounded-2xl border border-line px-5 py-4 hover:bg-mist">
          <CalendarDays className="size-6 text-brand-700" aria-hidden />
          <span>
            <span className="block font-bold">Agenda</span>
            <span className="block text-sm text-muted">Citas del día y la semana</span>
          </span>
        </Link>
      </div>

      {dash.isPending ? (
        <PageLoader />
      ) : dash.isError ? (
        <div className="mt-8">
          <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="recent">
            <div className="flex items-center justify-between">
              <h2 id="recent" className="section-heading">
                Pacientes recientes
              </h2>
              <Link to="/pacientes" className="text-sm font-semibold text-brand-700 hover:underline">
                Ver todos ({dash.data.totals.patients})
              </Link>
            </div>
            <div className="card mt-3 divide-y divide-line overflow-hidden">
              {dash.data.recentPatients.length ? (
                dash.data.recentPatients.map((p) => <PatientRow key={p.id} p={p} />)
              ) : (
                <div className="p-4">
                  <EmptyState icon={<Users />} title="Aún no hay pacientes" text="Registre a su primer paciente para empezar." action={<Button onClick={ui.openNewPatient}>Nuevo paciente</Button>} />
                </div>
              )}
            </div>
          </section>

          {me?.canEditClinical && (
            <section aria-labelledby="drafts">
              <h2 id="drafts" className="section-heading">
                Notas sin firmar
              </h2>
              <div className="card mt-3 divide-y divide-line overflow-hidden">
                {dash.data.draftNotes.length ? (
                  dash.data.draftNotes.map((n) => (
                    <Link
                      key={n.id}
                      to="/pacientes/$patientId/notas/$noteId"
                      params={{ patientId: n.patientId, noteId: n.id }}
                      className="flex items-start gap-3 px-4 py-3.5 hover:bg-mist/70"
                    >
                      <FilePen className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
                      <span>
                        <span className="block font-semibold">{n.patientName}</span>
                        <span className="block text-sm text-muted">
                          {NOTE_TYPE_LABELS[n.type]} · {formatDate(n.visitDate)}
                        </span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted">Todas las notas están firmadas.</p>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
