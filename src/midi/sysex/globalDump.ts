// Global Dump parser (spec §6.9, MIDI doc TABLE 7). 293 MIDI bytes -> 256 raw.
// The app reads Knob Mode at connect to warn when it is "Catch".

import { decode7to8 } from './conversion.ts';
import { buildSysEx, getSysExFunction, SYSEX_END } from './envelope.ts';
import { SYSEX_FN } from './functions.ts';

export type KnobMode = 0 | 1 | 2; // Jump, Catch, Value Scale

export interface ParsedGlobals {
  metronome: number; // 0-4
  syncPolarity: number; // 0-1
  syncResolution: number; // 0-1
  audioInThru: boolean;
  velocityCurve: number; // 0-3
  knobMode: KnobMode;
  triggerMode: number; // 0-2
  lcdContrast: number; // 0-24
  batteryMode: number; // 0-1
  autoPowerOff: boolean;
  tempoLock: boolean;
  powerSave: number; // 0-2
  touchScaleRange: number; // 0-3
  clockMode: number; // 0-4
  globalChannel: number; // 0-15
  receiveFilter: number; // 0-2
  sendFilter: number; // 0-2
}

export function buildGlobalDumpRequest(globalChannel: number): Uint8Array {
  return buildSysEx(globalChannel, SYSEX_FN.GLOBAL_DUMP_REQUEST);
}

export function decodeGlobalDump(sysex: Uint8Array): Uint8Array {
  if (getSysExFunction(sysex) !== SYSEX_FN.GLOBAL_DUMP) {
    throw new Error('Not a Global Dump (function != 0x51)');
  }
  if (sysex[sysex.length - 1] !== SYSEX_END) {
    throw new Error('Malformed SysEx: missing 0xF7 terminator');
  }
  return decode7to8(sysex.subarray(7, sysex.length - 1));
}

export function parseGlobalDump(raw: Uint8Array): ParsedGlobals {
  return {
    metronome: raw[16]!,
    syncPolarity: raw[17]!,
    syncResolution: raw[18]!,
    audioInThru: raw[20]! !== 0,
    velocityCurve: raw[27]!,
    knobMode: (raw[28]! % 3) as KnobMode,
    triggerMode: raw[29]!,
    lcdContrast: raw[30]!,
    batteryMode: raw[32]!,
    autoPowerOff: raw[33]! !== 0,
    tempoLock: raw[36]! !== 0,
    powerSave: raw[37]!,
    touchScaleRange: raw[38]!,
    clockMode: raw[40]!,
    globalChannel: raw[41]!,
    receiveFilter: raw[42]!,
    sendFilter: raw[43]!,
  };
}
