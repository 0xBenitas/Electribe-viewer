// MIDI real-time clock — shared types.
//
// HARDWARE NOTE: the Electribe 2's clock emission (whether it sends 0xF8 by
// default, transport, PPQN) is NOT validated on hardware yet (see the clock
// research note / docs). This module is standard-MIDI correct (24 PPQN) and
// proven by synthetic tests; it tolerates the absence of a clock gracefully.
// Any machine acting as clock master in the crew can drive it.

/** MIDI standard: timing clocks per quarter note. */
export const PPQN = 24;

export interface TimeSignature {
  /** Beats per bar (numerator). Clock counting is quarter-note based. */
  beatsPerBar: number;
}

export interface ClockSnapshot {
  /** Running after Start/Continue, stopped after Stop. */
  running: boolean;
  /** Estimated tempo, or null until enough ticks are observed. */
  bpm: number | null;
  /** 1-based bar since the last Start / Song Position. */
  bar: number;
  /** 1-based beat within the bar. */
  beat: number;
  /** Phase within the current beat, 0..1 — the visual lighthouse (§5). */
  phase: number;
  /** Tick count since the last Start / Song Position reference. */
  tick: number;
  /** A clock tick was seen recently (within the stale window). */
  hasClock: boolean;
}
