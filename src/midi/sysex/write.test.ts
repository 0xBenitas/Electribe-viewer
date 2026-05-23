import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decode7to8, encode8to7 } from './conversion.ts';
import {
  decodeCurrentPatternDump,
  parsePatternDump,
  RAW_DUMP_SIZE,
} from './parser.ts';
import {
  buildCurrentPatternDump,
  buildPatternWriteRequest,
  encodeSlot,
  patchPartSound,
} from './write.ts';
import { partToSound } from '../presets.ts';
import { SYSEX_FN } from './functions.ts';

const fixture = new Uint8Array(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/pattern-dump-init.bin')),
);
const raw = decodeCurrentPatternDump(fixture);

describe('encode/decode byte-exact sur le dump réel', () => {
  it('round-trips les 16384 octets', () => {
    expect(raw.length).toBe(RAW_DUMP_SIZE);
    expect([...decode7to8(encode8to7(raw))]).toEqual([...raw]);
  });
});

describe('patchPartSound', () => {
  it('applique le son d’un part sur un autre, sans toucher les voisins', () => {
    const orig = parsePatternDump(raw);
    const donor = partToSound(orig.parts[1]!); // son du part 2
    const patched = patchPartSound(raw, 0, donor); // sur le part 1

    expect(patched).not.toBe(raw); // copie
    const after = parsePatternDump(patched);

    // Part 1 a hérité des params SysEx-only « son » du part 2
    expect(after.parts[0]!.oscType).toBe(orig.parts[1]!.oscType);
    expect(after.parts[0]!.filterType).toBe(orig.parts[1]!.filterType);
    expect(after.parts[0]!.ifxType).toBe(orig.parts[1]!.ifxType);
    expect(after.parts[0]!.voiceAssign).toBe(orig.parts[1]!.voiceAssign);
    expect(after.parts[0]!.modType).toBe(orig.parts[1]!.modType);

    // Les autres parts sont intacts
    expect(after.parts[2]).toEqual(orig.parts[2]);
    expect(after.parts[15]).toEqual(orig.parts[15]);
  });

  it('rejette un index de part invalide', () => {
    expect(() => patchPartSound(raw, 16, partToSound(parsePatternDump(raw).parts[0]!))).toThrow();
  });
});

describe('buildCurrentPatternDump', () => {
  it('produit un 0x40 qui se redécode byte-exact', () => {
    const sysex = buildCurrentPatternDump(0, raw);
    expect(sysex[6]).toBe(SYSEX_FN.CURRENT_PATTERN_DUMP);
    expect([...decodeCurrentPatternDump(sysex)]).toEqual([...raw]);
  });
});

describe('Pattern Write (0x11)', () => {
  it('encode le slot 250 en PH/PL = 01 79 (cf. MIDI_FINDINGS §6)', () => {
    expect(encodeSlot(250)).toEqual([1, 121]);
  });

  it('construit un Write Request avec slot + payload redécodable', () => {
    const sysex = buildPatternWriteRequest(0, 250, raw);
    expect(sysex[6]).toBe(SYSEX_FN.PATTERN_WRITE_REQUEST);
    expect([sysex[7], sysex[8]]).toEqual([1, 121]);
    const payload = sysex.subarray(9, sysex.length - 1);
    expect([...decode7to8(payload)]).toEqual([...raw]);
  });
});
