import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
import { PageLoader } from '../components/ui/Spinner';
import { useMe } from '../lib/queries';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="text-xl font-bold">Página no encontrada</p>
      <Link to="/" className="mt-4 inline-block font-semibold text-brand-700 underline">
        Volver al inicio
      </Link>
    </div>
  ),
});

function Root() {
  const me = useMe();
  if (me.isPending) return <PageLoader />;
  if (me.isError) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <img src="/logo-mark.svg" alt="" className="mx-auto size-12" />
        <p className="mt-5 text-xl font-bold">No tiene acceso</p>
        <p className="mt-2 text-muted">{me.error.message}</p>
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
