import { create } from 'zustand';
import type { CCParam } from '../midi/ccMap.ts';

export type ParamValues = Partial<Record<CCParam, number>>;

interface ParamsStore {
  /** Decoded app values, keyed by 1-based part id. */
  byPart: Record<number, ParamValues>;
  /** Optimistic local update (slider moved in the app). */
  setLocal: (partId: number, param: CCParam, value: number) => void;
  /** Reconcile from an incoming CC (knob turned on the machine). */
  applyIncoming: (partId: number, param: CCParam, value: number) => void;
  /** Replace all part values from a parsed Pattern Dump (Phase 4). */
  hydrate: (byPart: Record<number, ParamValues>) => void;
}

const writeValue = (
  state: ParamsStore,
  partId: number,
  param: CCParam,
  value: number,
): Pick<ParamsStore, 'byPart'> => ({
  byPart: {
    ...state.byPart,
    [partId]: { ...state.byPart[partId], [param]: value },
  },
});

export const useParamsStore = create<ParamsStore>((set) => ({
  byPart: {},
  setLocal: (partId, param, value) =>
    set((s) => writeValue(s, partId, param, value)),
  applyIncoming: (partId, param, value) =>
    set((s) => writeValue(s, partId, param, value)),
  hydrate: (byPart) => set({ byPart }),
}));
