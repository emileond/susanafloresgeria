import { useNavigate } from '@tanstack/react-router';
import { Dialog as D } from 'radix-ui';
import { Search, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ageFromBirthDate } from '../../shared/format';
import { cn } from '../lib/cn';
import { usePatients } from '../lib/queries';
import { Spinner } from './ui/Spinner';

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Búsqueda rápida de pacientes (⌘K / Ctrl+K) por nombre o teléfono. */
export function SearchDialog({ open, onOpenChange, onNewPatient }: { open: boolean; onOpenChange: (o: boolean) => void; onNewPatient: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const term = useDebounced(q.trim());
  const { data = [], isFetching } = usePatients(term);
  const navigate = useNavigate();
  const results = data.slice(0, 8);

  useEffect(() => setActive(0), [term]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const go = (id: string) => {
    onOpenChange(false);
    void navigate({ to: '/pacientes/$patientId', params: { patientId: id } });
  };

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
        <D.Content className="fixed top-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-3xl bg-white shadow-2xl outline-none sm:top-[12vh]">
          <D.Title className="sr-only">Buscar paciente</D.Title>
          <D.Description className="sr-only">Escriba el nombre o teléfono del paciente</D.Description>
          <div className="flex items-center gap-3 border-b border-line px-5">
            <Search className="size-5 text-muted" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter' && results[active]) {
                  go(results[active].id);
                }
              }}
              placeholder="Buscar por nombre o teléfono…"
              className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted/70"
              aria-label="Buscar paciente"
              role="combobox"
              aria-expanded
              aria-controls="search-results"
            />
            {isFetching && <Spinner className="size-4 text-brand-700" />}
          </div>
          <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {results.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(p.id)}
                  className={cn('flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left', i === active && 'bg-brand-50')}
                >
                  <span>
                    <span className="block font-semibold">{p.fullName}</span>
                    <span className="block text-sm text-muted">
                      {ageFromBirthDate(p.birthDate)} años{p.phone ? ` · ${p.phone}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {term && !isFetching && results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Sin resultados para “{term}”.</li>}
          </ul>
          <div className="border-t border-line p-2">
            <button
              onClick={() => {
                onOpenChange(false);
                onNewPatient();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-semibold text-brand-700 hover:bg-brand-50"
            >
              <UserPlus className="size-4.5" aria-hidden />
              Registrar nuevo paciente
            </button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
