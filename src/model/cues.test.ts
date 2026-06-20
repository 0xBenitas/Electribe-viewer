import { describe, it, expect } from 'vitest';
import { buildCue, cueStatus, CUE_ORDER, CUE_LABELS } from './cues.ts';

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
