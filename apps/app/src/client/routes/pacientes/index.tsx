import { createFileRoute } from '@tanstack/react-router';
import { Plus, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUi } from '../../components/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { PatientRow } from '../../components/PatientRow';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/misc';
import { PageLoader } from '../../components/ui/Spinner';
import { usePatients } from '../../lib/queries';

export const Route = createFileRoute('/pacientes/')({ component: PatientsPage });

function PatientsPage() {
  // El término de búsqueda no se guarda en la URL (evita nombres de pacientes en el historial).
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const ui = useUi();

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const list = usePatients(q);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        title="Pacientes"
        actions={
          <Button onClick={ui.openNewPatient}>
            <Plus aria-hidden /> Nuevo paciente
          </Button>
        }
      />
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar paciente"
          className="field-control h-12 pl-11"
        />
      </div>
      <div className="mt-4">
        {list.isPending ? (
          <PageLoader />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={q ? 'Sin resultados' : 'Aún no hay pacientes'}
            text={q ? 'Revise el nombre o búsquelo por teléfono.' : 'Registre a su primer paciente.'}
            action={<Button onClick={ui.openNewPatient}>Nuevo paciente</Button>}
          />
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {list.data.map((p) => (
              <PatientRow key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
