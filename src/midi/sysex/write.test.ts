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
    // Le fixture (Init) a des parts quasi identiques : on singularise le donneur
    // pour prouver que CHAQUE champ voyage (valeurs signées comprises).
    const donor = {
      ...partToSound(orig.parts[1]!),
      oscType: 301, oscEdit: 77, filterType: 5, filterCutoff: 99, filterReso: 42,
      filterEgInt: -33, modType: 12, modSpeed: 64, modDepth: 100, egAttack: 3,
      egDecay: 88, ampLevel: 120, ampPan: -20, egOn: true, mfxSend: true,
      grooveType: 7, grooveDepth: 50, ifxOn: true, ifxType: 9, ifxEdit: 66,
      oscPitch: -12, oscGlide: 30, voiceAssign: 2, partPriority: 1,
    };
    const patched = patchPartSound(raw, 0, donor); // sur le part 1

    expect(patched).not.toBe(raw); // copie
    const after = parsePatternDump(patched);

    // Part 1 a hérité du SON complet du part 2 (tout PartSound sauf les états de jeu)
    const PLAY_STATE = new Set(['lastStep', 'mute', 'motionSeqMode', 'trgPadVelocity', 'scaleMode']);
    const soundOf = (p: (typeof orig.parts)[number]) =>
      Object.fromEntries(Object.entries(partToSound(p)).filter(([k]) => !PLAY_STATE.has(k)));
    expect(soundOf(after.parts[0]!)).toEqual(soundOf({ ...orig.parts[1]!, ...donor }));
    // … mais garde sa séquence et ses états de jeu
    expect(after.parts[0]!.steps).toEqual(orig.parts[0]!.steps);
    expect(after.parts[0]!.mute).toBe(orig.parts[0]!.mute);
    expect(after.parts[0]!.lastStep).toBe(orig.parts[0]!.lastStep);

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
