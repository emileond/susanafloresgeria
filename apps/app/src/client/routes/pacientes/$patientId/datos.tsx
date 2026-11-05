import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute } from '@tanstack/react-router';
import { Archive, ArchiveRestore, Phone, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { BLOOD_TYPES, SEX_LABELS, SEXES } from '../../../../shared/constants';
import { contactInput, patientUpdateInput, type ContactInput, type PatientUpdateInput } from '../../../../shared/schemas';
import type { PatientDetail } from '../../../../shared/types';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/misc';
import { ApiError } from '../../../lib/api';
import { useArchivePatient, useContactMutations, usePatient, useUpdatePatient } from '../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/datos')({ component: DataPage });

function DataPage() {
  const { patientId } = Route.useParams();
  const { data: p } = usePatient(patientId);
  if (!p) return null;
  return (
    <div className="grid gap-8">
      <Demographics key={p.updatedAt} p={p} />
      <Contacts p={p} />
      <ArchiveSection p={p} />
    </div>
  );
}

function Demographics({ p }: { p: PatientDetail }) {
  const update = useUpdatePatient(p.id);
  const { register, handleSubmit, formState } = useForm<PatientUpdateInput>({
    resolver: zodResolver(patientUpdateInput),
    defaultValues: {
      fullName: p.fullName,
      birthDate: p.birthDate,
      sex: p.sex,
      phone: p.phone ?? '',
      curp: p.curp ?? '',
      address: p.address ?? '',
      bloodType: (p.bloodType as PatientUpdateInput['bloodType']) ?? '',
      allergies: p.allergies ?? '',
      notes: p.notes ?? '',
    },
  });
  const e = formState.errors;
  const submit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync(v);
      toast.success('Datos actualizados');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    }
  });

  return (
    <section aria-labelledby="ficha">
      <h2 id="ficha" className="section-heading">
        Ficha de identificación
      </h2>
      <form onSubmit={submit} className="card mt-3 grid gap-4 p-5 sm:grid-cols-2 sm:p-6" noValidate>
        <Field label="Nombre completo" error={e.fullName?.message} className="sm:col-span-2">
          {(id) => <Input id={id} {...register('fullName')} />}
        </Field>
        <Field label="Fecha de nacimiento" error={e.birthDate?.message}>
          {(id) => <Input id={id} type="date" {...register('birthDate')} />}
        </Field>
        <Field label="Sexo">
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
        <Field label="Teléfono">{(id) => <Input id={id} type="tel" {...register('phone')} />}</Field>
        <Field label="CURP" error={e.curp?.message}>
          {(id) => <Input id={id} className="uppercase" maxLength={18} {...register('curp')} />}
        </Field>
        <Field label="Tipo de sangre">
          {(id) => (
            <Select id={id} {...register('bloodType')}>
              <option value="">No registrado</option>
              {BLOOD_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Domicilio" className="sm:col-span-2">
          {(id) => <Input id={id} {...register('address')} />}
        </Field>
        <Field label="Alergias" hint="Se muestran siempre en el encabezado del expediente." className="sm:col-span-2">
          {(id) => <Input id={id} placeholder="Medicamentos, alimentos, otros" {...register('allergies')} />}
        </Field>
        <Field label="Observaciones administrativas" hint="No clínicas (p. ej. horarios, preferencias de contacto)." className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} {...register('notes')} />}
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </section>
  );
}

function Contacts({ p }: { p: PatientDetail }) {
  const m = useContactMutations(p.id);
  const [editing, setEditing] = useState<(ContactInput & { id?: string }) | null>(null);

  return (
    <section aria-labelledby="contactos">
      <div className="flex items-center justify-between">
        <h2 id="contactos" className="section-heading">
          Familiares y cuidadores
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setEditing({ name: '', relationship: '', phone: '', isPrimary: p.contacts.length === 0 })}>
          <Plus aria-hidden /> Agregar
        </Button>
      </div>
      <ul className="card mt-3 divide-y divide-line">
        {p.contacts.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <p className="font-semibold">
                {c.name} {c.relationship && <span className="font-normal text-muted">· {c.relationship}</span>}{' '}
                {c.isPrimary && (
                  <Badge tone="brand">
                    <Star className="size-3" aria-hidden /> Principal
                  </Badge>
                )}
              </p>
              {c.phone && (
                <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
                  <Phone className="size-3.5" aria-hidden /> {c.phone}
                </a>
              )}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing({ id: c.id, name: c.name, relationship: c.relationship ?? '', phone: c.phone ?? '', isPrimary: c.isPrimary })}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Eliminar a ${c.name}`}
                onClick={async () => {
                  if (!window.confirm(`¿Eliminar a ${c.name} de los contactos?`)) return;
                  await m.remove.mutateAsync(c.id).catch(() => toast.error('No se pudo eliminar.'));
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </li>
        ))}
        {p.contacts.length === 0 && <li className="px-5 py-4 text-sm text-muted">Sin contactos registrados.</li>}
      </ul>
      {editing && (
        <ContactDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            if (editing.id) await m.update.mutateAsync({ id: editing.id, ...v });
            else await m.create.mutateAsync(v);
            toast.success('Contacto guardado');
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function ContactDialog({ initial, onClose, onSave }: { initial: ContactInput; onClose: () => void; onSave: (v: ContactInput) => Promise<void> }) {
  const { register, handleSubmit, formState } = useForm<ContactInput>({ resolver: zodResolver(contactInput), defaultValues: initial });
  const submit = handleSubmit((v) => onSave(v).catch((err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar.')));
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Familiar o cuidador"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="contact-form" loading={formState.isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nombre" error={formState.errors.name?.message} className="sm:col-span-2">
          {(id) => <Input id={id} autoFocus {...register('name')} />}
        </Field>
        <Field label="Parentesco">{(id) => <Input id={id} {...register('relationship')} />}</Field>
        <Field label="Teléfono">{(id) => <Input id={id} type="tel" {...register('phone')} />}</Field>
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" className="size-4 accent-brand-700" {...register('isPrimary')} />
          Contacto principal
        </label>
      </form>
    </Dialog>
  );
}

function ArchiveSection({ p }: { p: PatientDetail }) {
  const archive = useArchivePatient(p.id);
  const archived = Boolean(p.archivedAt);
  return (
    <section className="rounded-2xl border border-line p-5">
      <h2 className="text-base font-bold">{archived ? 'Expediente archivado' : 'Archivar expediente'}</h2>
      <p className="mt-1 text-sm text-muted">
        {archived
          ? 'El expediente está oculto de las listas, pero se conserva completo.'
          : 'Oculta al paciente de las listas (p. ej. si ya no se atiende). El expediente nunca se borra: la NOM-004 exige conservarlo al menos 5 años.'}
      </p>
      <Button
        variant="secondary"
        className="mt-4"
        loading={archive.isPending}
        onClick={async () => {
          if (!archived && !window.confirm('¿Archivar este expediente?')) return;
          await archive.mutateAsync(!archived).then(
            () => toast.success(archived ? 'Expediente restaurado' : 'Expediente archivado'),
            () => toast.error('No se pudo actualizar.'),
          );
        }}
      >
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {archived ? 'Restaurar expediente' : 'Archivar'}
      </Button>
    </section>
  );
}
