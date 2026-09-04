import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeCurrentPatternDump } from './sysex/parser.ts';
import { dumpFileName, sameBytes, syxBytes } from './dumpVault.ts';
import { SYSEX_FN } from './sysex/functions.ts';

const fixture = new Uint8Array(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/pattern-dump-init.bin')),
);

describe('dumpFileName', () => {
  it('nettoie le nom et horodate', () => {
    const at = new Date(2026, 8, 4, 10, 42, 7).getTime();
    expect(dumpFileName('Mon Best Pattern !', at)).toBe(
      'jamboree_mon-best-pattern_20260904-104207.syx',
    );
  });
  it('retombe sur « pattern » si le nom est vide', () => {
    expect(dumpFileName('   ', 0)).toMatch(/^jamboree_pattern_\d{8}-\d{6}\.syx$/);
  });
});

describe('syxBytes', () => {
  it('reconstruit un message 0x40 identique au dump reçu', () => {
    const raw = decodeCurrentPatternDump(fixture);
    const syx = syxBytes(0, raw);
    expect(syx.length).toBe(fixture.length); // 18733
    expect(syx[6]).toBe(SYSEX_FN.CURRENT_PATTERN_DUMP);
    expect(sameBytes(syx, fixture)).toBe(true);
  });
});

describe('sameBytes', () => {
  it('compare longueur et contenu', () => {
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(sameBytes(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});
