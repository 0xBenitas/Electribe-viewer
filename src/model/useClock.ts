// Live clock hooks for the cockpit.
//
// `useClock` samples the local MIDI clock each animation frame (isolate it in a
// small component — it re-renders ~60fps). `useSharedTransport` returns the
// authoritative position to display: the host (and solo) reads its own clock;
// other peers read the host's relayed transport.

import { useEffect, useState } from 'react';
import { clockSnapshot } from '../midi/bridge.ts';
import { useSessionStore } from '../store/session.ts';
import type { ClockSnapshot } from '../core/clock/types.ts';

export function useClock(): ClockSnapshot {
  const [snap, setSnap] = useState<ClockSnapshot>(() =>
    clockSnapshot(performance.now()),
  );
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setSnap(clockSnapshot(performance.now()));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return snap;
}

export interface SharedTransport {
  bpm: number | null;
  bar: number;
  beat: number;
  /** Phase within the beat 0..1 — only smooth for the local source. */
  phase: number;
  running: boolean;
  /** 'local' = own clock (host/solo), 'remote' = host's relayed transport. */
  source: 'local' | 'remote';
}

export function useSharedTransport(): SharedTransport | null {
  const local = useClock();
  const transport = useSessionStore((s) => s.transport);
  const self = useSessionStore((s) => s.self);
  const hostId = useSessionStore((s) => s.hostId);

  // Solo (no session) or we are the host → trust our own clock.
  const ownsClock = self === null || self.id === hostId;
  if (ownsClock) {
    return {
      bpm: local.bpm,
      bar: local.bar,
      beat: local.beat,
      phase: local.phase,
      running: local.running,
      source: 'local',
    };
  }

  if (!transport) return null;
  return {
    bpm: transport.bpm,
    bar: transport.bar,
    beat: transport.beat,
    phase: 0,
    running: true,
    source: 'remote',
  };
}
