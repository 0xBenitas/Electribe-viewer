// Capture / recall de presets de son (spec §8.3 F3).
// Phase 5a : capture complète + recall des params CC (live, non destructif) sur le
// part actif. Les params SysEx-only (oscType, filterType, ifxType, voiceAssign, …)
// ne sont PAS appliqués ici : ils exigent un Pattern Write (Phase 5b, écriture machine).
import type { ParsedPart } from './sysex/parser.ts';
import type { PartSound, PresetCategory } from '../db/types.ts';
import { type CCParam } from './ccMap.ts';
import { oscByRaw } from '../data/oscillators.ts';

/** Retire la séquence : un preset capture le son, pas les steps. */
export function partToSound(part: ParsedPart): PartSound {
  const { steps: _steps, ...sound } = part;
  void _steps;
  return sound;
}

/** Params « son » qui ne sont PAS pilotables par CC → recall via Pattern Write seulement. */
export const SYSEX_ONLY_PARAMS = [
  'oscType',
  'voiceAssign',
  'filterType',
  'modType',
  'ifxType',
  'motionSeqMode',
  'grooveType',
  'grooveDepth',
  'partPriority',
  'lastStep',
  'trgPadVelocity',
  'scaleMode',
  'egOn',
  'mute',
] as const;

export interface CCRecallStep {
  param: CCParam;
  value: number;
}

/**
 * Plan des CC à émettre pour recall d'un son sur le part actif. Valeurs déjà
 * décodées (app values) ; l'envoi (encodage + throttle) est fait par `sendParam`.
 */
export function ccRecallPlan(sound: PartSound): CCRecallStep[] {
  return [
    { param: 'ampLevel', value: sound.ampLevel },
    { param: 'ampPan', value: sound.ampPan },
    { param: 'filterReso', value: sound.filterReso },
    { param: 'egDecay', value: sound.egDecay },
    { param: 'egAttack', value: sound.egAttack },
    { param: 'filterCutoff', value: sound.filterCutoff },
    { param: 'oscPitch', value: sound.oscPitch },
    { param: 'oscGlide', value: sound.oscGlide },
    { param: 'oscEdit', value: sound.oscEdit },
    { param: 'filterEgInt', value: sound.filterEgInt },
    { param: 'modDepth', value: sound.modDepth },
    { param: 'modSpeed', value: sound.modSpeed },
    { param: 'ifxEdit', value: sound.ifxEdit },
    { param: 'ifxOnOff', value: sound.ifxOn ? 1 : 0 },
    { param: 'mfxSendOnOff', value: sound.mfxSend ? 1 : 0 },
  ];
}

const CAT_MAP: Record<string, PresetCategory> = {
  Kick: 'Kick',
  Snare: 'Snare',
  Clap: 'Clap',
  HiHat: 'HiHat',
  Cymbal: 'Cymbal',
  Tom: 'Tom',
  Percussion: 'Percussion',
  Voice: 'Voice',
  'Synth FX': 'FX',
  'Synth Hit': 'Stab',
  'Inst.Hit': 'Stab',
  Synth: 'Lead',
  Instrument: 'Other',
  'Audio In': 'Other',
};

/** Catégorie de preset déduite de l'oscillateur du part. */
export function autoCategory(oscType: number): PresetCategory {
  const cat = oscByRaw(oscType)?.category;
  return (cat && CAT_MAP[cat]) || 'Other';
}
