// NINJAM transport — v1 backend (ENSEMBLE §3).
//
// REALITY CHECK (do not regress on this): there is no production-ready browser
// NINJAM client today. In v1 the audio flows through a *native* client (Jamtaba,
// or Reaper + ninjam plugin) running alongside the cockpit. This class does NOT
// carry audio. It records the session config and exposes the connection target
// the user pastes into that native client. The cockpit owns everything else
// (BPM, bar position, presence, cues) over WebSocket.

import type { AudioTransport, Peer, SessionConfig } from './types.ts';

/** Default NINJAM server port. */
export const NINJAM_DEFAULT_PORT = 2049;

/**
 * Normalise a NINJAM server address to `host:port` (the string a native client
 * expects). A NINJAM server *is* the jam — there are no sub-rooms — so the
 * cockpit "room" does not appear here; everyone points at the same server.
 */
export function ninjamTarget(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, '');
  return /:\d+$/.test(trimmed) ? trimmed : `${trimmed}:${NINJAM_DEFAULT_PORT}`;
}

export class NinjamTransport implements AudioTransport {
  private config: SessionConfig | null = null;
  private peerJoin: ((peer: Peer) => void) | null = null;
  private peerLeave: ((peer: Peer) => void) | null = null;

  async connect(session: SessionConfig): Promise<void> {
    // No socket opened here in v1: audio is out of the browser's hands.
    this.config = session;
  }

  async disconnect(): Promise<void> {
    this.config = null;
  }

  getLatencyHint(): number {
    // Unknown until measured against the live server. Kept indicative per §8.
    return 0;
  }

  onPeerJoin(cb: (peer: Peer) => void): void {
    this.peerJoin = cb;
  }

  onPeerLeave(cb: (peer: Peer) => void): void {
    this.peerLeave = cb;
  }

  /** `host:port` to paste into Jamtaba / Reaper. Null until connected. */
  nativeClientTarget(): string | null {
    return this.config ? ninjamTarget(this.config.serverHost) : null;
  }

  /** Wired by the session layer once real peer events exist (Phase 1+). */
  emitPeerJoin(peer: Peer): void {
    this.peerJoin?.(peer);
  }

  emitPeerLeave(peer: Peer): void {
    this.peerLeave?.(peer);
  }
}
