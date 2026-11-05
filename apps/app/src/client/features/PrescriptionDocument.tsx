import { formatDate } from '../../shared/format';
import type { Prescription, PrescriptionItem } from '../../shared/types';
import { cn } from '../lib/cn';

/**
 * Receta con los requisitos del Reglamento de Insumos para la Salud (art. 29–31):
 * nombre, domicilio, cédulas e institución de quien prescribe; fecha; datos del paciente;
 * denominación genérica (y distintiva opcional), presentación, dosis, vía, frecuencia y duración; firma.
 * Se dibuja con los datos guardados al emitir (snapshot), así una reimpresión es idéntica a la original.
 */

export const folioLabel = (folio: number | null) => (folio ? String(folio).padStart(6, '0') : '—');

function Directions({ item }: { item: PrescriptionItem }) {
  const parts = [
    ['Dosis', item.dose],
    ['Vía', item.route],
    ['Frecuencia', item.frequency],
    ['Duración', item.duration],
  ].filter((p): p is [string, string] => Boolean(p[1]));
  return (
    <p className="mt-0.5 leading-snug">
      {parts.map(([label, value], i) => (
        // Cada indicación se mantiene junta; el separador queda al final de la línea, no al inicio.
        <span key={label} className="inline-block pr-1">
          <span className="text-muted">{label}:</span> {value}
          {i < parts.length - 1 && <span className="text-muted"> ·</span>}
        </span>
      ))}
    </p>
  );
}

export function PrescriptionDocument({ rx, size = 'half' }: { rx: Prescription; size?: 'half' | 'letter' }) {
  const snap = rx.snapshot;
  if (!snap) return null;
  const { patient, prescriber } = snap;
  const cancelled = rx.status === 'cancelled';
  const compact = size === 'half';

  return (
    <article
      className={cn(
        'rx-sheet relative flex flex-1 flex-col bg-white text-ink',
        compact ? 'text-[10.5pt] leading-[1.35]' : 'text-[11.5pt] leading-[1.4]',
      )}
      aria-label={`Receta folio ${folioLabel(rx.folio)}`}
    >
      {cancelled && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden>
          <span className="-rotate-[24deg] rounded-lg border-4 border-red-700/60 px-6 py-2 text-5xl font-black tracking-[0.2em] text-red-700/45">CANCELADA</span>
        </div>
      )}

      {/* Encabezado: quien prescribe */}
      <header className="flex items-start gap-3 border-b-2 border-brand-700 pb-2.5">
        <img src="/logo-mark.svg" alt="" className={cn('shrink-0', compact ? 'size-11' : 'size-14')} />
        <div className="min-w-0 flex-1">
          <p className={cn('font-bold leading-tight text-brand-700', compact ? 'text-[15pt]' : 'text-[18pt]')}>{prescriber.name}</p>
          <p className="font-semibold leading-tight">{prescriber.specialty}</p>
          <ul className={cn('mt-1 leading-snug text-muted', compact ? 'text-[8pt]' : 'text-[9pt]')}>
            {prescriber.degrees.map((d) => (
              <li key={d.cedula}>
                {d.title} · {d.school} · <span className="font-semibold whitespace-nowrap text-ink">{d.cedulaLabel} {d.cedula}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn('shrink-0 text-right leading-tight', compact ? 'text-[8pt]' : 'text-[9pt]')}>
          <p className="text-muted">Folio</p>
          <p className="font-bold tabular-nums">{folioLabel(rx.folio)}</p>
        </div>
      </header>

      {/* Datos del paciente */}
      <section className="mt-2.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
        <p>
          <span className="text-muted">Paciente:</span> <span className="font-semibold">{patient.fullName}</span>
        </p>
        <p className="text-right">
          <span className="text-muted">Fecha:</span> {formatDate(rx.date, { dateStyle: 'long' })}
        </p>
        <p>
          <span className="text-muted">Edad:</span> {patient.age} años
          {rx.weightKg ? (
            <>
              <span className="text-muted"> · Peso:</span> {rx.weightKg} kg
            </>
          ) : null}
        </p>
        <p className="text-right">{patient.allergies ? <span className="font-semibold text-red-800">Alergias: {patient.allergies}</span> : <span className="text-muted">Alergias: no referidas</span>}</p>
        {rx.diagnosis && (
          <p className="col-span-2">
            <span className="text-muted">Diagnóstico:</span> {rx.diagnosis}
          </p>
        )}
      </section>

      {/* Medicamentos */}
      <section className="mt-3 flex-1">
        <p className={cn('font-bold text-brand-700', compact ? 'text-[13pt]' : 'text-[15pt]')} aria-label="Prescripción">
          Rx
        </p>
        <ol className="mt-1 grid gap-2.5">
          {rx.items.map((it, i) => (
            <li key={i} className="rx-item grid grid-cols-[1.25rem_1fr] gap-x-1">
              <span className="font-bold">{i + 1}.</span>
              <div className="min-w-0">
                <p>
                  <span className="font-bold uppercase">{it.drug}</span>
                  {it.brand && <span> ({it.brand})</span>}
                  {it.presentation && <span> — {it.presentation}</span>}
                </p>
                <Directions item={it} />
                {it.quantity && (
                  <p className="leading-snug">
                    <span className="text-muted">Cantidad:</span> {it.quantity}
                  </p>
                )}
                {it.instructions && <p className="leading-snug italic">{it.instructions}</p>}
              </div>
            </li>
          ))}
        </ol>

        {rx.generalInstructions && (
          <div className="rx-item mt-3 rounded-md bg-brand-50 px-3 py-2">
            <p className="font-semibold text-brand-700">Indicaciones generales</p>
            <p className="whitespace-pre-line">{rx.generalInstructions}</p>
          </div>
        )}
        {cancelled && rx.cancelReason && (
          <p className="mt-3 rounded-md border border-red-200 px-3 py-2 text-red-800">
            Receta cancelada el {rx.cancelledAt ? formatDate(rx.cancelledAt, { dateStyle: 'long' }) : ''}. Motivo: {rx.cancelReason}
          </p>
        )}
      </section>

      {/* Firma */}
      <section className="rx-item mt-8 flex justify-end">
        <div className="w-60 text-center">
          <div className="h-10 border-b border-ink" />
          <p className="mt-1 font-semibold leading-tight">{prescriber.name}</p>
          <p className={cn('leading-tight text-muted', compact ? 'text-[8pt]' : 'text-[9pt]')}>
            {prescriber.degrees.map((d) => `${d.cedulaLabel} ${d.cedula}`).join(' · ')}
          </p>
        </div>
      </section>

      {/* Domicilio */}
      <footer className={cn('mt-3 border-t border-line pt-1.5 text-center leading-snug text-muted', compact ? 'text-[7.5pt]' : 'text-[8.5pt]')}>
        {prescriber.address.join(' · ')}
      </footer>
    </article>
  );
}
