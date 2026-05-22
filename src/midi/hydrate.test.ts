import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeCurrentPatternDump, parsePatternDump } from './sysex/parser.ts';
import { partToParamValues, patternToParams } from './hydrate.ts';

const pattern = parsePatternDump(
  decodeCurrentPatternDump(
    new Uint8Array(
      readFileSync(
        resolve(process.cwd(), 'tests/fixtures/pattern-dump-init.bin'),
      ),
    ),
  ),
);

describe('hydrate', () => {
  it('maps a part to CC param values (no pattern-level params)', () => {
    const values = partToParamValues(pattern.parts[0]!);
    expect(values.filterCutoff).toBe(pattern.parts[0]!.filterCutoff);
    expect(values.ampPan).toBe(pattern.parts[0]!.ampPan);
    expect(values.ifxOnOff).toBe(pattern.parts[0]!.ifxOn ? 1 : 0);
    expect('masterFxX' in values).toBe(false);
    expect('mfxOnOff' in values).toBe(false);
  });

  it('maps all 16 parts keyed by 1-based id', () => {
    const byPart = patternToParams(pattern);
    expect(Object.keys(byPart)).toHaveLength(16);
    expect(byPart[1]).toBeDefined();
    expect(byPart[16]).toBeDefined();
    expect(byPart[0]).toBeUndefined();
  });
});
