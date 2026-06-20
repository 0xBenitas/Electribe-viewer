// React glue: owns the SessionClient lifecycle, broadcasts the local machine on
// a steady cadence (decoupled from the hot CC stream), and tears everything down
// on disconnect.

import { useEffect, useRef } from 'react';
import { SessionClient } from './sessionClient.ts';
import { dispatchServerMessage } from './sync.ts';
import { machineToSnapshot } from '../model/adapters.ts';
import { useSessionStore } from '../store/session.ts';
import type { Machine } from '../model/machine.ts';

export interface SessionConnectConfig {
  url: string;
  room: string;
  name: string;
}

/** How often we broadcast our machine state (ms). */
const SNAPSHOT_INTERVAL_MS = 150;

/** A stable key over the device-facing fields, to skip unchanged broadcasts. */
function deviceKey(machine: Machine): string {
  return JSON.stringify([machine.activePartId, machine.parts, machine.pattern]);
}

export function useSessionSync(
  config: SessionConnectConfig | null,
  localMachine: Machine,
): void {
  const machineRef = useRef(localMachine);
  machineRef.current = localMachine;

  useEffect(() => {
    if (!config) return;

    useSessionStore.getState().setSelf('', { name: config.name });
    const client = new SessionClient({
      url: config.url,
      room: config.room,
      info: { name: config.name },
      onMessage: dispatchServerMessage,
    });
    client.connect();

    let lastKey = '';
    const timer = setInterval(() => {
      const machine = machineRef.current;
      const key = deviceKey(machine);
      if (key === lastKey) return; // nothing changed → don't flood the relay
      lastKey = key;
      client.sendDevice(machineToSnapshot(machine, Date.now()));
    }, SNAPSHOT_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      client.disconnect();
      useSessionStore.getState().reset();
    };
  }, [config]);
}
