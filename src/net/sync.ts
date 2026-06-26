// Glue between the WebSocket protocol and the app: inbound ServerMessages drive
// the session store; outbound is owned by the sync hook.

import { useMemo } from 'react';
import { useSessionStore } from '../store/session.ts';
import { useCueStore } from '../store/cues.ts';
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
      // Reconcile to exactly the room's current peers. On a reconnect this drops
      // anyone who left while we were down (welcome carries their last device).
      store.setPeers(msg.peers);
      // No existing host among the others → we're the first joiner, i.e. host.
      const existingHost = msg.peers.find((p) => p.isHost);
      store.setHostId(existingHost ? existingHost.id : msg.self);
      break;
    }
    case 'peer-join':
      // A host-promotion peer-join is echoed to the promoted peer too: adopt the
      // host change but don't add ourselves to our own peer list (ghost/double).
      if (msg.peer.isHost) store.setHostId(msg.peer.id);
      if (msg.peer.id !== store.self?.id) store.addPeer(msg.peer);
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
      // The server gates transport to the host; trust its `host` as authoritative.
      store.setHostId(msg.host);
      store.setTransport({
        bpm: msg.bpm,
        bar: msg.bar,
        beat: msg.beat,
        running: msg.running,
      });
      break;
    case 'cue':
      useCueStore.getState().add({ cue: msg.cue, peer: msg.peer });
      break;
    case 'pong':
      // RTT to the session server: now minus the ts we sent (perf-clock domain).
      store.setLatency(Math.round(performance.now() - msg.ts));
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
