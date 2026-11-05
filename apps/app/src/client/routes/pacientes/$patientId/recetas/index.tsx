import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FilePlus2, FileSignature, ListChecks, Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatDate } from '../../../../../shared/format';
import type { Prescription } from '../../../../../shared/types';
import { Button } from '../../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../../components/ui/misc';
import { PageLoader } from '../../../../components/ui/Spinner';
import { MedicationPicker, PrescriptionStatusBadge } from '../../../../features/prescriptionUi';
import { folioLabel } from '../../../../features/PrescriptionDocument';
import { ApiError } from '../../../../lib/api';
import { useMedications, usePrescriptionMutations, usePrescriptions } from '../../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/recetas/')({ component: PrescriptionsList });

const drugsSummary = (rx: Prescription) => rx.items.map((i) => i.drug).filter(Boolean).join(', ');

function PrescriptionsList() {
  const { patientId } = Route.useParams();
  const list = usePrescriptions(patientId);
  const meds = useMedications(patientId);
  const m = usePrescriptionMutations(patientId);
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);

  const create = async (fromMedicationIds?: string[]) => {
    try {
      const rx = await m.create.mutateAsync({ fromMedicationIds });
      setPicking(false);
      void navigate({ to: '/pacientes/$patientId/recetas/$prescriptionId', params: { patientId, prescriptionId: rx.id } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo crear la receta.');
    }
  };

  if (list.isPending) return <PageLoader />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;

  const activeMeds = (meds.data ?? []).filter((x) => x.active);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-heading">Recetas</h2>
          <p className="text-sm text-muted">Las recetas emitidas quedan guardadas en el expediente y se pueden volver a imprimir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeMeds.length > 0 && (
            <Button variant="secondary" onClick={() => setPicking(true)}>
              <ListChecks aria-hidden /> Desde sus medicamentos
            </Button>
          )}
          <Button onClick={() => create()} loading={m.create.isPending && !picking}>
            <FilePlus2 aria-hidden /> Nueva receta
          </Button>
        </div>
      </div>

      {list.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<FileSignature />} title="Sin recetas todavía" text="Escriba una receta nueva o empiece con los medicamentos activos del paciente." />
        </div>
      ) : (
        <ul className="card mt-4 divide-y divide-line">
          {list.data.map((rx) => (
            <li key={rx.id} className="flex items-center gap-2 pr-2 sm:pr-3">
              <Link
                to="/pacientes/$patientId/recetas/$prescriptionId"
                params={{ patientId, prescriptionId: rx.id }}
                className="min-w-0 flex-1 px-4 py-3.5 hover:bg-mist/40 sm:px-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{rx.folio ? `Folio ${folioLabel(rx.folio)}` : 'Borrador'}</span>
                  <span className="text-muted">· {formatDate(rx.date)}</span>
                  <PrescriptionStatusBadge status={rx.status} />
                </div>
                <p className={rx.items.length ? 'mt-1 truncate text-ink/80' : 'mt-1 text-sm text-muted italic'}>
                  {drugsSummary(rx) || 'Sin medicamentos aún'}
                </p>
              </Link>
              {rx.status !== 'draft' && (
                <Link
                  to="/recetas/$prescriptionId/imprimir"
                  params={{ prescriptionId: rx.id }}
                  className="rounded-full p-2.5 text-muted hover:bg-mist hover:text-ink"
                  aria-label={`Imprimir receta folio ${folioLabel(rx.folio)}`}
                  title="Imprimir / Guardar como PDF"
                >
                  <Printer className="size-5" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <MedicationPicker
        open={picking}
        onOpenChange={setPicking}
        medications={activeMeds}
        title="Nueva receta desde sus medicamentos"
        confirmLabel="Crear receta"
        loading={m.create.isPending}
        onConfirm={(ids) => create(ids)}
      />
    </div>
  );
}
