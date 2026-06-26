import { describe, it, expect } from 'vitest';
import {
  buildCue,
  cueStatus,
  cueLandBar,
  CUE_ORDER,
  CUE_LABELS,
} from './cues.ts';

describe('cue model', () => {
  it('builds a cue with an injectable id/clock', () => {
    const cue = buildCue('break', 5, { id: 'c1', now: 1000 });
    expect(cue).toEqual({
      id: 'c1',
      kind: 'break',
      label: undefined,
      landAtBar: 5,
      createdAt: 1000,
    });
  });

  it('classifies status relative to the shared bar', () => {
    const cue = buildCue('up', 4, { id: 'c', now: 0 });
    expect(cueStatus(cue, 3)).toBe('pending'); // fired in bar 3, lands at 4
    expect(cueStatus(cue, 4)).toBe('active'); // the downbeat it lands on
    expect(cueStatus(cue, 5)).toBe('expired'); // bar passed
  });

  it('labels every kind it offers', () => {
    for (const kind of CUE_ORDER) {
      expect(CUE_LABELS[kind]).toBeTruthy();
    }
  });
});

describe('cueLandBar (adaptive margin)', () => {
  // bpm 120, 4/4 → msPerBeat 500, msPerBar 2000.
  it('host/solo always lands at the next bar, whatever the beat/latency', () => {
    expect(cueLandBar({ bar: 5, beat: 4, bpm: 120, source: 'local', now: 0 })).toBe(6);
    expect(
      cueLandBar({ bar: 5, beat: 4, bpm: 120, source: 'local', now: 9999, transportAt: 0, latencyMs: 5000 }),
    ).toBe(6);
  });

  it('falls back to +1 when bpm is unknown', () => {
    expect(cueLandBar({ bar: 5, beat: 1, bpm: null, source: 'remote', now: 0, latencyMs: 9999 })).toBe(6);
  });

  it('remote with no lag lands at +1 even late in the bar', () => {
    // beat 4/4 = 0.75 into the bar, zero advance → host still in bar 5 → +1.
    expect(cueLandBar({ bar: 5, beat: 4, bpm: 120, source: 'remote', now: 1000, transportAt: 1000, latencyMs: 0 })).toBe(6);
  });

  it('remote late in the bar + real latency lands at +2', () => {
    // beat 4 (0.75) + advance (stale 0 + 2×rtt 600 = 1200ms → 0.60 bar) = 1.35 ≥ 1
    // → host rolls into the next bar before the cue arrives → land +2.
    expect(cueLandBar({ bar: 5, beat: 4, bpm: 120, source: 'remote', now: 1000, transportAt: 1000, latencyMs: 600 })).toBe(7);
  });

  it('counts staleness of the last tick on top of latency', () => {
    // beat 1 (0.0) + advance (stale 400 + 2×rtt 200 = 800ms → 0.40 bar) = 0.40 < 1 → +1.
    expect(cueLandBar({ bar: 8, beat: 1, bpm: 120, source: 'remote', now: 1400, transportAt: 1000, latencyMs: 200 })).toBe(9);
    // beat 4 (0.75) + advance (stale 700 + 2×rtt 200 = 1100ms → 0.55) = 1.30 → +2.
    expect(cueLandBar({ bar: 8, beat: 4, bpm: 120, source: 'remote', now: 1700, transportAt: 1000, latencyMs: 200 })).toBe(10);
  });

  it('absorbs more than one bar of lag (degrades gracefully, not just +2)', () => {
    // 2×rtt 5000ms (2.5 bars @2000ms/bar) → host crosses two bars → land +3.
    expect(cueLandBar({ bar: 5, beat: 1, bpm: 120, source: 'remote', now: 1000, transportAt: 1000, latencyMs: 2500 })).toBe(8);
    // 2×rtt 9000ms (4.5 bars) → land +5.
    expect(cueLandBar({ bar: 5, beat: 1, bpm: 120, source: 'remote', now: 1000, transportAt: 1000, latencyMs: 4500 })).toBe(10);
  });
});
