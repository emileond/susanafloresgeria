import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Ban, Check, Copy, ListChecks, Plus, Printer, Send, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { NOTE_TYPE_LABELS } from '../../../../../shared/constants';
import { formatDate, formatDateTime } from '../../../../../shared/format';
import { REQUIRED_ITEM_FIELDS, ROUTE_SUGGESTIONS } from '../../../../../shared/prescriber';
import type { Prescription, PrescriptionItem } from '../../../../../shared/types';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../../../../components/ui/Field';
import { Badge, ErrorState } from '../../../../components/ui/misc';
import { PageLoader, Spinner } from '../../../../components/ui/Spinner';
import { folioLabel, PrescriptionDocument } from '../../../../features/PrescriptionDocument';
import { MedicationPicker, PrescriptionStatusBadge } from '../../../../features/prescriptionUi';
import { ApiError } from '../../../../lib/api';
import { cn } from '../../../../lib/cn';
import { useMe, useMedications, useNotes, usePatient, usePrescription, usePrescriptionMutations } from '../../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/recetas/$prescriptionId')({ component: PrescriptionPage });

function PrescriptionPage() {
  const { patientId, prescriptionId } = Route.useParams();
  const rx = usePrescription(prescriptionId);
  if (rx.isPending) return <PageLoader />;
  if (rx.isError) return <ErrorState error={rx.error} onRetry={() => rx.refetch()} />;
  return rx.data.status === 'draft' ? (
    <PrescriptionEditor key={rx.data.id} rx={rx.data} patientId={patientId} />
  ) : (
    <IssuedPrescription rx={rx.data} patientId={patientId} />
  );
}

function BackToList({ patientId }: { patientId: string }) {
  return (
    <Link to="/pacientes/$patientId/recetas" params={{ patientId }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Todas las recetas
    </Link>
  );
}

function SourceNotice({ rx, patientId }: { rx: Prescription; patientId: string }) {
  if (!rx.sourceId) return null;
  return (
    <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Basada en la{' '}
      <Link to="/pacientes/$patientId/recetas/$prescriptionId" params={{ patientId, prescriptionId: rx.sourceId }} className="font-semibold underline">
        receta folio {folioLabel(rx.sourceFolio)}
      </Link>
      .
    </p>
  );
}

// ——— Borrador ———

type ItemKey = keyof Omit<PrescriptionItem, 'medicationId'>;
interface ItemDraft extends Record<ItemKey, string> {
  key: string;
  medicationId?: string;
}
interface Draft {
  date: string;
  noteId: string;
  weightKg: string;
  diagnosis: string;
  generalInstructions: string;
  items: ItemDraft[];
}

const ITEM_KEYS: ItemKey[] = ['drug', 'brand', 'presentation', 'dose', 'route', 'frequency', 'duration', 'quantity', 'instructions'];
const emptyItem = (): ItemDraft => ({ key: crypto.randomUUID(), ...(Object.fromEntries(ITEM_KEYS.map((k) => [k, ''])) as Record<ItemKey, string>) });
const toItemDraft = (it: PrescriptionItem): ItemDraft => ({
  ...emptyItem(),
  ...Object.fromEntries(ITEM_KEYS.map((k) => [k, it[k] ?? ''])),
  medicationId: it.medicationId,
});
const toDraft = (rx: Prescription): Draft => ({
  date: rx.date,
  noteId: rx.noteId ?? '',
  weightKg: rx.weightKg != null ? String(rx.weightKg) : '',
  diagnosis: rx.diagnosis ?? '',
  generalInstructions: rx.generalInstructions ?? '',
  items: rx.items.length ? rx.items.map(toItemDraft) : [emptyItem()],
});

function toPayload(d: Draft) {
  const weight = Number.parseFloat(d.weightKg.replace(',', '.'));
  return {
    date: d.date,
    noteId: d.noteId || null,
    weightKg: Number.isFinite(weight) && weight > 0 ? weight : null,
    diagnosis: d.diagnosis,
    generalInstructions: d.generalInstructions,
    // Los renglones totalmente vacíos no se guardan.
    items: d.items
      .filter((it) => ITEM_KEYS.some((k) => it[k].trim()))
      .map(({ key: _key, medicationId, ...fields }) => ({ ...fields, ...(medicationId ? { medicationId } : {}) })),
  };
}

const ITEM_FIELDS: { key: ItemKey; label: string; placeholder: string; span: string; required?: boolean }[] = [
  { key: 'drug', label: 'Denominación genérica', placeholder: 'p. ej. Paracetamol', span: 'sm:col-span-3', required: true },
  { key: 'brand', label: 'Marca (opcional)', placeholder: 'Denominación distintiva', span: 'sm:col-span-3' },
  { key: 'presentation', label: 'Presentación', placeholder: 'p. ej. Tabletas de 500 mg', span: 'sm:col-span-3' },
  { key: 'dose', label: 'Dosis', placeholder: 'p. ej. 1 tableta', span: 'sm:col-span-3', required: true },
  { key: 'route', label: 'Vía', placeholder: 'p. ej. oral', span: 'sm:col-span-2', required: true },
  { key: 'frequency', label: 'Frecuencia', placeholder: 'p. ej. cada 8 horas', span: 'sm:col-span-2', required: true },
  { key: 'duration', label: 'Duración', placeholder: 'p. ej. 7 días', span: 'sm:col-span-2', required: true },
  { key: 'quantity', label: 'Cantidad a surtir', placeholder: 'p. ej. 1 caja con 20 tabletas', span: 'sm:col-span-2' },
  { key: 'instructions', label: 'Indicaciones', placeholder: 'p. ej. tomar con alimentos', span: 'sm:col-span-4' },
];

/** Editor de borrador con autoguardado, como las notas. */
function PrescriptionEditor({ rx, patientId }: { rx: Prescription; patientId: string }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(rx));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [picking, setPicking] = useState(false);
  const [addToMeds, setAddToMeds] = useState(false);
  const m = usePrescriptionMutations(patientId);
  const { data: me } = useMe();
  const patient = usePatient(patientId);
  const notes = useNotes(patientId);
  const meds = useMedications(patientId);
  const navigate = useNavigate();
  const routeListId = useId();
  const latest = useRef(draft);
  latest.current = draft;

  const save = async () => {
    await m.update.mutateAsync({ id: rx.id, ...toPayload(latest.current) });
    setDirty(false);
  };

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      save().catch((err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar el borrador.'));
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };
  const setItems = (fn: (items: ItemDraft[]) => ItemDraft[]) => {
    setDraft((d) => ({ ...d, items: fn(d.items) }));
    setDirty(true);
  };
  const setItemField = (index: number, key: ItemKey, value: string) => {
    setItems((items) => items.map((it, i) => (i === index ? { ...it, [key]: value } : it)));
    // El error se corrige al escribir; los índices se recalculan al emitir.
    setErrors((e) => {
      const name = `items.${index}.${key}`;
      if (!e[name]) return e;
      const { [name]: _removed, ...rest } = e;
      return rest;
    });
  };
  const move = (index: number, delta: number) =>
    setItems((items) => {
      const next = [...items];
      const [it] = next.splice(index, 1);
      next.splice(index + delta, 0, it!);
      return next;
    });

  // Validación previa (la misma regla que aplica el servidor), con los índices que se guardarán.
  const localErrors = (): Record<string, string> => {
    const payload = toPayload(latest.current);
    const errs: Record<string, string> = {};
    if (payload.items.length === 0) errs._ = 'Agregue al menos un medicamento.';
    payload.items.forEach((it, i) => {
      for (const f of REQUIRED_ITEM_FIELDS) if (!it[f.key]?.trim()) errs[`items.${i}.${f.key}`] ??= `Falta la ${f.label}`;
    });
    return errs;
  };

  const startIssue = async () => {
    // Quitar renglones vacíos para que los índices de error coincidan con lo guardado.
    setDraft((d) => {
      const items = d.items.filter((it) => ITEM_KEYS.some((k) => it[k].trim()));
      return { ...d, items: items.length ? items : [emptyItem()] };
    });
    const errs = localErrors();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(errs._ ?? 'Complete dosis, vía, frecuencia y duración de cada medicamento.');
      return;
    }
    try {
      if (dirty) await save();
      setConfirmIssue(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar el borrador.');
    }
  };

  const issue = async () => {
    try {
      await save();
      await m.issue.mutateAsync({ id: rx.id, addToMedications: addToMeds });
      toast.success('Receta emitida');
      setConfirmIssue(false);
      void navigate({ to: '/recetas/$prescriptionId/imprimir', params: { prescriptionId: rx.id } });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error(err instanceof ApiError ? err.message : 'No se pudo emitir la receta.');
      setConfirmIssue(false);
    }
  };

  const discard = async () => {
    try {
      await m.discard.mutateAsync(rx.id);
      toast.success('Borrador descartado');
      void navigate({ to: '/pacientes/$patientId/recetas', params: { patientId } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo descartar.');
    }
  };

  const usedMedIds = new Set(draft.items.map((i) => i.medicationId).filter(Boolean));
  const pickable = (meds.data ?? []).filter((x) => x.active && !usedMedIds.has(x.id));
  const canIssue = me?.role === 'doctor';
  const allergies = patient.data?.allergies;
  const saving = m.update.isPending;
  const filledItems = toPayload(draft).items.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackToList patientId={patientId} />
        <span className="inline-flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
          {saving ? (
            <>
              <Spinner className="size-3.5" /> Guardando…
            </>
          ) : dirty ? (
            'Cambios sin guardar'
          ) : (
            <>
              <Check className="size-4 text-emerald-600" aria-hidden /> Borrador guardado
            </>
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h2 className="section-heading">Nueva receta</h2>
        <PrescriptionStatusBadge status="draft" />
      </div>
      <SourceNotice rx={rx} patientId={patientId} />
      {allergies && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> <span><strong>Alergias:</strong> {allergies}</span>
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Fecha">{(id) => <Input id={id} type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />}</Field>
        <Field label="Peso (kg)" hint="Se toma de la última nota; puede corregirlo.">
          {(id) => <Input id={id} inputMode="decimal" placeholder="p. ej. 61.5" value={draft.weightKg} onChange={(e) => set('weightKg', e.target.value)} />}
        </Field>
        <Field label="Nota de la consulta (opcional)">
          {(id) => (
            <Select id={id} value={draft.noteId} onChange={(e) => set('noteId', e.target.value)}>
              <option value="">Sin vincular</option>
              {(notes.data ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {NOTE_TYPE_LABELS[n.type]} · {formatDate(n.visitDate)}
                  {n.status === 'draft' ? ' (borrador)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Diagnóstico (opcional)" className="sm:col-span-3">
          {(id) => <Input id={id} placeholder="Se imprime en la receta" value={draft.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} />}
        </Field>
      </div>

      <section className="mt-6" aria-labelledby="rx-meds">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="rx-meds" className="font-bold">
            Medicamentos
          </h3>
          {pickable.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
              <ListChecks aria-hidden /> Agregar de sus medicamentos activos
            </Button>
          )}
        </div>
        {errors._ && <p className="field-error">{errors._}</p>}

        <datalist id={routeListId}>
          {ROUTE_SUGGESTIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>

        <ol className="mt-3 grid gap-3">
          {draft.items.map((it, index) => (
            <li key={it.key} className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-semibold">
                  {index + 1}. {it.drug.trim() || 'Medicamento'}
                  {it.medicationId && <Badge className="ml-2">De su lista</Badge>}
                </p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Subir">
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => move(index, 1)} disabled={index === draft.items.length - 1} aria-label="Bajar">
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setItems((items) => (items.length > 1 ? items.filter((_, i) => i !== index) : [emptyItem()]))}
                    aria-label="Quitar medicamento"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-6">
                {ITEM_FIELDS.map((f) => (
                  <Field key={f.key} label={f.required ? `${f.label} *` : f.label} error={errors[`items.${index}.${f.key}`]} className={f.span}>
                    {(id) => (
                      <Input
                        id={id}
                        value={it[f.key]}
                        placeholder={f.placeholder}
                        list={f.key === 'route' ? routeListId : undefined}
                        aria-invalid={Boolean(errors[`items.${index}.${f.key}`])}
                        className={cn(errors[`items.${index}.${f.key}`] && 'border-red-300')}
                        onChange={(e) => setItemField(index, f.key, e.target.value)}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </li>
          ))}
        </ol>
        <Button variant="secondary" className="mt-3" onClick={() => setItems((items) => [...items, emptyItem()])} disabled={draft.items.length >= 20}>
          <Plus aria-hidden /> Agregar medicamento
        </Button>
        <p className="mt-2 text-sm text-muted">* Obligatorios para emitir (Reglamento de Insumos para la Salud, art. 30).</p>
      </section>

      <Field label="Indicaciones generales (opcional)" className="mt-6">
        {(id) => (
          <Textarea
            id={id}
            rows={4}
            placeholder="Dieta, cuidados, signos de alarma, próxima cita…"
            value={draft.generalInstructions}
            onChange={(e) => set('generalInstructions', e.target.value)}
          />
        )}
      </Field>

      <div className="mt-8 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="danger" onClick={() => setConfirmDiscard(true)}>
          <Trash2 aria-hidden /> Descartar borrador
        </Button>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button onClick={startIssue} disabled={!canIssue}>
            <Send aria-hidden /> Emitir receta
          </Button>
          {!canIssue && <p className="text-sm text-muted">Solo la médica puede emitir recetas.</p>}
        </div>
      </div>

      <MedicationPicker
        open={picking}
        onOpenChange={setPicking}
        medications={pickable}
        title="Agregar de sus medicamentos activos"
        confirmLabel="Agregar"
        onConfirm={(ids) => {
          const chosen = pickable.filter((x) => ids.includes(x.id));
          setItems((items) => [
            ...items.filter((i) => ITEM_KEYS.some((k) => i[k].trim())),
            ...chosen.map((x) => ({ ...emptyItem(), drug: x.name, dose: x.dose ?? '', frequency: x.frequency ?? '', medicationId: x.id })),
          ]);
          setPicking(false);
        }}
      />

      <Dialog
        open={confirmIssue}
        onOpenChange={setConfirmIssue}
        title="¿Emitir la receta?"
        description="Una vez emitida no se puede modificar. Si necesita corregirla, deberá cancelarla y emitir una nueva."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmIssue(false)}>
              Seguir editando
            </Button>
            <Button onClick={issue} loading={m.issue.isPending}>
              <Send aria-hidden /> Emitir e imprimir
            </Button>
          </>
        }
      >
        <p>
          {filledItems} medicamento(s) para <strong>{patient.data?.fullName}</strong>, con fecha {formatDate(draft.date, { dateStyle: 'long' })}.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-3">
          <input type="checkbox" className="mt-1 size-4.5 accent-brand-700" checked={addToMeds} onChange={(e) => setAddToMeds(e.target.checked)} />
          <span>
            <span className="font-semibold">Agregar a su lista de medicamentos</span>
            <span className="block text-sm text-muted">Solo los que todavía no estén en la lista de medicamentos activos.</span>
          </span>
        </label>
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="¿Descartar este borrador?"
        description="El borrador no se ha emitido y se eliminará."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
              Conservar
            </Button>
            <Button variant="danger" onClick={discard} loading={m.discard.isPending}>
              Descartar
            </Button>
          </>
        }
      >
        <p className="text-muted">Esta acción no afecta a las recetas emitidas.</p>
      </Dialog>
    </div>
  );
}

// ——— Emitida o cancelada ———

function IssuedPrescription({ rx, patientId }: { rx: Prescription; patientId: string }) {
  const m = usePrescriptionMutations(patientId);
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reissue, setReissue] = useState(true);
  const isDoctor = me?.role === 'doctor';

  const copy = async () => {
    try {
      const next = await m.copy.mutateAsync(rx.id);
      void navigate({ to: '/pacientes/$patientId/recetas/$prescriptionId', params: { patientId, prescriptionId: next.id } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo crear la receta nueva.');
    }
  };

  const cancel = async () => {
    try {
      await m.cancel.mutateAsync({ id: rx.id, reason });
      toast.success('Receta cancelada');
      setCancelling(false);
      if (reissue) await copy();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cancelar la receta.');
    }
  };

  return (
    <div>
      <BackToList patientId={patientId} />

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-heading">Receta folio {folioLabel(rx.folio)}</h2>
            <PrescriptionStatusBadge status={rx.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDate(rx.date, { dateStyle: 'long' })}
            {rx.issuedAt ? ` · Emitida el ${formatDateTime(rx.issuedAt)}${rx.issuedByName ? ` por ${rx.issuedByName}` : ''}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/recetas/$prescriptionId/imprimir"
            params={{ prescriptionId: rx.id }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800"
          >
            <Printer className="size-4.5" aria-hidden /> Imprimir / PDF
          </Link>
          <Button variant="secondary" onClick={copy} loading={m.copy.isPending}>
            <Copy aria-hidden /> {rx.status === 'cancelled' ? 'Emitir una nueva a partir de esta' : 'Repetir receta'}
          </Button>
          {rx.status === 'issued' && isDoctor && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              <Ban aria-hidden /> Cancelar
            </Button>
          )}
        </div>
      </div>

      <SourceNotice rx={rx} patientId={patientId} />
      {rx.status === 'cancelled' && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          Cancelada el {rx.cancelledAt ? formatDateTime(rx.cancelledAt) : ''}
          {rx.cancelledByName ? ` por ${rx.cancelledByName}` : ''}. <strong>Motivo:</strong> {rx.cancelReason}
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <div className="card mx-auto max-w-[6.5in] min-w-[20rem] p-5 sm:p-7">
          <PrescriptionDocument rx={rx} />
        </div>
      </div>

      <Dialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancelar la receta"
        description="La receta seguirá en el expediente marcada como cancelada, con el motivo. No se puede deshacer."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(false)}>
              Volver
            </Button>
            <Button variant="danger" onClick={cancel} loading={m.cancel.isPending || m.copy.isPending} disabled={reason.trim().length < 5}>
              <Ban aria-hidden /> Cancelar receta
            </Button>
          </>
        }
      >
        <Field label="Motivo de la cancelación" hint="Por ejemplo: dosis equivocada, cambio de tratamiento.">
          {(id) => <Textarea id={id} rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-3">
          <input type="checkbox" className="mt-1 size-4.5 accent-brand-700" checked={reissue} onChange={(e) => setReissue(e.target.checked)} />
          <span>
            <span className="font-semibold">Abrir una receta nueva para corregirla</span>
            <span className="block text-sm text-muted">Se copia el contenido en un borrador que usted revisa antes de emitir.</span>
          </span>
        </label>
      </Dialog>
    </div>
  );
}
