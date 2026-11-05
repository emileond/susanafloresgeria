import { Link } from '@tanstack/react-router';
import { ExternalLink, FileText, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MODALITIES, MODALITY_LABELS, type Modality } from '../../../shared/constants';
import { formatDate } from '../../../shared/format';
import { atTime, hhmm, zonedParts } from '../../../shared/time';
import type { AppointmentItem, AppointmentStatus } from '../../../shared/types';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useAppointmentMutations } from '../../lib/queries';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { PatientPicker, type PickedPatient } from './PatientPicker';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendada',
  done: 'Atendida',
  no_show: 'No asistió',
  cancelled: 'Cancelada',
};

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const TIMES = Array.from({ length: (21 - 7) * 4 + 1 }, (_, i) => hhmm(7 + Math.floor(i / 4), (i % 4) * 15));

export type DialogState =
  | { mode: 'create'; dateKey: string; time: string; patient?: PickedPatient | null }
  | { mode: 'edit'; appt: AppointmentItem };

export function AppointmentDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const m = useAppointmentMutations();
  const appt = state.mode === 'edit' ? state.appt : null;
  const readOnlyTime = appt?.source === 'doctoralia';

  const startParts = appt ? zonedParts(appt.startsAt) : null;
  const [dateKey, setDateKey] = useState(state.mode === 'create' ? state.dateKey : startParts!.dateKey);
  const [time, setTime] = useState(state.mode === 'create' ? state.time : hhmm(startParts!.hour, startParts!.minute));
  const [duration, setDuration] = useState(appt ? Math.round((Date.parse(appt.endsAt) - Date.parse(appt.startsAt)) / 60_000) : 30);
  const [patient, setPatient] = useState<PickedPatient | null>(
    state.mode === 'create' ? (state.patient ?? null) : appt?.patientId ? { id: appt.patientId, name: appt.patientName ?? 'Paciente' } : null,
  );
  const [title, setTitle] = useState(appt?.title ?? '');
  const [modality, setModality] = useState<Modality>(appt?.modality ?? 'consultorio');
  const [status, setStatus] = useState<AppointmentStatus>(appt?.status ?? 'scheduled');
  const [notes, setNotes] = useState(appt?.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saving = m.create.isPending || m.update.isPending;
  const timeOptions = TIMES.includes(time) ? TIMES : [...TIMES, time].sort();

  const save = async () => {
    const [h, mi] = time.split(':').map(Number) as [number, number];
    const start = atTime(dateKey, h, mi);
    const end = new Date(start.getTime() + duration * 60_000);
    try {
      if (!appt) {
        if (!patient && !title.trim()) {
          toast.error('Elija un paciente o escriba un título (p. ej. «Bloqueo: congreso»).');
          return;
        }
        await m.create.mutateAsync({
          patientId: patient?.id ?? null,
          title: title.trim() || undefined,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          modality,
          notes: notes.trim() || undefined,
        });
        toast.success('Cita agendada');
      } else if (readOnlyTime) {
        await m.update.mutateAsync({
          id: appt.id,
          patientId: patient?.id ?? null,
          ...(status !== appt.status ? { status } : {}),
          notes: notes.trim() || undefined,
        });
        toast.success('Cita actualizada');
      } else {
        await m.update.mutateAsync({
          id: appt.id,
          patientId: patient?.id ?? null,
          title: title.trim() || undefined,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          modality,
          status,
          notes: notes.trim() || undefined,
        });
        toast.success('Cita actualizada');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar la cita.');
    }
  };

  const remove = async () => {
    if (!appt) return;
    try {
      await m.remove.mutateAsync(appt.id);
      toast.success('Cita eliminada');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={appt ? (readOnlyTime ? 'Cita de Doctoralia' : 'Editar cita') : 'Nueva cita'}
      description={appt ? `${formatDate(appt.startsAt, { dateStyle: 'full' })}` : 'Agende una consulta o bloquee un horario.'}
      footer={
        <>
          {appt && !readOnlyTime && (
            <Button variant={confirmDelete ? 'danger' : 'ghost'} onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))} loading={m.remove.isPending} className="sm:mr-auto">
              <Trash2 aria-hidden /> {confirmDelete ? 'Confirmar: eliminar' : 'Eliminar'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            {appt ? 'Guardar cambios' : 'Agendar'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {readOnlyTime && appt && (
          <div className="flex flex-col gap-2 rounded-xl bg-teal-50 p-3.5 text-sm text-teal-900 ring-1 ring-teal-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {hhmm(startParts!.hour, startParts!.minute)} · {duration} min. El horario se cambia o cancela en Doctoralia.
              </span>
            </span>
            {appt.externalUrl && (
              <a href={appt.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline">
                Abrir en Doctoralia <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        )}
        {readOnlyTime && appt?.title && <p className="text-sm text-muted">Título en el calendario: «{appt.title}»</p>}

        <div>
          <p className="field-label">Paciente</p>
          <PatientPicker value={patient} onChange={setPatient} autoFocus={!appt && !patient} />
          {patient && (
            <Link to="/pacientes/$patientId" params={{ patientId: patient.id }} className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              <FileText className="size-3.5" aria-hidden /> Abrir expediente
            </Link>
          )}
        </div>

        {!readOnlyTime && (
          <>
            {!patient && (
              <Field label="Título" hint="Para citas sin expediente o para bloquear horario.">
                {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Primera vez (por registrar) · Bloqueo: congreso" />}
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Fecha" className="col-span-2 sm:col-span-1">
                {(id) => <Input id={id} type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />}
              </Field>
              <Field label="Hora">
                {(id) => (
                  <Select id={id} value={time} onChange={(e) => setTime(e.target.value)}>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Duración">
                {(id) => (
                  <Select id={id} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((d) => (
                      <option key={d} value={d}>
                        {d < 60 ? `${d} min` : `${d / 60} h${d % 60 ? ` ${d % 60} min` : ''}`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div>
              <p className="field-label">Modalidad</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modalidad">
                {MODALITIES.map((mo) => (
                  <button
                    key={mo}
                    type="button"
                    role="radio"
                    aria-checked={modality === mo}
                    onClick={() => setModality(mo)}
                    className={cn('rounded-xl border px-3 py-2.5 text-sm font-semibold', modality === mo ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-line hover:bg-mist')}
                  >
                    {MODALITY_LABELS[mo]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {appt && (
          <Field label="Estado">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)}>
                {(Object.keys(STATUS_LABELS) as AppointmentStatus[])
                  .filter((s) => !(readOnlyTime && s === 'cancelled' && appt.status !== 'cancelled'))
                  .map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        )}

        <Field label="Notas (opcional)">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Indicaciones para la cita, dirección de la visita…" />}</Field>
      </div>
    </Dialog>
  );
}
