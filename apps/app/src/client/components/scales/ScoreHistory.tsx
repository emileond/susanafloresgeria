import { formatDate } from '../../../shared/format';
import { maxOf, minOf, scaleRanges, type ScaleDefinition } from '../../../shared/scales';
import type { AssessmentItem } from '../../../shared/types';
import { SEVERITY_HEX } from '../../features/scaleUi';

/** Evolución de la puntuación en el tiempo sobre los rangos de interpretación. */
export function ScoreHistory({ scale, results }: { scale: ScaleDefinition; results: AssessmentItem[] }) {
  const points = [...results].sort((a, b) => a.performedAt.localeCompare(b.performedAt) || a.createdAt.localeCompare(b.createdAt));
  if (points.length < 2) return null;
  const W = 320;
  const H = 96;
  const PAD = { l: 26, r: 10, t: 8, b: 18 };
  const min = minOf(scale.items);
  const max = maxOf(scale.items);
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min || 1)) * (H - PAD.t - PAD.b);
  const ranges = scaleRanges(scale);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Evolución de ${scale.shortName}: ${points.map((p) => `${formatDate(p.performedAt)} ${p.score}`).join(', ')}`}>
      {ranges.map((r) => (
        <rect
          key={r.from}
          x={PAD.l}
          width={W - PAD.l - PAD.r}
          y={y(Math.min(r.to + 0.5, max))}
          height={Math.max(0, y(Math.max(r.from - 0.5, min)) - y(Math.min(r.to + 0.5, max)))}
          fill={SEVERITY_HEX[r.severity]}
          opacity={0.1}
        />
      ))}
      <text x={PAD.l - 6} y={y(max) + 3} textAnchor="end" className="fill-muted text-[9px]">
        {max}
      </text>
      <text x={PAD.l - 6} y={y(min) + 3} textAnchor="end" className="fill-muted text-[9px]">
        {min}
      </text>
      <path d={path} fill="none" stroke="var(--color-brand-700)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.score)} r={4} fill="white" stroke={SEVERITY_HEX[p.severity]} strokeWidth={2.5} />
          {(i === 0 || i === points.length - 1 || points.length <= 5) && (
            <text x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="fill-muted text-[9px]">
              {formatDate(p.performedAt, { day: 'numeric', month: 'short' })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
