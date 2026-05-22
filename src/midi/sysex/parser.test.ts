import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decodeCurrentPatternDump,
  parsePatternDump,
  PART_COUNT,
  STEP_COUNT,
  RAW_DUMP_SIZE,
} from './parser.ts';

const fixture = new Uint8Array(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/pattern-dump-init.bin')),
);

describe('Current Pattern Dump parser (real fixture)', () => {
  it('decodes the SysEx envelope to 16384 raw bytes', () => {
    const raw = decodeCurrentPatternDump(fixture);
    expect(raw.length).toBe(RAW_DUMP_SIZE);
    // 'PTST' header
    expect([...raw.slice(0, 4)]).toEqual([0x50, 0x54, 0x53, 0x54]);
  });

  it('parses the pattern header (captured "Init Pattern", 160 BPM)', () => {
    const pattern = parsePatternDump(decodeCurrentPatternDump(fixture));
    expect(pattern.name).toBe('Init Pattern');
    expect(pattern.tempo).toBe(160);
    expect(pattern.swing).toBe(0);
    expect(pattern.length).toBe(4); // raw 3 -> 4 bars
    expect(pattern.beat).toBe(0);
    expect(pattern.key).toBe(6);
    expect(pattern.scale).toBe(2);
    expect(pattern.chordSet).toBe(2);
  });

  it('parses 16 parts, each with 64 steps', () => {
    const pattern = parsePatternDump(decodeCurrentPatternDump(fixture));
    expect(pattern.parts).toHaveLength(PART_COUNT);
    for (const part of pattern.parts) {
      expect(part.steps).toHaveLength(STEP_COUNT);
      expect(part.lastStep).toBeGreaterThanOrEqual(1);
      expect(part.lastStep).toBeLessThanOrEqual(16);
      expect(part.oscType).toBeGreaterThanOrEqual(0);
      expect(part.ampPan).toBeGreaterThanOrEqual(-63);
    }
  });

  it('rejects a non-dump SysEx', () => {
    const inquiry = new Uint8Array([0xf0, 0x7e, 0x00, 0x06, 0x02, 0xf7]);
    expect(() => decodeCurrentPatternDump(inquiry)).toThrow();
  });
});
