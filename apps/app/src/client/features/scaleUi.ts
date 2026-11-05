import { Activity, Dumbbell, Footprints, HeartHandshake, Salad, Smile, type LucideIcon } from 'lucide-react';
import type { ScaleDefinition, Severity } from '../../shared/scales';

export const SEVERITY_TONE: Record<Severity, 'success' | 'warning' | 'danger' | 'neutral'> = {
  normal: 'success',
  mild: 'warning',
  moderate: 'warning',
  severe: 'danger',
};

/** Colores por severidad (barra, texto y fondo suave). */
export const SEVERITY_STYLE: Record<Severity, { bar: string; text: string; soft: string; ring: string; label: string }> = {
  normal: { bar: 'bg-emerald-500', text: 'text-emerald-800', soft: 'bg-emerald-50', ring: 'ring-emerald-200', label: 'Sin alteración' },
  mild: { bar: 'bg-amber-400', text: 'text-amber-800', soft: 'bg-amber-50', ring: 'ring-amber-200', label: 'Leve' },
  moderate: { bar: 'bg-orange-500', text: 'text-orange-800', soft: 'bg-orange-50', ring: 'ring-orange-200', label: 'Moderada' },
  severe: { bar: 'bg-red-600', text: 'text-red-800', soft: 'bg-red-50', ring: 'ring-red-200', label: 'Severa' },
};

export const SEVERITY_HEX: Record<Severity, string> = {
  normal: '#10b981',
  mild: '#fbbf24',
  moderate: '#f97316',
  severe: '#dc2626',
};

export const RESPONDENT_LABELS: Record<string, string> = {
  paciente: 'Paciente',
  cuidador: 'Cuidador',
  observacion: 'Observación clínica',
};

export const DOMAIN_ICON: Record<ScaleDefinition['domain'], LucideIcon> = {
  Funcionalidad: Activity,
  'Ánimo': Smile,
  'Fragilidad y sarcopenia': Dumbbell,
  'Marcha y caídas': Footprints,
  'Nutrición': Salad,
  Cuidador: HeartHandshake,
};
