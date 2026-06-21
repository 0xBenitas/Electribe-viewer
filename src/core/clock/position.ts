// Pure bar/beat/phase derivation from an absolute tick count.

import { PPQN } from './types.ts';

export interface BarPosition {
  /** 1-based bar. */
  bar: number;
  /** 1-based beat within the bar. */
  beat: number;
  /** Tick within the current beat, 0..PPQN-1. */
  tickInBeat: number;
  /** Phase within the current beat, 0..1. */
  phase: number;
}

export function barBeatFromTicks(
  positionTicks: number,
  beatsPerBar: number,
): BarPosition {
  const ticks = Math.max(0, Math.floor(positionTicks));
  const ticksPerBar = PPQN * beatsPerBar;
  const bar = Math.floor(ticks / ticksPerBar) + 1;
  const tickInBar = ticks % ticksPerBar;
  const beat = Math.floor(tickInBar / PPQN) + 1;
  const tickInBeat = tickInBar % PPQN;
  return { bar, beat, tickInBeat, phase: tickInBeat / PPQN };
}
