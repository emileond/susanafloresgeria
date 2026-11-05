import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute } from '@tanstack/react-router';
import { Pill, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { formatDate } from '../../../../shared/format';
import { medicationInput, type MedicationInput } from '../../../../shared/schemas';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field, Input } from '../../../components/ui/Field';
import { Badge, EmptyState, ErrorState } from '../../../components/ui/misc';
import { PageLoader } from '../../../components/ui/Spinner';
import { ApiError } from '../../../lib/api';
import { useMedicationMutations, useMedications } from '../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/medicamentos')({ component: MedicationsPage });

function MedicationsPage() {
  const { patientId } = Route.useParams();
  const meds = useMedications(patientId);
  const m = useMedicationMutations(patientId);
  const [adding, setAdding] = useState(false);

  if (meds.isPending) return <PageLoader />;
  if (meds.isError) return <ErrorState error={meds.error} onRetry={() => meds.refetch()} />;

  const active = meds.data.filter((x) => x.active);
  const past = meds.data.filter((x) => !x.active);

  const toggle = async (id: string, makeActive: boolean) => {
    try {
      await m.update.mutateAsync({ id, active: makeActive });
      toast.success(makeActive ? 'Medicamento reactivado' : 'Medicamento suspendido');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo actualizar.');
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-heading">Medicamentos</h2>
          <p className="text-sm text-muted">
            {active.length} activo(s)
            {active.length >= 5 && (
              <Badge tone="warning" className="ml-2">
                Polifarmacia: considere revisión
              </Badge>
            )}
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Agregar medicamento
        </Button>
      </div>

      {meds.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<Pill />} title="Sin medicamentos" text="Registre todo lo que toma el paciente, incluidos suplementos y remedios." />
        </div>
      ) : (
        <>
          <ul className="card mt-4 divide-y divide-line">
            {active.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="font-semibold">
                    {x.name} <span className="font-normal text-muted">{[x.dose, x.frequency].filter(Boolean).join(' · ')}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {[x.indication && `Para: ${x.indication}`, x.prescriber && `Indicó: ${x.prescriber}`, x.startDate && `Desde ${formatDate(x.startDate)}`].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => toggle(x.id, false)}>
                  Suspender
                </Button>
              </li>
            ))}
            {active.length === 0 && <li className="px-5 py-4 text-sm text-muted">Sin medicamentos activos.</li>}
          </ul>

          {past.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-semibold text-muted">Suspendidos ({past.length})</summary>
              <ul className="card mt-2 divide-y divide-line">
                {past.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3 text-muted sm:px-5">
                    <span>
                      <span className="font-semibold line-through">{x.name}</span> {[x.dose, x.frequency].filter(Boolean).join(' · ')}
                      {x.endDate ? ` · hasta ${formatDate(x.endDate)}` : ''}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => toggle(x.id, true)}>
                      <RotateCcw aria-hidden /> Reactivar
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <AddMedicationDialog
        open={adding}
        onOpenChange={setAdding}
        onSave={async (v) => {
          await m.create.mutateAsync(v);
          toast.success('Medicamento agregado');
        }}
      />
    </div>
  );
}

function AddMedicationDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (v: MedicationInput) => Promise<void> }) {
  const { register, handleSubmit, formState, reset } = useForm<MedicationInput>({ resolver: zodResolver(medicationInput) });
  const submit = handleSubmit(async (v) => {
    try {
      await onSave(v);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    }
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar medicamento"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="add-med" loading={formState.isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="add-med" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Medicamento" error={formState.errors.name?.message} className="sm:col-span-2">
          {(id) => <Input id={id} autoFocus placeholder="Nombre genérico o comercial" {...register('name')} />}
        </Field>
        <Field label="Dosis">{(id) => <Input id={id} placeholder="p. ej. 50 mg" {...register('dose')} />}</Field>
        <Field label="Frecuencia">{(id) => <Input id={id} placeholder="p. ej. cada 12 h" {...register('frequency')} />}</Field>
        <Field label="Indicación">{(id) => <Input id={id} placeholder="¿Para qué lo toma?" {...register('indication')} />}</Field>
        <Field label="Quién lo indicó">{(id) => <Input id={id} {...register('prescriber')} />}</Field>
        <Field label="Desde">{(id) => <Input id={id} type="date" {...register('startDate')} />}</Field>
      </form>
    </Dialog>
  );
}
