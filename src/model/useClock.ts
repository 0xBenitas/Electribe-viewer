// Shared-tempo hooks for the cockpit.
//
// `useClockDriver` runs ONE rAF loop that samples the local MIDI clock and
// writes coarse updates into the clock store (on change, plus a ~4/s heartbeat
// so remote-staleness re-evaluates). `useSharedTransport` returns the
// authoritative position to display: the host (and solo) reads its own clock;
// other peers read the host's relayed transport, which expires if it goes quiet.

import { useEffect } from 'react';
import { clockSnapshot } from '../midi/bridge.ts';
import { useClockStore, type ClockView } from '../store/clock.ts';
import { useSessionStore } from '../store/session.ts';
import type { TransportTick } from '../core/session/protocol.ts';

/** A peer's relayed transport is dropped after this long without an update. */
export const TRANSPORT_STALE_MS = 1000;
/** Force a store emit at least this often, so staleness checks keep re-rendering. */
const HEARTBEAT_MS = 250;

export interface SharedTransport {
  bpm: number | null;
  bar: number;
  beat: number;
  running: boolean;
  /** 'local' = own clock (host/solo), 'remote' = host's relayed transport. */
  source: 'local' | 'remote';
}

export function resolveSharedTransport(args: {
  local: ClockView;
  transport: TransportTick | null;
  transportAt: number | null;
  ownsClock: boolean;
  now: number;
}): SharedTransport | null {
  const { local, transport, transportAt, ownsClock, now } = args;
  if (ownsClock) {
    return {
      bpm: local.bpm,
      bar: local.bar,
      beat: local.beat,
      running: local.running,
      source: 'local',
    };
  }
  if (transport === null || transportAt === null) return null;
  if (now - transportAt > TRANSPORT_STALE_MS) return null; // host went quiet
  return {
    bpm: transport.bpm,
    bar: transport.bar,
    beat: transport.beat,
    running: transport.running,
    source: 'remote',
  };
}

export function useClockDriver(): void {
  useEffect(() => {
    let raf = 0;
    let lastKey = '';
    let lastEmit = 0;
    const loop = () => {
      const s = clockSnapshot(performance.now());
      const bpm = s.bpm === null ? null : Math.round(s.bpm * 10) / 10;
      const key = `${s.running}|${bpm}|${s.bar}|${s.beat}|${s.hasClock}`;
      const now = Date.now();
      if (key !== lastKey || now - lastEmit >= HEARTBEAT_MS) {
        lastKey = key;
        lastEmit = now;
        useClockStore.getState().set({
          running: s.running,
          bpm,
          bar: s.bar,
          beat: s.beat,
          hasClock: s.hasClock,
          at: now,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export function useSharedTransport(): SharedTransport | null {
  const running = useClockStore((s) => s.running);
  const bpm = useClockStore((s) => s.bpm);
  const bar = useClockStore((s) => s.bar);
  const beat = useClockStore((s) => s.beat);
  const hasClock = useClockStore((s) => s.hasClock);
  // Subscribe to the heartbeat so remote staleness re-evaluates over time.
  const at = useClockStore((s) => s.at);

  const transport = useSessionStore((s) => s.transport);
  const transportAt = useSessionStore((s) => s.transportAt);
  const self = useSessionStore((s) => s.self);
  const hostId = useSessionStore((s) => s.hostId);

  const ownsClock = self === null || self.id === hostId;
  return resolveSharedTransport({
    local: { running, bpm, bar, beat, hasClock, at },
    transport,
    transportAt,
    ownsClock,
    now: Date.now(),
  });
}
