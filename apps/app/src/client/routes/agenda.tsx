import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, ChevronLeft, ChevronRight, House, Plus, RefreshCw, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { formatDate, todayISO } from '../../shared/format';
import { addDaysKey, hhmm, startOfDayKey, weekStartKey, zonedParts } from '../../shared/time';
import type { AppointmentItem } from '../../shared/types';
import { AppointmentDialog, STATUS_LABELS, type DialogState } from '../components/agenda/AppointmentDialog';
import { Button } from '../components/ui/Button';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { useAppointmentMutations, useAppointments, usePatient, useSyncStatus } from '../lib/queries';

const VIEWS = ['dia', 'semana', 'lista'] as const;
type View = (typeof VIEWS)[number];

export const Route = createFileRoute('/agenda')({
  validateSearch: z.object({
    vista: z.enum(VIEWS).optional(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** Paciente para abrir directamente "Nueva cita" (solo el id, nunca el nombre). */
    nuevo: z.uuid().optional(),
  }),
  component: AgendaPage,
});

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 60;
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  return h < 24 ? `hace ${h} h` : `el ${formatDate(iso)}`;
}

function AgendaPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const view: View = search.vista ?? (isMobile ? 'dia' : 'semana');
  const dateKey = search.fecha ?? todayISO();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  // Abrir "Nueva cita" con un paciente preseleccionado (desde su expediente).
  const prefill = usePatient(search.nuevo ?? '');
  useEffect(() => {
    if (search.nuevo && prefill.data) {
      setDialog({ mode: 'create', dateKey, time: '10:00', patient: { id: prefill.data.id, name: prefill.data.fullName } });
      void navigate({ search: (s) => ({ ...s, nuevo: undefined }), replace: true });
    }
  }, [search.nuevo, prefill.data, dateKey, navigate]);

  const days = useMemo(() => {
    if (view === 'dia') return [dateKey];
    const start = view === 'semana' ? weekStartKey(dateKey) : dateKey;
    return Array.from({ length: view === 'semana' ? 7 : 14 }, (_, i) => addDaysKey(start, i));
  }, [view, dateKey]);

  const from = startOfDayKey(days[0]!).toISOString();
  const to = startOfDayKey(addDaysKey(days.at(-1)!, 1)).toISOString();
  const list = useAppointments(from, to);
  const sync = useSyncStatus();
  const m = useAppointmentMutations();

  const go = (delta: number) => void navigate({ search: (s) => ({ ...s, fecha: addDaysKey(dateKey, delta * (view === 'dia' ? 1 : view === 'semana' ? 7 : 14)) }) });
  const setView = (v: View) => void navigate({ search: (s) => ({ ...s, vista: v }) });

  const label =
    view === 'dia'
      ? capitalize(formatDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long' }))
      : `${formatDate(days[0]!, { day: 'numeric', month: 'short' })} – ${formatDate(days.at(-1)!, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const runSync = async () => {
    try {
      const r = await m.sync.mutateAsync();
      void sync.refetch();
      if (r.status === 'error') toast.error(r.message ?? 'No se pudo sincronizar.');
      else toast.success(`Doctoralia sincronizado: ${r.added} nuevas, ${r.updated} actualizadas, ${r.cancelled} canceladas`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo sincronizar.');
    }
  };

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();
    for (const a of list.data ?? []) {
      const k = zonedParts(a.startsAt).dateKey;
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return map;
  }, [list.data]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8">
      {/* Barra de herramientas */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-2xl sm:text-[1.75rem]">Agenda</h1>
          <div className="inline-flex rounded-xl border border-line">
            <button onClick={() => go(-1)} className="rounded-l-xl px-2.5 py-2 hover:bg-mist" aria-label="Anterior">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => void navigate({ search: (s) => ({ ...s, fecha: undefined }) })} className="border-x border-line px-3 text-sm font-semibold hover:bg-mist">
              Hoy
            </button>
            <button onClick={() => go(1)} className="rounded-r-xl px-2.5 py-2 hover:bg-mist" aria-label="Siguiente">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <span className="text-[15px] font-semibold">{label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-mist p-1" role="tablist" aria-label="Vista">
            {VIEWS.map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold capitalize', view === v ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink')}
              >
                {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Lista'}
              </button>
            ))}
          </div>
          <Button onClick={() => setDialog({ mode: 'create', dateKey, time: '10:00' })}>
            <Plus aria-hidden /> Nueva cita
          </Button>
        </div>
      </div>

      {/* Estado de la sincronización con Doctoralia */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-teal-500" aria-hidden /> Doctoralia
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-brand-600" aria-hidden /> Agendadas aquí
        </span>
        <span className="text-muted">·</span>
        {sync.data?.configured ? (
          <>
            <span className={cn('text-muted', sync.data.lastRun?.status === 'error' && 'font-semibold text-red-700')}>
              {sync.data.lastRun
                ? sync.data.lastRun.status === 'error'
                  ? `Error al sincronizar: ${sync.data.lastRun.message ?? ''}`
                  : `Sincronizado ${relativeTime(sync.data.lastRun.finishedAt)}`
                : 'Aún no sincronizado'}
            </span>
            <button onClick={runSync} disabled={m.sync.isPending} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline disabled:opacity-60">
              <RefreshCw className={cn('size-3.5', m.sync.isPending && 'animate-spin')} aria-hidden /> Sincronizar
            </button>
          </>
        ) : (
          <span className="text-muted">Sincronización con Doctoralia sin configurar (ver README de la app).</span>
        )}
      </div>

      <div className="mt-5">
        {view === 'lista' ? (
          <AgendaList days={days} byDay={byDay} onOpen={(a) => setDialog({ mode: 'edit', appt: a })} />
        ) : (
          <TimeGrid
            days={days}
            byDay={byDay}
            onSlot={(d, t) => setDialog({ mode: 'create', dateKey: d, time: t })}
            onOpen={(a) => setDialog({ mode: 'edit', appt: a })}
            onPickDay={view === 'semana' ? (d) => void navigate({ search: (s) => ({ ...s, vista: 'dia', fecha: d }) }) : undefined}
          />
        )}
      </div>

      {dialog && <AppointmentDialog key={dialog.mode === 'edit' ? dialog.appt.id : 'new'} state={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ModalityIcon({ a, className }: { a: AppointmentItem; className?: string }) {
  if (a.modality === 'domicilio') return <House className={className} aria-label="Domicilio" />;
  if (a.modality === 'en_linea') return <Video className={className} aria-label="En línea" />;
  return null;
}

const eventTone = (a: AppointmentItem) =>
  a.status === 'cancelled'
    ? 'border-line bg-mist text-muted line-through'
    : a.source === 'doctoralia'
      ? 'border-teal-500 bg-teal-50 text-teal-950 hover:bg-teal-100'
      : 'border-brand-600 bg-brand-50 text-brand-950 hover:bg-brand-100';

/** Coloca las citas que se traslapan en columnas lado a lado. */
function layout(items: AppointmentItem[]) {
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const out: { a: AppointmentItem; col: number; cols: number }[] = [];
  let group: { a: AppointmentItem; col: number }[] = [];
  let groupEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => out.push({ ...g, cols }));
    group = [];
  };
  for (const a of sorted) {
    const s = Date.parse(a.startsAt);
    if (group.length && s >= groupEnd) flush();
    const used = new Set(group.filter((g) => Date.parse(g.a.endsAt) > s).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ a, col });
    groupEnd = Math.max(groupEnd, Date.parse(a.endsAt));
  }
  flush();
  return out;
}

function TimeGrid({
  days,
  byDay,
  onSlot,
  onOpen,
  onPickDay,
}: {
  days: string[];
  byDay: Map<string, AppointmentItem[]>;
  onSlot: (dateKey: string, time: string) => void;
  onOpen: (a: AppointmentItem) => void;
  onPickDay?: (dateKey: string) => void;
}) {
  const today = todayISO();
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const [now, setNow] = useState(() => zonedParts(new Date()));
  useEffect(() => {
    const t = setInterval(() => setNow(zonedParts(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowTop = (now.hour + now.minute / 60 - START_HOUR) * HOUR_PX;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <div className={cn(days.length > 1 && 'min-w-[760px]')}>
          {/* Encabezado de días */}
          <div className="grid border-b border-line bg-mist/50" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
            <div />
            {days.map((d) => {
              const [, , dd] = d.split('-');
              const wd = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
              const count = (byDay.get(d) ?? []).filter((a) => a.status !== 'cancelled').length;
              return (
                <button
                  key={d}
                  disabled={!onPickDay}
                  onClick={() => onPickDay?.(d)}
                  className={cn('flex flex-col items-center gap-0.5 border-l border-line py-2 text-sm', onPickDay && 'hover:bg-white')}
                >
                  <span className="text-xs font-semibold text-muted uppercase">{WEEKDAYS[wd]}</span>
                  <span className={cn('inline-flex size-8 items-center justify-center rounded-full text-base font-bold', d === today && 'bg-brand-700 text-white')}>{Number(dd)}</span>
                  <span className="h-4 text-[11px] text-muted">{count ? `${count} cita${count > 1 ? 's' : ''}` : ''}</span>
                </button>
              );
            })}
          </div>

          {/* Rejilla de horas */}
          <div className="relative grid max-h-[68vh] overflow-y-auto" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="relative border-b border-line/60 text-right" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-2 right-2 bg-white px-0.5 text-[11px] font-semibold text-muted tabular-nums">{hhmm(h, 0)}</span>
                </div>
              ))}
            </div>
            {days.map((d) => (
              <div key={d} className={cn('relative border-l border-line', d === today && 'bg-brand-50/30')}>
                {hours.map((h) => (
                  <div key={h} className="border-b border-line/60" style={{ height: HOUR_PX }}>
                    {[0, 30].map((mi) => (
                      <button
                        key={mi}
                        onClick={() => onSlot(d, hhmm(h, mi))}
                        className="block h-1/2 w-full hover:bg-brand-50"
                        aria-label={`Nueva cita ${formatDate(d)} ${hhmm(h, mi)}`}
                      />
                    ))}
                  </div>
                ))}
                {d === today && nowTop > 0 && nowTop < hours.length * HOUR_PX && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: nowTop }} aria-hidden>
                    <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-red-500" />
                  </div>
                )}
                {layout(byDay.get(d) ?? []).map(({ a, col, cols }) => {
                  const s = zonedParts(a.startsAt);
                  const e = zonedParts(a.endsAt);
                  const startH = Math.max(s.hour + s.minute / 60, START_HOUR);
                  const endH = Math.min(e.dateKey === s.dateKey ? e.hour + e.minute / 60 : END_HOUR, END_HOUR);
                  const top = (startH - START_HOUR) * HOUR_PX;
                  const height = Math.max((endH - startH) * HOUR_PX - 2, 22);
                  return (
                    <button
                      key={a.id}
                      onClick={() => onOpen(a)}
                      className={cn('absolute z-[5] overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs shadow-sm transition-colors', eventTone(a))}
                      style={{ top: top + 1, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                    >
                      <span className="flex items-center gap-1 font-bold tabular-nums">
                        {hhmm(s.hour, s.minute)}
                        <ModalityIcon a={a} className="size-3" />
                        {a.status === 'done' && <Check className="size-3 text-emerald-700" aria-label="Atendida" />}
                      </span>
                      <span className="block truncate font-semibold">{a.patientName ?? a.title ?? 'Cita'}</span>
                      {height > 44 && a.patientName && a.title && <span className="block truncate opacity-75">{a.title}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgendaList({ days, byDay, onOpen }: { days: string[]; byDay: Map<string, AppointmentItem[]>; onOpen: (a: AppointmentItem) => void }) {
  const withAppointments = days.filter((d) => (byDay.get(d) ?? []).length);
  if (!withAppointments.length) {
    return <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">No hay citas en estos 14 días.</p>;
  }
  return (
    <div className="grid gap-5">
      {withAppointments.map((d) => (
        <section key={d}>
          <h2 className={cn('mb-2 text-sm font-bold', d === todayISO() ? 'text-brand-700' : 'text-ink/80')}>
            {d === todayISO() ? 'Hoy · ' : ''}
            {capitalize(formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}
          </h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {(byDay.get(d) ?? []).map((a) => {
              const s = zonedParts(a.startsAt);
              const e = zonedParts(a.endsAt);
              return (
                <li key={a.id} className="flex items-center gap-2 pr-3 hover:bg-mist/60">
                  <button onClick={() => onOpen(a)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
                    <span className={cn('h-10 w-1 shrink-0 rounded-full', a.status === 'cancelled' ? 'bg-line' : a.source === 'doctoralia' ? 'bg-teal-500' : 'bg-brand-600')} aria-hidden />
                    <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                      {hhmm(s.hour, s.minute)}–{hhmm(e.hour, e.minute)}
                    </span>
                    <span className={cn('min-w-0 flex-1', a.status === 'cancelled' && 'text-muted line-through')}>
                      <span className="block truncate font-semibold">{a.patientName ?? a.title ?? 'Cita'}</span>
                      <span className="flex items-center gap-1.5 text-sm text-muted">
                        <ModalityIcon a={a} className="size-3.5" />
                        {a.source === 'doctoralia' ? 'Doctoralia' : 'Agendada aquí'}
                        {a.status !== 'scheduled' && ` · ${STATUS_LABELS[a.status]}`}
                      </span>
                    </span>
                  </button>
                  {a.patientId && (
                    <Link
                      to="/pacientes/$patientId"
                      params={{ patientId: a.patientId }}
                      className="hidden shrink-0 rounded-lg border border-line px-2.5 py-1 text-sm font-semibold hover:bg-white sm:inline-block"
                    >
                      Expediente
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
