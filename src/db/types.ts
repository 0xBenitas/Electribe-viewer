// Entités de bibliothèque persistées (spec §7.3).
import type { ParsedPart } from '../midi/sysex/parser.ts';

export type PresetCategory =
  | 'Kick'
  | 'Snare'
  | 'Clap'
  | 'HiHat'
  | 'Cymbal'
  | 'Tom'
  | 'Percussion'
  | 'Bass'
  | 'Lead'
  | 'Pad'
  | 'Stab'
  | 'FX'
  | 'Voice'
  | 'Other';

export const PRESET_CATEGORIES: readonly PresetCategory[] = [
  'Kick',
  'Snare',
  'Clap',
  'HiHat',
  'Cymbal',
  'Tom',
  'Percussion',
  'Bass',
  'Lead',
  'Pad',
  'Stab',
  'FX',
  'Voice',
  'Other',
];

/** Paramètres « son » d'un part, sans la séquence (les steps ne font pas partie d'un preset). */
export type PartSound = Omit<ParsedPart, 'steps'>;

export interface Preset {
  id: string; // crypto.randomUUID()
  name: string;
  category: PresetCategory;
  tags: string[];
  params: PartSound;
  /** Nom d'oscillateur dénormalisé au moment du save (affichage). */
  oscName?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
