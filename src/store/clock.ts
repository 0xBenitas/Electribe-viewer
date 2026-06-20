// Coarse snapshot of the local MIDI clock, written by the rAF driver only when a
// displayed field changes (or on a ~4/s heartbeat for staleness checks). Lets
// cockpit components subscribe at bar/beat granularity instead of 60fps.

import { create } from 'zustand';

export interface ClockView {
  running: boolean;
  /** Rounded to 0.1 BPM to avoid churn from sub-tick wobble; null until known. */
  bpm: number | null;
  bar: number;
  beat: number;
  hasClock: boolean;
  /** Heartbeat timestamp (ms) — bumped each emit so staleness checks re-render. */
  at: number;
}

interface ClockStore extends ClockView {
  set: (view: ClockView) => void;
}

export const useClockStore = create<ClockStore>((set) => ({
  running: false,
  bpm: null,
  bar: 1,
  beat: 1,
  hasClock: false,
  at: 0,
  set: (view) => set(view),
}));
