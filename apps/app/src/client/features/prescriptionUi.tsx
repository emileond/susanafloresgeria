import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MedicationItem, PrescriptionStatus } from '../../shared/types';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Badge } from '../components/ui/misc';

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  if (status === 'issued') {
    return (
      <Badge tone="brand">
        <Lock className="size-3" aria-hidden /> Emitida
      </Badge>
    );
  }
  if (status === 'cancelled') return <Badge tone="danger">Cancelada</Badge>;
  return <Badge tone="warning">Borrador</Badge>;
}

/** Elegir medicamentos activos del paciente para agregarlos a una receta. */
export function MedicationPicker({
  open,
  onOpenChange,
  medications,
  title,
  confirmLabel,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medications: MedicationItem[];
  title: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setSelected(new Set(medications.map((m) => m.id)));
  }, [open, medications]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Se copian nombre, dosis y frecuencia. Después complete vía, duración y cantidad."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(medications.filter((m) => selected.has(m.id)).map((m) => m.id))} disabled={selected.size === 0} loading={loading}>
            {confirmLabel} ({selected.size})
          </Button>
        </>
      }
    >
      {medications.length === 0 ? (
        <p className="text-sm text-muted">No hay medicamentos activos que agregar.</p>
      ) : (
        <ul className="grid gap-2">
          {medications.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-3 hover:bg-mist/50 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/60">
                <input type="checkbox" className="mt-1 size-4.5 accent-brand-700" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                <span>
                  <span className="font-semibold">{m.name}</span>
                  <span className="block text-sm text-muted">{[m.dose, m.frequency, m.indication && `Para: ${m.indication}`].filter(Boolean).join(' · ') || '—'}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
