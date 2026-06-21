import { describe, it, expect } from 'vitest';
import {
  PROFILES,
  getProfile,
  isKnownPortName,
  matchProfileByPortName,
  resolveProfile,
  supportsRichEditor,
} from './registry.ts';

describe('device profile registry', () => {
  it('ships the two starter profiles from the spec', () => {
    expect(getProfile('korg-electribe-2')).not.toBeNull();
    expect(getProfile('elektron-model-samples')).not.toBeNull();
  });

  it('every profile is schema v1 with a unique id', () => {
    const ids = PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PROFILES) expect(p.schemaVersion).toBe(1);
  });

  it('matches the Electribe by Web MIDI port name (case-insensitive)', () => {
    expect(matchProfileByPortName('Electribe 2')?.id).toBe('korg-electribe-2');
    expect(matchProfileByPortName('KORG ELECTRIBE')?.id).toBe(
      'korg-electribe-2',
    );
  });

  it('returns null for an unknown machine (→ guided setup)', () => {
    expect(matchProfileByPortName('Mystery Synth 9000')).toBeNull();
    expect(resolveProfile('Mystery Synth 9000')).toBeNull();
    expect(isKnownPortName('Mystery Synth 9000')).toBe(false);
    expect(isKnownPortName('Electribe 2')).toBe(true);
  });

  it('detects the Elektron line and acid boxes by port name', () => {
    expect(matchProfileByPortName('Elektron Digitakt')?.id).toBe(
      'elektron-digitakt',
    );
    expect(matchProfileByPortName('Elektron Model:Cycles')?.id).toBe(
      'elektron-model-cycles',
    );
    expect(matchProfileByPortName('Behringer TD-3')?.id).toBe('behringer-td-3');
    expect(matchProfileByPortName('Roland TB-3 MIDI 1')?.id).toBe('roland-tb-3');
  });

  it('only the Electribe exposes the rich editor', () => {
    expect(supportsRichEditor('korg-electribe-2')).toBe(true);
    expect(supportsRichEditor('elektron-model-samples')).toBe(false);
    expect(supportsRichEditor('behringer-td-3')).toBe(false);
    expect(supportsRichEditor(null)).toBe(false);
  });

  it('falls back to the Electribe profile from a parsed SysEx identity', () => {
    const id = {
      globalChannel: 0,
      manufacturer: 'korg',
      product: 'electribe',
      versionMajor: 2,
      versionMinor: 2,
      versionRelease: 0,
    } as const;
    expect(resolveProfile('USB MIDI Device', id)?.id).toBe('korg-electribe-2');
  });
});
