import { describe, it, expect } from 'vitest';
import { partToSound, ccRecallPlan, autoCategory } from './presets.ts';
import type { ParsedPart } from './sysex/parser.ts';

const part: ParsedPart = {
  lastStep: 16,
  mute: false,
  voiceAssign: 2,
  motionSeqMode: 0,
  trgPadVelocity: false,
  scaleMode: false,
  partPriority: 0,
  oscType: 0,
  oscEdit: 64,
  filterType: 2,
  filterCutoff: 90,
  filterReso: 20,
  filterEgInt: 5,
  modType: 0,
  modSpeed: 10,
  modDepth: 30,
  egAttack: 0,
  egDecay: 60,
  ampLevel: 110,
  ampPan: -10,
  egOn: true,
  mfxSend: true,
  grooveType: 0,
  grooveDepth: 0,
  ifxOn: true,
  ifxType: 3,
  ifxEdit: 40,
  oscPitch: -5,
  oscGlide: 0,
  steps: [],
};

describe('partToSound', () => {
  it('drops the sequence but keeps the sound params', () => {
    const sound = partToSound(part);
    expect('steps' in sound).toBe(false);
    expect(sound.oscType).toBe(0);
    expect(sound.filterCutoff).toBe(90);
  });
});

describe('ccRecallPlan', () => {
  it('plans the 15 per-part CC params with decoded values', () => {
    const plan = ccRecallPlan(partToSound(part));
    expect(plan).toHaveLength(15);
    const v = Object.fromEntries(plan.map((s) => [s.param, s.value]));
    expect(v.filterCutoff).toBe(90);
    expect(v.ampPan).toBe(-10);
    expect(v.ifxOnOff).toBe(1); // ifxOn true -> 1
    expect(v.mfxSendOnOff).toBe(1); // mfxSend true -> 1
    // pattern-level CCs must never be in a per-part recall plan
    expect(v.masterFxX).toBeUndefined();
    expect(v.mfxOnOff).toBeUndefined();
  });
});

describe('autoCategory', () => {
  it('derives the preset category from the oscillator', () => {
    expect(autoCategory(0)).toBe('Kick'); // raw 0 -> osc #1 SubBeef (Kick)
    expect(autoCategory(63)).toBe('Snare'); // raw 63 -> osc #64 Beach (Snare)
    expect(autoCategory(408)).toBe('Other'); // raw 408 -> osc #409 Audio In
  });
});
