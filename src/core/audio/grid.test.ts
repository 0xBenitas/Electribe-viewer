import { describe, it, expect } from 'vitest';
import {
  clampGrid,
  intervalMs,
  intervalSamples,
  intervalStartMs,
  playbackSample,
  positionAt,
  sampleAt,
  type AudioGrid,
} from './grid.ts';

const grid: AudioGrid = { id: 1, bpm: 120, bpi: 16, anchor: 1_000_000 };

describe('grid', () => {
  it('calcule la durée d’intervalle', () => {
    expect(intervalMs(grid)).toBe(8000); // 16 temps à 120 = 8 s
    expect(intervalSamples(grid)).toBe(384000);
    expect(intervalMs({ bpm: 128, bpi: 4 })).toBeCloseTo(1875, 6);
  });

  it('place un instant sur la grille', () => {
    expect(positionAt(grid, 1_000_000)).toEqual({ interval: 0, offsetSamples: 0 });
    expect(positionAt(grid, 1_008_000)).toEqual({ interval: 1, offsetSamples: 0 });
    expect(positionAt(grid, 1_000_500)).toEqual({ interval: 0, offsetSamples: 24000 });
    expect(positionAt(grid, 999_000)).toEqual({ interval: -1, offsetSamples: 336000 });
  });

  it('joue une tranche un intervalle plus tard, au même offset', () => {
    const pos = positionAt(grid, 1_000_500);
    expect(playbackSample(grid, pos)).toBe(384000 + 24000);
    expect(sampleAt(grid, intervalStartMs(grid, 1))).toBe(384000);
  });

  it('borne bpm / bpi', () => {
    expect(clampGrid(10, 1)).toEqual({ bpm: 40, bpi: 2 });
    expect(clampGrid(128.04, 16.4)).toEqual({ bpm: 128, bpi: 16 });
    expect(clampGrid(Number.NaN, Number.NaN)).toEqual({ bpm: 120, bpi: 16 });
    // 40 BPM × 64 temps = 96 s → réduit jusqu'à tenir dans 16 s
    expect(clampGrid(40, 64)).toEqual({ bpm: 40, bpi: 8 });
  });
});
