import { maxOf, minOf, scaleRanges, type ScaleDefinition } from '../../../shared/scales';
import { cn } from '../../lib/cn';
import { SEVERITY_STYLE } from '../../features/scaleUi';

/**
 * Barra con los rangos de interpretación de la escala y un marcador en la puntuación.
 * Hace evidente qué tan lejos está el resultado de lo normal.
 */
export function ScoreGauge({ scale, score, showLegend = true, className }: { scale: ScaleDefinition; score: number | null; showLegend?: boolean; className?: string }) {
  const min = minOf(scale.items);
  const max = maxOf(scale.items);
  const span = max - min + 1;
  const ranges = scaleRanges(scale);
  const pos = score === null ? null : ((Math.min(Math.max(score, min), max) - min + 0.5) / span) * 100;
  const current = score === null ? null : ranges.find((r) => score >= r.from && score <= r.to);

  return (
    <div className={className}>
      <div className="relative pt-5">
        {pos !== null && (
          <span className="absolute top-0 -translate-x-1/2 text-xs font-bold text-ink" style={{ left: `${pos}%` }} aria-hidden>
            ▼
          </span>
        )}
        <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={current ? `Puntuación ${score}: ${current.interpretation}` : 'Rangos de la escala'}>
          {ranges.map((r) => (
            <div
              key={r.from}
              title={`${r.from === r.to ? r.from : `${r.from}–${r.to}`}: ${r.interpretation}`}
              className={cn('h-full border-r-2 border-white last:border-r-0', SEVERITY_STYLE[r.severity].bar, current && current !== r && 'opacity-35')}
              style={{ width: `${((r.to - r.from + 1) / span) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] font-semibold text-muted">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
      {showLegend && (
        <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
          {[...ranges].reverse().map((r) => (
            <li key={r.from} className={cn('flex items-center gap-2 rounded-md px-1.5 py-0.5', current === r && cn(SEVERITY_STYLE[r.severity].soft, 'font-semibold'))}>
              <span className={cn('size-2.5 shrink-0 rounded-full', SEVERITY_STYLE[r.severity].bar)} aria-hidden />
              <span className="w-12 shrink-0 tabular-nums text-muted">{r.from === r.to ? r.from : `${r.from}–${r.to}`}</span>
              <span className="text-ink/85">{r.interpretation}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
