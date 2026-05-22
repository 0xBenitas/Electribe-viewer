import { describe, it, expect } from 'vitest';
import { CC_MAP, paramForCC, encodeCC, decodeCC } from './ccMap.ts';

describe('CC map', () => {
  it('maps the 18 spec params and resolves by CC number', () => {
    expect(Object.keys(CC_MAP)).toHaveLength(18);
    expect(paramForCC(74)).toBe('filterCutoff');
    expect(paramForCC(10)).toBe('ampPan');
    expect(paramForCC(106)).toBe('mfxOnOff');
    expect(paramForCC(0)).toBeNull();
  });

  it('round-trips unsigned/pan/signed/toggle', () => {
    expect(encodeCC(CC_MAP.filterCutoff, 100)).toBe(100);
    expect(decodeCC(CC_MAP.filterCutoff, 100)).toBe(100);

    expect(encodeCC(CC_MAP.ampPan, 0)).toBe(64);
    expect(decodeCC(CC_MAP.ampPan, 64)).toBe(0);

    expect(decodeCC(CC_MAP.oscPitch, 64)).toBe(0);
    expect(encodeCC(CC_MAP.oscPitch, 63)).toBe(127);

    expect(encodeCC(CC_MAP.ifxOnOff, 1)).toBe(0x7f);
    expect(decodeCC(CC_MAP.ifxOnOff, 0x7f)).toBe(1);
    expect(decodeCC(CC_MAP.ifxOnOff, 0)).toBe(0);
  });
});
