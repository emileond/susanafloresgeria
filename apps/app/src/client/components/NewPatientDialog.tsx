import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { SEX_LABELS, SEXES } from '../../shared/constants';
import { patientCreateInput, type PatientCreateInput } from '../../shared/schemas';
import { ApiError } from '../lib/api';
import { useCreatePatient } from '../lib/queries';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field, Input, Select } from './ui/Field';

/** Alta rápida: solo lo indispensable para abrir el expediente; el resto se completa después. */
export function NewPatientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [withCaregiver, setWithCaregiver] = useState(true);
  const navigate = useNavigate();
  const create = useCreatePatient();
  const form = useForm<PatientCreateInput>({
    resolver: zodResolver(patientCreateInput),
    defaultValues: { fullName: '', birthDate: '', sex: 'F', phone: '', caregiver: { name: '', relationship: '', phone: '' } },
  });
  const { register, handleSubmit, formState, reset } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    const payload: PatientCreateInput = { ...values };
    if (!withCaregiver || !values.caregiver?.name?.trim()) delete payload.caregiver;
    try {
      const { id } = await create.mutateAsync(payload);
      toast.success('Paciente registrado');
      onOpenChange(false);
      reset();
      void navigate({ to: '/pacientes/$patientId', params: { patientId: id } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo registrar al paciente.');
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo paciente"
      description="Registre lo básico ahora; podrá completar el resto del expediente después."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-patient" loading={create.isPending}>
            <UserPlus aria-hidden />
            Registrar paciente
          </Button>
        </>
      }
    >
      <form id="new-patient" onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field label="Nombre completo" error={errors.fullName?.message}>
          {(id) => <Input id={id} autoFocus autoComplete="off" placeholder="Nombre(s) y apellidos" {...register('fullName')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de nacimiento" error={errors.birthDate?.message}>
            {(id) => <Input id={id} type="date" max={new Date().toISOString().slice(0, 10)} {...register('birthDate')} />}
          </Field>
          <Field label="Sexo" error={errors.sex?.message}>
            {(id) => (
              <Select id={id} {...register('sex')}>
                {SEXES.map((s) => (
                  <option key={s} value={s}>
                    {SEX_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Teléfono del paciente (opcional)" error={errors.phone?.message}>
          {(id) => <Input id={id} type="tel" inputMode="tel" autoComplete="off" {...register('phone')} />}
        </Field>

        <div className="rounded-2xl bg-mist p-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input type="checkbox" className="size-4 accent-brand-700" checked={withCaregiver} onChange={(e) => setWithCaregiver(e.target.checked)} />
            Agregar familiar o cuidador responsable
          </label>
          {withCaregiver && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Nombre" error={errors.caregiver?.name?.message} className="sm:col-span-3">
                {(id) => <Input id={id} autoComplete="off" {...register('caregiver.name')} />}
              </Field>
              <Field label="Parentesco" className="sm:col-span-1">
                {(id) => <Input id={id} placeholder="Hija, hijo…" {...register('caregiver.relationship')} />}
              </Field>
              <Field label="Teléfono" className="sm:col-span-2">
                {(id) => <Input id={id} type="tel" inputMode="tel" {...register('caregiver.phone')} />}
              </Field>
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}
