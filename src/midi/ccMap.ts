// Complete CC map (spec §6.4), verified against the Korg MIDI implementation.
// ⚠️ These CC affect the part currently selected for editing on the machine
// (ADR-001). The app sends them on the active part's channel.

import {
  decodePan,
  decodeSigned,
  decodeToggle,
  encodePan,
  encodeSigned,
  encodeToggle,
  encodeUnsigned,
  type CCEncoding,
} from './encoding.ts';

export interface CCSpec {
  cc: number;
  encoding: CCEncoding;
  description: string;
}

export const CC_MAP = {
  ampLevel: { cc: 7, encoding: 'unsigned', description: 'Amp Level' },
  ampPan: { cc: 10, encoding: 'pan', description: 'Amp Pan' },
  filterReso: { cc: 71, encoding: 'unsigned', description: 'Filter Resonance' },
  egDecay: { cc: 72, encoding: 'unsigned', description: 'EG Decay/Release' },
  egAttack: { cc: 73, encoding: 'unsigned', description: 'EG Attack' },
  filterCutoff: { cc: 74, encoding: 'unsigned', description: 'Filter Cutoff' },
  oscPitch: { cc: 80, encoding: 'signed', description: 'Oscillator Pitch' },
  oscGlide: { cc: 81, encoding: 'unsigned', description: 'Oscillator Glide' },
  oscEdit: { cc: 82, encoding: 'unsigned', description: 'Oscillator Edit' },
  filterEgInt: { cc: 83, encoding: 'signed', description: 'Filter EG Intensity' },
  modDepth: { cc: 85, encoding: 'unsigned', description: 'Modulation Depth' },
  modSpeed: { cc: 86, encoding: 'unsigned', description: 'Modulation Speed' },
  ifxEdit: { cc: 87, encoding: 'unsigned', description: 'Insert FX Edit' },
  masterFxX: { cc: 102, encoding: 'unsigned', description: 'Master FX XY Pad X' },
  masterFxY: { cc: 103, encoding: 'unsigned', description: 'Master FX XY Pad Y' },
  ifxOnOff: { cc: 104, encoding: 'toggle', description: 'Insert FX On/Off' },
  mfxSendOnOff: { cc: 105, encoding: 'toggle', description: 'MFX Send On/Off' },
  mfxOnOff: { cc: 106, encoding: 'toggle', description: 'Master FX On/Off' },
} as const satisfies Record<string, CCSpec>;

export type CCParam = keyof typeof CC_MAP;

const BY_CC: ReadonlyMap<number, CCParam> = new Map(
  (Object.keys(CC_MAP) as CCParam[]).map((p) => [CC_MAP[p].cc, p]),
);

export function paramForCC(cc: number): CCParam | null {
  return BY_CC.get(cc) ?? null;
}

/** App value -> MIDI byte (0-127). */
export function encodeCC(spec: CCSpec, value: number): number {
  switch (spec.encoding) {
    case 'unsigned':
      return encodeUnsigned(value);
    case 'signed':
      return encodeSigned(value);
    case 'pan':
      return encodePan(value);
    case 'toggle':
      return encodeToggle(Boolean(value));
  }
}

/** MIDI byte (0-127) -> app value. */
export function decodeCC(spec: CCSpec, midi: number): number {
  switch (spec.encoding) {
    case 'unsigned':
      return midi;
    case 'signed':
      return decodeSigned(midi);
    case 'pan':
      return decodePan(midi);
    case 'toggle':
      return decodeToggle(midi) ? 1 : 0;
  }
}
