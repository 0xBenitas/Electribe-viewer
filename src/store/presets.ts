import { create } from 'zustand';
import { db } from '../db/schema.ts';
import type { Preset } from '../db/types.ts';

interface PresetsStore {
  presets: Preset[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (preset: Preset) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const usePresetsStore = create<PresetsStore>((set) => ({
  presets: [],
  loaded: false,
  load: async () => {
    const presets = await db.presets.orderBy('updatedAt').reverse().toArray();
    set({ presets, loaded: true });
  },
  save: async (preset) => {
    await db.presets.put(preset);
    set((s) => ({
      presets: [preset, ...s.presets.filter((p) => p.id !== preset.id)],
    }));
  },
  remove: async (id) => {
    await db.presets.delete(id);
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
  },
}));
