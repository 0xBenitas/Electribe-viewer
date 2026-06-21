// Audio transport abstraction (JAMBOREE §8).
// The cockpit never talks to an audio engine directly — it talks to this
// interface. v1 backend = NINJAM (orchestrates a *native* client; the browser
// does NOT carry audio in v1). Jamulus / WebRTC backends can be added without
// touching the cockpit.

export interface SessionConfig {
  /** Jam room / session name. */
  room: string;
  /** NINJAM (or other) server host, e.g. "jam.example.org:2049". */
  serverHost: string;
  /** Display name for this player. */
  user: string;
}

export interface Peer {
  id: string;
  name: string;
}

export interface AudioTransport {
  connect(session: SessionConfig): Promise<void>;
  disconnect(): Promise<void>;
  /** Indicative one-way latency in ms (0 = unknown / not measured yet). */
  getLatencyHint(): number;
  onPeerJoin(cb: (peer: Peer) => void): void;
  onPeerLeave(cb: (peer: Peer) => void): void;
}
