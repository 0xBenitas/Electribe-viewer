// WebSocket session protocol (ENSEMBLE §5, §6).
// One room = one jam session. The server is a thin fan-out relay: presence,
// shared BPM (host is the single source of truth), device-state replication,
// and bar-aligned non-verbal cues. No audio touches this socket.

import type { DeviceSnapshot } from './snapshot.ts';

export type PeerId = string;

export interface PeerInfo {
  name: string;
  /** Palette colour for this player across the cockpit. */
  color?: string;
}

export interface PeerState {
  id: PeerId;
  info: PeerInfo;
  /** The host owns the shared BPM (the "living metronome", §5). */
  isHost: boolean;
  /** Last replicated machine state, if this peer has a device. */
  device?: DeviceSnapshot;
}

/**
 * A non-verbal cue — the project's differentiator (§5). The one-bar NINJAM
 * offset is the MEDIUM: a cue fired during bar N lands cleanly at bar N+1 for
 * everyone, turning the latency into the signalling channel rather than a bug.
 */
export interface Cue {
  id: string;
  kind: 'break' | 'up' | 'down' | 'drop' | 'cut' | 'custom';
  /** Free label when kind === 'custom'. */
  label?: string;
  /** Absolute bar (host timeline) at which the cue should land. */
  landAtBar: number;
  createdAt: number;
}

/** Host's shared transport position, the visual lighthouse of §5. */
export interface TransportTick {
  bpm: number;
  /** 1-based bar in the host timeline. */
  bar: number;
  /** 1-based beat within the bar. */
  beat: number;
}

/** Messages a client sends to the server. */
export type ClientMessage =
  | { t: 'join'; room: string; info: PeerInfo }
  | { t: 'leave' }
  | ({ t: 'transport' } & TransportTick)
  | { t: 'device'; snapshot: DeviceSnapshot }
  | { t: 'cue'; cue: Cue }
  | { t: 'ping'; ts: number };

/** Messages the server broadcasts to clients. */
export type ServerMessage =
  | { t: 'welcome'; self: PeerId; peers: PeerState[] }
  | { t: 'peer-join'; peer: PeerState }
  | { t: 'peer-leave'; peer: PeerId }
  | ({ t: 'transport'; host: PeerId; serverTs: number } & TransportTick)
  | { t: 'device'; peer: PeerId; snapshot: DeviceSnapshot }
  | { t: 'cue'; peer: PeerId; cue: Cue }
  | { t: 'pong'; ts: number; serverTs: number };
