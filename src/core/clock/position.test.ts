import { describe, it, expect } from 'vitest';
import { barBeatFromTicks } from './position.ts';
import { PPQN } from './types.ts';

describe('barBeatFromTicks (4/4)', () => {
  it('is the downbeat at tick 0', () => {
    expect(barBeatFromTicks(0, 4)).toEqual({
      bar: 1,
      beat: 1,
      tickInBeat: 0,
      phase: 0,
    });
  });

  it('advances one beat every PPQN ticks', () => {
    expect(barBeatFromTicks(PPQN, 4)).toMatchObject({ bar: 1, beat: 2 });
    expect(barBeatFromTicks(PPQN * 3, 4)).toMatchObject({ bar: 1, beat: 4 });
  });

  it('rolls into the next bar after beatsPerBar beats', () => {
    expect(barBeatFromTicks(PPQN * 4, 4)).toMatchObject({ bar: 2, beat: 1 });
  });

  it('reports phase within a beat', () => {
    expect(barBeatFromTicks(PPQN / 2, 4).phase).toBeCloseTo(0.5, 5);
  });

  it('respects a 3/4 time signature', () => {
    expect(barBeatFromTicks(PPQN * 3, 3)).toMatchObject({ bar: 2, beat: 1 });
  });
});
