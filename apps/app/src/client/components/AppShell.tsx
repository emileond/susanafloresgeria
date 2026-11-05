import { Link, useRouterState } from '@tanstack/react-router';
import { CalendarDays, Home, Lock, Plus, Search, Users } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { initials } from '../../shared/format';
import { cn } from '../lib/cn';
import { useMe } from '../lib/queries';
import { NewPatientDialog } from './NewPatientDialog';
import { SearchDialog } from './SearchDialog';
import { Button } from './ui/Button';
import { Kbd } from './ui/misc';

interface UiActions {
  openSearch: () => void;
  openNewPatient: () => void;
}
const UiContext = createContext<UiActions>({ openSearch: () => {}, openNewPatient: () => {} });
export const useUi = () => useContext(UiContext);

const nav = [
  { to: '/', label: 'Inicio', icon: Home, exact: true },
  { to: '/pacientes', label: 'Pacientes', icon: Users, exact: false },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, exact: false },
] as const;

const IDLE_MS = 15 * 60 * 1000;

/** Oculta la información en pantalla tras 15 min sin actividad (p. ej. si la doctora se aleja del equipo). */
function useIdleLock() {
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLocked(true), IDLE_MS);
  }, []);
  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reset]);
  return { locked, unlock: () => (setLocked(false), reset()) };
}

export function AppShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const { data: me } = useMe();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { locked, unlock } = useIdleLock();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isActive = (to: string, exact: boolean) => (exact ? pathname === to : pathname.startsWith(to));
  const actions: UiActions = { openSearch: () => setSearchOpen(true), openNewPatient: () => setNewOpen(true) };

  return (
    <UiContext.Provider value={actions}>
      <div className="min-h-dvh lg:flex">
        {/* Barra lateral (escritorio) */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-mist/60 px-4 py-5 lg:flex print:hidden">
          <Link to="/" className="flex items-center gap-2.5 px-2">
            <img src="/logo-mark.svg" alt="" className="size-9" />
            <span className="leading-tight">
              <span className="block font-bold">Expedientes</span>
              <span className="block text-xs text-muted">Dra. Susana Flores</span>
            </span>
          </Link>

          <button
            onClick={() => setSearchOpen(true)}
            className="mt-6 flex h-11 items-center gap-2.5 rounded-xl border border-line bg-white px-3 text-sm text-muted hover:border-ink/25"
          >
            <Search className="size-4.5" aria-hidden />
            <span className="flex-1 text-left">Buscar paciente</span>
            <Kbd>⌘K</Kbd>
          </button>
          <Button className="mt-3 w-full" onClick={() => setNewOpen(true)}>
            <Plus aria-hidden />
            Nuevo paciente
          </Button>

          <nav className="mt-6 grid gap-1" aria-label="Principal">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-ink/75 hover:bg-white hover:text-ink',
                  isActive(item.to, item.exact) && 'bg-white text-brand-700 shadow-[0_1px_2px_rgba(30,27,46,0.06)]',
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>

          {me && (
            <div className="mt-auto flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{initials(me.name)}</span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold">{me.name}</span>
                <span className="block truncate text-xs text-muted">{me.email}</span>
              </span>
            </div>
          )}
        </aside>

        {/* Barra superior (móvil) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden print:hidden">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-mark.svg" alt="" className="size-8" />
            <span className="font-bold">Expedientes</span>
          </Link>
          <button onClick={() => setSearchOpen(true)} className="rounded-full p-2.5 text-ink hover:bg-mist" aria-label="Buscar paciente">
            <Search className="size-5" />
          </button>
        </header>

        <main className="min-w-0 flex-1 pb-24 lg:pb-0 print:pb-0">{children}</main>

        {/* Navegación inferior (móvil) */}
        <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
          {nav.slice(0, 2).map((item) => (
            <Link key={item.to} to={item.to} className={cn('flex flex-col items-center gap-0.5 py-2 text-xs font-semibold text-muted', isActive(item.to, item.exact) && 'text-brand-700')}>
              <item.icon className="size-5.5" aria-hidden />
              {item.label}
            </Link>
          ))}
          <button onClick={() => setNewOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-xs font-semibold text-brand-700">
            <span className="-mt-0.5 inline-flex size-7 items-center justify-center rounded-full bg-brand-700 text-white">
              <Plus className="size-4.5" aria-hidden />
            </span>
            Nuevo
          </button>
          <Link to="/agenda" className={cn('flex flex-col items-center gap-0.5 py-2 text-xs font-semibold text-muted', isActive('/agenda', false) && 'text-brand-700')}>
            <CalendarDays className="size-5.5" aria-hidden />
            Agenda
          </Link>
        </nav>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} onNewPatient={() => setNewOpen(true)} />
      <NewPatientDialog open={newOpen} onOpenChange={setNewOpen} />

      {locked && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-white/95 px-6 text-center backdrop-blur-md" role="dialog" aria-modal aria-label="Sesión en pausa">
          <span className="rounded-full bg-brand-50 p-4 text-brand-700">
            <Lock className="size-7" aria-hidden />
          </span>
          <div>
            <p className="text-xl font-bold">Sesión en pausa</p>
            <p className="mt-1 text-muted">La información se ocultó por inactividad.</p>
          </div>
          <Button onClick={unlock} autoFocus>
            Continuar
          </Button>
        </div>
      )}
    </UiContext.Provider>
  );
}
