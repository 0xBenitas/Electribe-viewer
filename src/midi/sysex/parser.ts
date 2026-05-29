// Parse a Current Pattern Dump into structured data (spec §6.8, MIDI doc
// TABLE 1 + TABLE 6). Offsets are absolute in the 16384-byte decoded dump.

import { decode7to8 } from './conversion.ts';
import { buildSysEx, getSysExFunction, SYSEX_END } from './envelope.ts';
import { SYSEX_FN } from './functions.ts';

export function buildCurrentPatternDumpRequest(
  globalChannel: number,
): Uint8Array {
  return buildSysEx(globalChannel, SYSEX_FN.CURRENT_PATTERN_DUMP_REQUEST);
}

export const RAW_DUMP_SIZE = 16384;
export const PART_COUNT = 16;
export const PART_BASE = 2048;
export const PART_STRIDE = 816;
export const STEP_COUNT = 64;
export const STEP_BASE = 48;
export const STEP_STRIDE = 12;

export interface ParsedStep {
  on: boolean;
  gateTime: number; // 0-96, or 127 = TIE
  velocity: number; // 1-127
  triggerOn: boolean;
  notes: [number, number, number, number]; // -1 = off, else MIDI note 0-127
}

export interface ParsedPart {
  lastStep: number; // 1-16
  mute: boolean;
  voiceAssign: number; // 0-3
  motionSeqMode: number; // 0-2
  trgPadVelocity: boolean;
  scaleMode: boolean;
  partPriority: number; // 0-1
  oscType: number; // 0-500
  oscEdit: number;
  filterType: number; // 0-16
  filterCutoff: number;
  filterReso: number;
  filterEgInt: number; // -63..63
  modType: number; // 0-71
  modSpeed: number;
  modDepth: number;
  egAttack: number;
  egDecay: number;
  ampLevel: number;
  ampPan: number; // -63..64 (L..R)
  egOn: boolean;
  mfxSend: boolean;
  grooveType: number; // 0-24
  grooveDepth: number;
  ifxOn: boolean;
  ifxType: number; // 0-37
  ifxEdit: number;
  oscPitch: number; // -63..63
  oscGlide: number;
  steps: ParsedStep[];
}

export interface ParsedPattern {
  name: string;
  tempo: number; // BPM, e.g. 160.0
  swing: number; // -48..48
  length: number; // 1-4 bars
  beat: number; // 0-3
  key: number; // 0-11
  scale: number; // 0-35
  chordSet: number; // 0-4
  playLevel: number; // 0-127
  gateArpPattern: number;
  gateArpSpeed: number;
  gateArpTime: number; // -100..100
  mfxType: number; // 0-31
  mfxXyX: number;
  mfxXyY: number;
  mfxHold: boolean;
  alternate1314: boolean;
  alternate1516: boolean;
  parts: ParsedPart[];
}

const toSigned8 = (b: number): number => (b > 127 ? b - 256 : b);
const toSigned16LE = (lo: number, hi: number): number => {
  const v = lo | (hi << 8);
  return v > 32767 ? v - 65536 : v;
};

function readName(raw: Uint8Array, start: number, max: number): string {
  let s = '';
  for (let i = 0; i < max; i++) {
    const c = raw[start + i]!;
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Strip the SysEx envelope of a Current Pattern Dump and decode to raw bytes. */
export function decodeCurrentPatternDump(sysex: Uint8Array): Uint8Array {
  if (getSysExFunction(sysex) !== SYSEX_FN.CURRENT_PATTERN_DUMP) {
    throw new Error('Not a Current Pattern Dump (function != 0x40)');
  }
  if (sysex[sysex.length - 1] !== SYSEX_END) {
    throw new Error('Malformed SysEx: missing 0xF7 terminator');
  }
  const payload = sysex.subarray(7, sysex.length - 1);
  const raw = decode7to8(payload);
  if (raw.length < RAW_DUMP_SIZE) {
    throw new Error(`Decoded dump too short: ${raw.length} < ${RAW_DUMP_SIZE}`);
  }
  return raw;
}

function parseStep(raw: Uint8Array, base: number): ParsedStep {
  const note = (slot: number): number => {
    const v = raw[base + 4 + slot]!;
    return v === 0 ? -1 : v - 1;
  };
  return {
    on: raw[base]! !== 0,
    gateTime: raw[base + 1]!,
    velocity: raw[base + 2]!,
    triggerOn: raw[base + 3]! !== 0,
    notes: [note(0), note(1), note(2), note(3)],
  };
}

function parsePart(raw: Uint8Array, base: number): ParsedPart {
  const lastStepByte = raw[base]!;
  const steps: ParsedStep[] = [];
  for (let s = 0; s < STEP_COUNT; s++) {
    steps.push(parseStep(raw, base + STEP_BASE + s * STEP_STRIDE));
  }
  return {
    lastStep: lastStepByte === 0 ? 16 : lastStepByte,
    mute: raw[base + 1]! !== 0,
    voiceAssign: raw[base + 2]!,
    motionSeqMode: raw[base + 3]!,
    trgPadVelocity: raw[base + 4]! !== 0,
    scaleMode: raw[base + 5]! !== 0,
    partPriority: raw[base + 6]!,
    oscType: raw[base + 8]! | (raw[base + 9]! << 8),
    oscEdit: raw[base + 11]!,
    filterType: raw[base + 12]!,
    filterCutoff: raw[base + 13]!,
    filterReso: raw[base + 14]!,
    filterEgInt: toSigned8(raw[base + 15]!),
    modType: raw[base + 16]!,
    modSpeed: raw[base + 17]!,
    modDepth: raw[base + 18]!,
    egAttack: raw[base + 20]!,
    egDecay: raw[base + 21]!,
    ampLevel: raw[base + 24]!,
    ampPan: toSigned8(raw[base + 25]!),
    egOn: raw[base + 26]! !== 0,
    mfxSend: raw[base + 27]! !== 0,
    grooveType: raw[base + 28]!,
    grooveDepth: raw[base + 29]!,
    ifxOn: raw[base + 32]! !== 0,
    ifxType: raw[base + 33]!,
    ifxEdit: raw[base + 34]!,
    oscPitch: toSigned8(raw[base + 36]!),
    oscGlide: raw[base + 37]!,
    steps,
  };
}

export function parsePatternDump(raw: Uint8Array): ParsedPattern {
  const TOUCH = 44; // TouchScale base
  const MFX = 60; // Master FX base
  const parts: ParsedPart[] = [];
  for (let p = 0; p < PART_COUNT; p++) {
    parts.push(parsePart(raw, PART_BASE + p * PART_STRIDE));
  }
  return {
    name: readName(raw, 16, 18),
    tempo: (raw[34]! | (raw[35]! << 8)) / 10,
    swing: toSigned8(raw[36]!),
    length: raw[37]! + 1,
    beat: raw[38]!,
    key: raw[39]!,
    scale: raw[40]!,
    chordSet: raw[41]!,
    playLevel: 127 - raw[42]!,
    gateArpPattern: raw[TOUCH + 5]!,
    gateArpSpeed: raw[TOUCH + 6]!,
    gateArpTime: toSigned16LE(raw[TOUCH + 8]!, raw[TOUCH + 9]!),
    mfxType: raw[MFX + 1]!,
    mfxXyX: raw[MFX + 2]!,
    mfxXyY: raw[MFX + 3]!,
    mfxHold: raw[MFX + 5]! >= 1,
    alternate1314: raw[68]! !== 0,
    alternate1516: raw[69]! !== 0,
    parts,
  };
}
