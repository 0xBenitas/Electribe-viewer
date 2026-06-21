import { describe, it, expect, beforeEach } from 'vitest';
import { useCueStore } from './cues.ts';
import { buildCue, type ReceivedCue } from '../model/cues.ts';

const received = (id: string, landAtBar: number, peer = 'p1'): ReceivedCue => ({
  cue: buildCue('break', landAtBar, { id, now: 0 }),
  peer,
});

describe('cue store', () => {
  beforeEach(() => useCueStore.getState().clear());

  it('adds cues and ignores duplicate ids', () => {
    const s = useCueStore.getState();
    s.add(received('a', 4));
    s.add(received('a', 9)); // same id → ignored
    s.add(received('b', 5));
    expect(useCueStore.getState().cues.map((c) => c.cue.id)).toEqual(['a', 'b']);
  });

  it('prunes only cues whose bar has passed', () => {
    const s = useCueStore.getState();
    s.add(received('past', 2));
    s.add(received('now', 4));
    s.add(received('soon', 6));
    s.prune(4); // bar 4: 'past' (lands 2) is expired, others live
    expect(useCueStore.getState().cues.map((c) => c.cue.id)).toEqual([
      'now',
      'soon',
    ]);
  });

  it('clears everything', () => {
    useCueStore.getState().add(received('a', 4));
    useCueStore.getState().clear();
    expect(useCueStore.getState().cues).toEqual([]);
  });
});
