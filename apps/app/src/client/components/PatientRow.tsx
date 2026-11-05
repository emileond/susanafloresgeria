import { Link } from '@tanstack/react-router';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { SEX_LABELS } from '../../shared/constants';
import { ageFromBirthDate, formatDate, initials } from '../../shared/format';
import type { PatientListItem } from '../../shared/types';
import { Badge } from './ui/misc';

export function PatientRow({ p }: { p: PatientListItem }) {
  return (
    <Link
      to="/pacientes/$patientId"
      params={{ patientId: p.id }}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-mist/70 sm:px-5"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{initials(p.fullName)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{p.fullName}</span>
          {p.archivedAt && <Badge>Archivado</Badge>}
          {p.allergies && (
            <Badge tone="danger">
              <AlertTriangle className="size-3" aria-hidden /> Alergias
            </Badge>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-muted">
          {ageFromBirthDate(p.birthDate)} años · {SEX_LABELS[p.sex]}
          {p.phone ? ` · ${p.phone}` : ''}
        </span>
      </span>
      <span className="hidden text-right text-sm text-muted sm:block">{p.lastVisitAt ? <>Última consulta<br />{formatDate(p.lastVisitAt)}</> : 'Sin consultas'}</span>
      <ChevronRight className="size-5 text-muted/60 group-hover:text-ink" aria-hidden />
    </Link>
  );
}
