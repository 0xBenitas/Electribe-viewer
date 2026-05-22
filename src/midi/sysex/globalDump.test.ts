import { describe, it, expect } from 'vitest';
import { encode8to7 } from './conversion.ts';
import { buildSysExHeader } from './envelope.ts';
import { SYSEX_FN } from './functions.ts';
import {
  buildGlobalDumpRequest,
  decodeGlobalDump,
  parseGlobalDump,
} from './globalDump.ts';

function makeGlobalDumpSysEx(raw: Uint8Array): Uint8Array {
  return new Uint8Array([
    ...buildSysExHeader(0),
    SYSEX_FN.GLOBAL_DUMP,
    ...encode8to7(raw),
    0xf7,
  ]);
}

describe('Global Dump', () => {
  it('builds a request with the electribe envelope', () => {
    const req = buildGlobalDumpRequest(0);
    expect([...req]).toEqual([0xf0, 0x42, 0x30, 0x00, 0x01, 0x23, 0x1e, 0xf7]);
  });

  it('decodes and parses Knob Mode + global channel', () => {
    const raw = new Uint8Array(256);
    raw[28] = 1; // Knob Mode = Catch
    raw[41] = 5; // global channel index 5 = channel 6
    const sysex = makeGlobalDumpSysEx(raw);
    const parsed = parseGlobalDump(decodeGlobalDump(sysex));
    expect(parsed.knobMode).toBe(1);
    expect(parsed.globalChannel).toBe(5);
  });
});
