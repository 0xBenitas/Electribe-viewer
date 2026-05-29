import { describe, it, expect } from 'vitest';
import {
  encodePan,
  decodePan,
  encodeSigned,
  decodeSigned,
  encodeToggle,
  decodeToggle,
  encodeUnsigned,
} from './encoding.ts';

describe('pan', () => {
  it('maps center/left/right to MIDI', () => {
    expect(encodePan(0)).toBe(64);
    expect(encodePan(-64)).toBe(0);
    expect(encodePan(63)).toBe(127);
  });

  it('decodes MIDI back to app range', () => {
    expect(decodePan(64)).toBe(0);
    expect(decodePan(0)).toBe(-64);
    expect(decodePan(127)).toBe(63);
  });

  it('clamps out-of-range input', () => {
    expect(encodePan(999)).toBe(127);
    expect(encodePan(-999)).toBe(0);
  });
});

describe('signed', () => {
  it('centers on 64', () => {
    expect(encodeSigned(0)).toBe(64);
    expect(decodeSigned(64)).toBe(0);
  });

  it('maps both 0x00 and 0x01 to -63 (Korg idiosyncrasy)', () => {
    expect(decodeSigned(0x00)).toBe(-63);
    expect(decodeSigned(0x01)).toBe(-63);
    expect(encodeSigned(-63)).toBe(0x01);
  });

  it('maps +63 to 0x7F', () => {
    expect(encodeSigned(63)).toBe(127);
    expect(decodeSigned(127)).toBe(63);
  });
});

describe('toggle', () => {
  it('encodes booleans', () => {
    expect(encodeToggle(true)).toBe(0x7f);
    expect(encodeToggle(false)).toBe(0x00);
  });

  it('decodes tolerantly around center', () => {
    expect(decodeToggle(0x00)).toBe(false);
    expect(decodeToggle(0x3f)).toBe(false);
    expect(decodeToggle(0x40)).toBe(true);
    expect(decodeToggle(0x7f)).toBe(true);
  });
});

describe('unsigned', () => {
  it('rounds and clamps', () => {
    expect(encodeUnsigned(63.4)).toBe(63);
    expect(encodeUnsigned(-5)).toBe(0);
    expect(encodeUnsigned(200)).toBe(127);
  });
});
