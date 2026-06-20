import { describe, it, expect } from 'vitest';
import { resolveSharedTransport, TRANSPORT_STALE_MS } from './useClock.ts';
import type { ClockView } from '../store/clock.ts';

const local: ClockView = {
  running: true,
  bpm: 120,
  bar: 4,
  beat: 2,
  hasClock: true,
  at: 0,
};

describe('resolveSharedTransport', () => {
  it('uses the local clock when we own it (host/solo)', () => {
    const t = resolveSharedTransport({
      local,
      transport: null,
      transportAt: null,
      ownsClock: true,
      now: 10_000,
    });
    expect(t).toEqual({ bpm: 120, bar: 4, beat: 2, running: true, source: 'local' });
  });

  it('returns null for a peer with no transport yet', () => {
    expect(
      resolveSharedTransport({
        local,
        transport: null,
        transportAt: null,
        ownsClock: false,
        now: 0,
      }),
    ).toBeNull();
  });

  it('uses a fresh relayed transport for a non-host peer', () => {
    const t = resolveSharedTransport({
      local,
      transport: { bpm: 128, bar: 7, beat: 1 },
      transportAt: 1000,
      ownsClock: false,
      now: 1000 + TRANSPORT_STALE_MS - 1,
    });
    expect(t).toEqual({ bpm: 128, bar: 7, beat: 1, running: true, source: 'remote' });
  });

  it('expires a relayed transport once the host goes quiet', () => {
    const t = resolveSharedTransport({
      local,
      transport: { bpm: 128, bar: 7, beat: 1 },
      transportAt: 1000,
      ownsClock: false,
      now: 1000 + TRANSPORT_STALE_MS + 1,
    });
    expect(t).toBeNull();
  });
});
