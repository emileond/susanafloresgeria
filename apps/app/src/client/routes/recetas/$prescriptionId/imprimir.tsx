import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Field';
import { EmptyState, ErrorState } from '../../../components/ui/misc';
import { PageLoader } from '../../../components/ui/Spinner';
import { folioLabel, PrescriptionDocument } from '../../../features/PrescriptionDocument';
import { logPrescriptionPrinted, usePrescription } from '../../../lib/queries';

export const Route = createFileRoute('/recetas/$prescriptionId/imprimir')({ component: PrintPrescriptionPage });

type PaperSize = 'half' | 'letter';
/** Márgenes de 0.4 in; la hoja impresa usa un poco menos que el alto útil para no generar una página en blanco. */
const PAPER: Record<PaperSize, { label: string; css: string; width: string; minHeight: string; printHeight: string }> = {
  half: { label: 'Media carta (14 × 21.6 cm)', css: '5.5in 8.5in', width: '5.5in', minHeight: '8.5in', printHeight: '7.6in' },
  letter: { label: 'Carta (21.6 × 27.9 cm)', css: 'letter', width: '8.5in', minHeight: '11in', printHeight: '10.1in' },
};
const STORAGE_KEY = 'rx-paper-size';

function readPaper(): PaperSize {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'letter' ? 'letter' : 'half';
  } catch {
    return 'half';
  }
}

/** En pantallas angostas reduce la hoja para que quepa completa (no afecta la impresión). */
function useFitZoom(sheetWidthIn: number) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!el) return;
    const update = () => setZoom(Math.min(1, el.clientWidth / (sheetWidthIn * 96)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, sheetWidthIn]);
  return { ref: setEl, zoom };
}

/** Vista de impresión: «Imprimir / Guardar como PDF» usa el diálogo del navegador. */
function PrintPrescriptionPage() {
  const { prescriptionId } = Route.useParams();
  const rx = usePrescription(prescriptionId);
  const [paper, setPaper] = useState<PaperSize>(readPaper);
  const fit = useFitZoom(paper === 'half' ? 5.5 : 8.5);

  if (rx.isPending) return <PageLoader />;
  if (rx.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState error={rx.error} onRetry={() => rx.refetch()} />
      </div>
    );
  }
  const data = rx.data;
  const back = (
    <Link
      to="/pacientes/$patientId/recetas/$prescriptionId"
      params={{ patientId: data.patientId, prescriptionId: data.id }}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden /> Volver a la receta
    </Link>
  );

  if (data.status === 'draft' || !data.snapshot) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        {back}
        <div className="mt-4">
          <EmptyState title="Esta receta todavía es un borrador" text="Emítala para poder imprimirla o guardarla como PDF." />
        </div>
      </div>
    );
  }

  const size = PAPER[paper];
  const changePaper = (p: PaperSize) => {
    setPaper(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // Sin almacenamiento local: se usa el tamaño elegido solo en esta visita.
    }
  };
  const print = () => {
    void logPrescriptionPrinted(data.id);
    window.print();
  };

  return (
    <div className="px-4 pt-4 pb-10 sm:px-8 sm:pt-8 print:p-0">
      <style>{`@page { size: ${size.css}; margin: 0.4in; } @media print { .rx-paper { min-height: ${size.printHeight} !important; zoom: 1 !important; } }`}</style>
      <title>{`Receta ${folioLabel(data.folio)}`}</title>

      <div className="mx-auto flex max-w-[8.5in] flex-col gap-3 print:hidden">
        {back}
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-mist/60 p-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block">
            <span className="field-label">Tamaño de papel</span>
            <Select value={paper} onChange={(e) => changePaper(e.target.value as PaperSize)} className="sm:w-64">
              {(Object.keys(PAPER) as PaperSize[]).map((k) => (
                <option key={k} value={k}>
                  {PAPER[k].label}
                </option>
              ))}
            </Select>
          </label>
          <Button onClick={print}>
            <Printer aria-hidden /> Imprimir / Guardar como PDF
          </Button>
        </div>
        {data.status === 'cancelled' && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Esta receta está cancelada; se imprime con la marca «CANCELADA».</p>
        )}
        <p className="text-sm text-muted">Para PDF, elija «Guardar como PDF» como destino en el diálogo de impresión.</p>
      </div>

      {/* Hoja: en pantalla con el tamaño del papel (desplazable en móvil); al imprimir ocupa la página. */}
      <div ref={fit.ref} className="mt-5 pb-2 print:mt-0 print:pb-0">
        <div
          className="rx-paper mx-auto flex flex-col rounded-sm bg-white p-[0.4in] shadow-[0_1px_3px_rgba(30,27,46,0.12),0_8px_24px_rgba(30,27,46,0.08)] ring-1 ring-line print:w-auto! print:rounded-none print:p-0! print:shadow-none print:ring-0"
          style={{ width: size.width, minHeight: size.minHeight, zoom: fit.zoom }}
        >
          <PrescriptionDocument rx={data} size={paper} />
        </div>
      </div>
    </div>
  );
}
