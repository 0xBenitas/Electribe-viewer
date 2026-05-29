import { create } from 'zustand';
import type { KnobMode } from '../midi/sysex/globalDump.ts';

interface GlobalsStore {
  knobMode: KnobMode | null;
  setKnobMode: (mode: KnobMode) => void;
}

export const useGlobalsStore = create<GlobalsStore>((set) => ({
  knobMode: null,
  setKnobMode: (knobMode) => set({ knobMode }),
}));
