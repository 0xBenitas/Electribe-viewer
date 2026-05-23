import { create } from 'zustand';
import type { ParsedPattern } from '../midi/sysex/parser.ts';

interface CurrentPatternStore {
  pattern: ParsedPattern | null;
  /** Dump brut décodé (16384 octets) tel que reçu — base d'un Pattern Write byte-exact. */
  raw: Uint8Array | null;
  /** Updated when the app receives a Current Pattern Dump (spec §1.2). */
  hydratedAt: number | null;
  setPattern: (pattern: ParsedPattern, raw?: Uint8Array) => void;
}

export const useCurrentPatternStore = create<CurrentPatternStore>((set) => ({
  pattern: null,
  raw: null,
  hydratedAt: null,
  setPattern: (pattern, raw) =>
    set((s) => ({ pattern, raw: raw ?? s.raw, hydratedAt: Date.now() })),
}));
