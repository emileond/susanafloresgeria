import type { Severity } from '../../shared/scales';

export const SEVERITY_TONE: Record<Severity, 'success' | 'warning' | 'danger' | 'neutral'> = {
  normal: 'success',
  mild: 'warning',
  moderate: 'warning',
  severe: 'danger',
};

export const RESPONDENT_LABELS: Record<string, string> = {
  paciente: 'Paciente',
  cuidador: 'Cuidador',
  observacion: 'Observación clínica',
};
