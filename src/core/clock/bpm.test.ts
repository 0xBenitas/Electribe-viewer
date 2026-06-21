import { describe, it, expect } from 'vitest';
import { median, bpmFromTickIntervals } from './bpm.ts';
import { PPQN } from './types.ts';

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('is unaffected by a single large outlier', () => {
    expect(median([20, 20, 20, 20, 9999])).toBe(20);
  });
});

describe('bpmFromTickIntervals', () => {
  const msPerTick = (bpm: number) => 60000 / bpm / PPQN;

  it('returns null below the sample threshold', () => {
    expect(bpmFromTickIntervals([20, 20, 20], 4)).toBeNull();
  });

  it('recovers 120 BPM from clean tick intervals', () => {
    const intervals = Array(24).fill(msPerTick(120));
    expect(bpmFromTickIntervals(intervals)).toBeCloseTo(120, 5);
  });

  it('recovers a fractional tempo (128.0 BPM)', () => {
    const intervals = Array(24).fill(msPerTick(128));
    expect(bpmFromTickIntervals(intervals)).toBeCloseTo(128, 5);
  });

  it('rejects jitter via the median', () => {
    const clean = msPerTick(120);
    const jittered = [...Array(23).fill(clean), clean * 50];
    expect(bpmFromTickIntervals(jittered)).toBeCloseTo(120, 5);
  });
});
