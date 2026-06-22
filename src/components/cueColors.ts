import type { CueKind } from '../model/cues.ts';

/** Per-cue accent — colour carries meaning (DESIGN.md). Shared by the cue deck
 *  and the MAINTENANT banner so a kind reads the same everywhere. */
export const CUE_COLORS: Record<CueKind, string> = {
  break: 'var(--color-cyan)',
  up: 'var(--color-acid)',
  down: 'var(--color-blue)',
  drop: 'var(--color-orange)',
  cut: 'var(--color-pink)',
  custom: 'var(--color-magenta)',
};
