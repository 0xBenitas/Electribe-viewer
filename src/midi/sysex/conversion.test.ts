import { describe, it, expect } from 'vitest';
import { decode7to8, encode8to7 } from './conversion.ts';

describe('7-to-8 bit conversion', () => {
  it('round-trips arbitrary bytes (multiple of 7)', () => {
    const raw = new Uint8Array(Array.from({ length: 70 }, (_, i) => (i * 37) & 0xff));
    expect([...decode7to8(encode8to7(raw))]).toEqual([...raw]);
  });

  it('round-trips a non-aligned length', () => {
    const raw = new Uint8Array([0xff, 0x00, 0x80, 0x7f, 0x01]);
    expect([...decode7to8(encode8to7(raw))]).toEqual([...raw]);
  });

  it('encodes 7 raw bytes into 8 MIDI bytes with MSBs first', () => {
    const raw = new Uint8Array([0x80, 0x00, 0x80, 0x00, 0x80, 0x00, 0x80]);
    const midi = encode8to7(raw);
    expect(midi.length).toBe(8);
    // bits 0,2,4,6 set -> 0b1010101 = 0x55
    expect(midi[0]).toBe(0x55);
    expect([...midi.slice(1)]).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('expands 16384 raw bytes to 18725 MIDI bytes (spec sizes)', () => {
    const raw = new Uint8Array(16384);
    expect(encode8to7(raw).length).toBe(18725);
  });
});
