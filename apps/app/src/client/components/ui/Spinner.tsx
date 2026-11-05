import { cn } from '../../lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn('inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70', className)}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-48 items-center justify-center text-brand-700">
      <Spinner className="size-7" />
    </div>
  );
}
