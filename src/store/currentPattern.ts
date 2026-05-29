import { create } from 'zustand';
import type { ParsedPattern } from '../midi/sysex/parser.ts';

interface CurrentPatternStore {
  pattern: ParsedPattern | null;
  /** Updated when the app receives a Current Pattern Dump (spec §1.2). */
  hydratedAt: number | null;
  setPattern: (pattern: ParsedPattern) => void;
}

export const useCurrentPatternStore = create<CurrentPatternStore>((set) => ({
  pattern: null,
  hydratedAt: null,
  setPattern: (pattern) => set({ pattern, hydratedAt: Date.now() }),
}));
