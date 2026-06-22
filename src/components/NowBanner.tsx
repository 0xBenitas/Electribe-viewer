import { useSharedTransport } from '../model/useClock.ts';
import { useCueStore } from '../store/cues.ts';
import { cueStatus, CUE_LABELS } from '../model/cues.ts';
import { CUE_COLORS } from './cueColors.ts';

/** Big projectable "MAINTENANT" flash when a cue lands on the downbeat — the
 *  differentiator, made impossible to miss across the room (DESIGN.md). */
export function NowBanner() {
  const transport = useSharedTransport();
  const cues = useCueStore((s) => s.cues);
  const currentBar = transport?.bar ?? 0;
  const active = transport?.running
    ? cues.find((c) => cueStatus(c.cue, currentBar) === 'active')
    : undefined;

  if (!active) return null;
  const color = CUE_COLORS[active.cue.kind] ?? 'var(--color-orange)';

  return (
    <div
      className="card-acid animate-now flex items-center justify-between gap-4 px-6 py-3.5 text-[#0a0a0b]"
      style={{ background: color, boxShadow: '6px 6px 0 #000' }}
    >
      <div className="flex items-center gap-4">
        <span className="font-display text-3xl font-extrabold tracking-[-0.01em]">
          MAINTENANT
        </span>
        <span className="rounded-lg border-2 border-[#0a0a0b] px-3 py-1 text-sm font-bold tracking-[0.18em]">
          {CUE_LABELS[active.cue.kind]}
        </span>
      </div>
      <span className="text-xs font-semibold tracking-[0.2em]">
        AU DOWNBEAT · MESURE {String(currentBar).padStart(3, '0')}
      </span>
    </div>
  );
}
