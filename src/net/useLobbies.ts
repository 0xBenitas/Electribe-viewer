// React glue for the lobby browser: keeps a LobbyClient alive while the landing
// screen is shown, polls the live sessions on a steady cadence, and tears the
// socket down when we leave the landing (or join a room).

import { useEffect, useState } from 'react';
import { LobbyClient, type LobbyStatus } from './lobbyClient.ts';
import type { LobbyInfo } from '../core/session/protocol.ts';

/** How often we refresh the list of live sessions (ms). */
const POLL_MS = 3000;

export interface LobbyState {
  lobbies: LobbyInfo[];
  status: LobbyStatus | 'idle';
}

export function useLobbies(serverUrl: string, enabled: boolean): LobbyState {
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [status, setStatus] = useState<LobbyStatus | 'idle'>('idle');

  useEffect(() => {
    if (!enabled || !serverUrl) {
      setStatus('idle');
      setLobbies([]);
      return;
    }
    const client = new LobbyClient({
      url: serverUrl,
      onLobbies: setLobbies,
      onStatus: setStatus,
    });
    client.poll(); // connect + first request
    const timer = setInterval(() => client.poll(), POLL_MS);
    return () => {
      clearInterval(timer);
      client.disconnect();
    };
  }, [serverUrl, enabled]);

  return { lobbies, status };
}
