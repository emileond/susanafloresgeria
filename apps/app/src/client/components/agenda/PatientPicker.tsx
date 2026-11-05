import { Search, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ageFromBirthDate } from '../../../shared/format';
import { usePatients } from '../../lib/queries';
import { Spinner } from '../ui/Spinner';

export interface PickedPatient {
  id: string;
  name: string;
}

/** Buscador de paciente para asignar a una cita. */
export function PatientPicker({ value, onChange, autoFocus }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);
  const { data = [], isFetching } = usePatients(q);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5">
        <span className="flex items-center gap-2 font-semibold text-brand-800">
          <UserRound className="size-4.5" aria-hidden /> {value.name}
        </span>
        <button type="button" onClick={() => onChange(null)} className="rounded-full p-1 text-muted hover:bg-white hover:text-ink" aria-label="Quitar paciente">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar paciente por nombre o teléfono…"
          className="field-control pl-10"
          aria-label="Buscar paciente"
        />
        {isFetching && <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-brand-700" />}
      </div>
      {q && (
        <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-line">
          {data.slice(0, 6).map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onChange({ id: p.id, name: p.fullName })} className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-mist">
                <span className="font-semibold">{p.fullName}</span>
                <span className="text-sm text-muted">{ageFromBirthDate(p.birthDate)} años</span>
              </button>
            </li>
          ))}
          {!isFetching && data.length === 0 && <li className="px-3.5 py-2.5 text-sm text-muted">Sin resultados.</li>}
        </ul>
      )}
    </div>
  );
}
