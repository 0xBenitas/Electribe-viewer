// Persistance locale via IndexedDB (Dexie) — spec §7.4.
// v1 : métadonnées de part GLOBALES (par slot 1..16) + settings clé/valeur.
// Choix « global » (et non par-pattern comme le PartState de la spec) assumé pour
// protéger le nommage dès maintenant — cf. docs/DECISIONS.md ADR-003.
// Les tables presets / patternMeta / setlists arriveront en Phase 5+ (version 2).
import Dexie, { type Table } from 'dexie';

export interface PartMetaRow {
  /** Part id 1..16 (global, indépendant du pattern courant en v1). */
  id: number;
  customName?: string;
  customColor?: string;
  customTag?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export class EMXPilotDB extends Dexie {
  partMeta!: Table<PartMetaRow, number>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('emx-pilot');
    this.version(1).stores({
      partMeta: 'id',
      settings: 'key',
    });
  }
}

export const db = new EMXPilotDB();
