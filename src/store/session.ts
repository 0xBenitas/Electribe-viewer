// Session store — the multiplayer state (presence + replicated machines + the
// host's shared transport). Singleton for the local client's view of one room.
// Fed by the WebSocket layer (next phase); rendered via snapshotToMachine.

import { create } from 'zustand';
import {
  isNewerSnapshot,
  type DeviceSnapshot,
} from '../core/session/snapshot.ts';
import type {
  PeerInfo,
  PeerState,
  TransportTick,
} from '../core/session/protocol.ts';

interface SessionStore {
  self: { id: string; info: PeerInfo } | null;
  peers: Record<string, PeerState>;
  /** Host's shared bar/beat/bpm, or null when no session/host. */
  transport: TransportTick | null;

  setSelf: (id: string, info: PeerInfo) => void;
  addPeer: (peer: PeerState) => void;
  removePeer: (id: string) => void;
  /** Apply a peer's snapshot, dropping stale (out-of-order) frames. */
  applySnapshot: (peerId: string, snapshot: DeviceSnapshot) => void;
  setTransport: (transport: TransportTick | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  self: null,
  peers: {},
  transport: null,

  setSelf: (id, info) => set({ self: { id, info } }),

  addPeer: (peer) => set((s) => ({ peers: { ...s.peers, [peer.id]: peer } })),

  removePeer: (id) =>
    set((s) => {
      if (!(id in s.peers)) return {};
      const peers = { ...s.peers };
      delete peers[id];
      return { peers };
    }),

  applySnapshot: (peerId, snapshot) =>
    set((s) => {
      const peer = s.peers[peerId];
      if (!peer || !isNewerSnapshot(snapshot, peer.device)) return {};
      return { peers: { ...s.peers, [peerId]: { ...peer, device: snapshot } } };
    }),

  setTransport: (transport) => set({ transport }),

  reset: () => set({ self: null, peers: {}, transport: null }),
}));
