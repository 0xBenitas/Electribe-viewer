// Pure BPM estimation from MIDI clock tick intervals.
// Median over a sliding window rejects jitter (GC pauses, scheduling hiccups)
// far better than a mean, without lagging like a long EMA.

import { PPQN } from './types.ts';

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Estimate BPM from the elapsed-ms intervals between consecutive 0xF8 ticks.
 * Returns null until at least `minSamples` intervals are available.
 */
export function bpmFromTickIntervals(
  intervalsMs: readonly number[],
  minSamples = 4,
): number | null {
  if (intervalsMs.length < minSamples) return null;
  const msPerTick = median(intervalsMs);
  if (!(msPerTick > 0)) return null;
  const msPerQuarter = msPerTick * PPQN;
  return 60000 / msPerQuarter;
}
