import { createFileRoute } from '@tanstack/react-router';
import { CalendarDays } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/ui/misc';

export const Route = createFileRoute('/agenda')({ component: Agenda });

function Agenda() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader title="Agenda" />
      <div className="mt-6">
        <EmptyState
          icon={<CalendarDays />}
          title="La agenda llega en la siguiente versión"
          text="Aquí verá sus citas directas y las de Doctoralia en una sola vista."
        />
      </div>
    </div>
  );
}
