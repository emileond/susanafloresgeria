import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'warning' | 'danger' | 'success'; className?: string }) {
  const tones = {
    neutral: 'bg-mist text-ink/80',
    brand: 'bg-brand-50 text-brand-700',
    warning: 'bg-amber-50 text-amber-800',
    danger: 'bg-red-50 text-red-700',
    success: 'bg-emerald-50 text-emerald-800',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon ? <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-700 [&_svg]:size-6">{icon}</div> : null}
      <p className="text-base font-semibold">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-sm text-muted">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'No se pudo cargar la información.';
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
      {message}
      {onRetry ? (
        <button className="ml-2 font-semibold underline" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 font-sans text-xs font-semibold text-muted">{children}</kbd>;
}
