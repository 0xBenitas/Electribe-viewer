// Glue between the WebSocket protocol and the app: inbound ServerMessages drive
// the session store; outbound is owned by the sync hook.

import { useMemo } from 'react';
import { useSessionStore } from '../store/session.ts';
import { snapshotToMachine } from '../model/adapters.ts';
import type { ServerMessage } from '../core/session/protocol.ts';
import type { Machine } from '../model/machine.ts';

/** Apply one inbound server message to the session store. */
export function dispatchServerMessage(msg: ServerMessage): void {
  const store = useSessionStore.getState();
  switch (msg.t) {
    case 'welcome': {
      // Keep the name we joined with; adopt the server-assigned id.
      store.setSelf(msg.self, store.self?.info ?? { name: '' });
      for (const peer of msg.peers) store.addPeer(peer);
      // No existing host among the others → we're the first joiner, i.e. host.
      const existingHost = msg.peers.find((p) => p.isHost);
      store.setHostId(existingHost ? existingHost.id : msg.self);
      break;
    }
    case 'peer-join':
      store.addPeer(msg.peer);
      if (msg.peer.isHost) store.setHostId(msg.peer.id);
      break;
    case 'peer-leave':
      store.removePeer(msg.peer);
      // Host left: clear until the promotion peer-join names the successor.
      if (useSessionStore.getState().hostId === msg.peer) store.setHostId(null);
      break;
    case 'device':
      store.applySnapshot(msg.peer, msg.snapshot);
      break;
    case 'transport':
      store.setTransport({ bpm: msg.bpm, bar: msg.bar, beat: msg.beat });
      break;
    case 'cue':
      // Phase 3: surface the cue in the cockpit.
      break;
    case 'pong':
      // Latency estimation lands with the transport UI.
      break;
  }
}

/** Read-only Machines for every peer that has replicated a device. */
export function usePeerMachines(): Machine[] {
  const peers = useSessionStore((s) => s.peers);
  return useMemo(
    () =>
      Object.values(peers)
        .filter((p) => p.device)
        .map((p) => snapshotToMachine(p.device!, { id: p.id, info: p.info })),
    [peers],
  );
}
