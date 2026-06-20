// Live cues for the cockpit — bar-aligned signals from any peer (and our own).

import { create } from 'zustand';
import { cueStatus, type ReceivedCue } from '../model/cues.ts';

interface CueStore {
  cues: ReceivedCue[];
  /** Add a cue; ignores duplicates by id (idempotent relay). */
  add: (received: ReceivedCue) => void;
  /** Drop cues whose target bar has passed. */
  prune: (currentBar: number) => void;
  clear: () => void;
}

export const useCueStore = create<CueStore>((set) => ({
  cues: [],

  add: (received) =>
    set((s) =>
      s.cues.some((c) => c.cue.id === received.cue.id)
        ? {}
        : { cues: [...s.cues, received] },
    ),

  prune: (currentBar) =>
    set((s) => {
      const live = s.cues.filter(
        (c) => cueStatus(c.cue, currentBar) !== 'expired',
      );
      return live.length === s.cues.length ? {} : { cues: live };
    }),

  clear: () => set({ cues: [] }),
}));
