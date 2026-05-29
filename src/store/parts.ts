import { create } from 'zustand';
import { db } from '../db/schema.ts';

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
  /** Hydrate custom metadata from IndexedDB (call once at startup). */
  loadMetadata: () => Promise<void>;
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
    set((s) => {
      const parts = s.parts.map((p) => (p.id === id ? { ...p, ...meta } : p));
      const updated = parts.find((p) => p.id === id);
      if (updated) {
        // Persist through to IndexedDB (fire-and-forget, spec §7.4 / ADR-003).
        void db.partMeta.put({
          id,
          customName: updated.customName,
          customColor: updated.customColor,
          customTag: updated.customTag,
        });
      }
      return { parts };
    }),
  loadMetadata: async () => {
    const rows = await db.partMeta.toArray();
    if (rows.length === 0) return;
    const byId = new Map(rows.map((r) => [r.id, r]));
    set((s) => ({
      parts: s.parts.map((p) => {
        const r = byId.get(p.id);
        return r
          ? {
              ...p,
              customName: r.customName,
              customColor: r.customColor,
              customTag: r.customTag,
            }
          : p;
      }),
    }));
  },
}));
