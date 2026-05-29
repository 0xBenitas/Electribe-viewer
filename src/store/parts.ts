import { create } from 'zustand';

export type PartId = number; // 1..16

export interface PartMeta {
  id: PartId;
  customName?: string;
  customColor?: string;
  customTag?: string;
}

interface PartsStore {
  parts: PartMeta[];
  /** Part selected in the app UI (not necessarily the machine's edit part). */
  selectedPartId: PartId;
  /** Active edit part on the machine (ADR-001: from incoming CC channel). */
  activePartId: PartId | null;
  selectPart: (id: PartId) => void;
  setActivePart: (id: PartId | null) => void;
  setMetadata: (id: PartId, meta: Partial<Omit<PartMeta, 'id'>>) => void;
}

const initialParts = (): PartMeta[] =>
  Array.from({ length: 16 }, (_, i) => ({ id: i + 1 }));

export const usePartsStore = create<PartsStore>((set) => ({
  parts: initialParts(),
  selectedPartId: 1,
  activePartId: null,
  selectPart: (id) => set({ selectedPartId: id }),
  setActivePart: (id) => set({ activePartId: id }),
  setMetadata: (id, meta) =>
    set((s) => ({
      parts: s.parts.map((p) => (p.id === id ? { ...p, ...meta } : p)),
    })),
}));
