// NINJAM transport — v1 backend (JAMBOREE §3).
//
// REALITY CHECK (do not regress on this): there is no production-ready browser
// NINJAM client today. In v1 the audio flows through a *native* client (Jamtaba,
// or Reaper + ninjam plugin) running alongside the cockpit. This class does NOT
// carry audio. It records the session config and exposes the connection target
// the user pastes into that native client. The cockpit owns everything else
// (BPM, bar position, presence, cues) over WebSocket.

import type { AudioTransport, SessionConfig } from './types.ts';

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

  // v1: peer presence comes from the WebSocket session layer, not from NINJAM,
  // so these AudioTransport hooks are intentional no-ops for this backend.
  onPeerJoin(): void {}
  onPeerLeave(): void {}

  /** `host:port` to paste into Jamtaba / Reaper. Null until connected. */
  nativeClientTarget(): string | null {
    return this.config ? ninjamTarget(this.config.serverHost) : null;
  }
}
