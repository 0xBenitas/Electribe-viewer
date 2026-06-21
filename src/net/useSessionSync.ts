// React glue: owns the SessionClient lifecycle, broadcasts the local machine on
// a steady cadence (decoupled from the hot CC stream), and tears everything down
// on disconnect.

import { useEffect, useRef } from 'react';
import { SessionClient } from './sessionClient.ts';
import { dispatchServerMessage } from './sync.ts';
import { setActiveClient } from './sessionLink.ts';
import { machineToSnapshot } from '../model/adapters.ts';
import { clockSnapshot } from '../midi/bridge.ts';
import { useSessionStore } from '../store/session.ts';
import { useCueStore } from '../store/cues.ts';
import type { Machine } from '../model/machine.ts';

export interface SessionConnectConfig {
  url: string;
  room: string;
  name: string;
  /** Join without a machine: don't broadcast a device, never become host. */
  listenOnly?: boolean;
}

/** How often we broadcast our machine state (ms). */
const SNAPSHOT_INTERVAL_MS = 150;
/** How often the host broadcasts the shared transport (ms). */
const TRANSPORT_INTERVAL_MS = 200;
/** How often we ping the server to measure latency (ms). */
const PING_INTERVAL_MS = 3000;

export function useSessionSync(
  config: SessionConnectConfig | null,
  localMachine: Machine,
): void {
  const machineRef = useRef(localMachine);
  machineRef.current = localMachine;

  useEffect(() => {
    if (!config) return;

    const listenOnly = config.listenOnly ?? false;
    useSessionStore.getState().setSelf('', { name: config.name, listener: listenOnly });
    const client = new SessionClient({
      url: config.url,
      room: config.room,
      info: { name: config.name, listener: listenOnly },
      onMessage: dispatchServerMessage,
      onStatus: (status) => {
        // Surface link health; on an unexpected drop, shed now-stale peers.
        if (status === 'closed') useSessionStore.getState().connectionLost();
        else useSessionStore.getState().setLinkStatus(status);
      },
    });
    client.connect();
    setActiveClient(client);

    // A listener has no machine to replicate.
    let lastKey = '';
    const deviceTimer = listenOnly
      ? null
      : setInterval(() => {
          // Key off the actual wire payload (minus its timestamp) so UI-only
          // changes (custom name/colour) never trigger an identical broadcast.
          const snapshot = machineToSnapshot(machineRef.current, 0);
          const key = JSON.stringify(snapshot);
          if (key === lastKey) return; // nothing on the wire changed
          lastKey = key;
          client.sendDevice({ ...snapshot, updatedAt: Date.now() });
        }, SNAPSHOT_INTERVAL_MS);

    const pingTimer = setInterval(() => {
      client.send({ t: 'ping', ts: performance.now() });
    }, PING_INTERVAL_MS);

    // Only the host broadcasts the shared tempo. While running, send every tick
    // (bar/beat are valid before BPM warms up). On stop, send ONE final frame so
    // peers learn the host stopped instead of just seeing the clock go stale.
    let wasRunning = false;
    const transportTimer = setInterval(() => {
      const { self, hostId } = useSessionStore.getState();
      if (!self || self.id !== hostId) return;
      const c = clockSnapshot(performance.now());
      if (c.running) {
        client.sendTransport({ bpm: c.bpm ?? 0, bar: c.bar, beat: c.beat, running: true });
        wasRunning = true;
      } else if (wasRunning) {
        client.sendTransport({ bpm: c.bpm ?? 0, bar: c.bar, beat: c.beat, running: false });
        wasRunning = false;
      }
    }, TRANSPORT_INTERVAL_MS);

    return () => {
      if (deviceTimer) clearInterval(deviceTimer);
      clearInterval(transportTimer);
      clearInterval(pingTimer);
      setActiveClient(null);
      client.disconnect();
      useSessionStore.getState().reset();
      useCueStore.getState().clear();
    };
  }, [config]);
}
