// WebSocket session client — transport only.
//
// Wraps a WebSocket, serialises ClientMessages out and parses ServerMessages in.
// The socket is injectable so the protocol can be unit-tested without a network;
// in the browser it defaults to the global WebSocket.

import type {
  ClientMessage,
  Cue,
  PeerInfo,
  ServerMessage,
  TransportTick,
} from '../core/session/protocol.ts';
import type { DeviceSnapshot } from '../core/session/snapshot.ts';

export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

export type SessionStatus = 'connecting' | 'open' | 'closed';

export interface SessionClientOptions {
  url: string;
  room: string;
  info: PeerInfo;
  onMessage: (msg: ServerMessage) => void;
  onStatus?: (status: SessionStatus) => void;
  /** Override the socket constructor (tests). Defaults to global WebSocket. */
  factory?: SocketFactory;
}

export const defaultSocketFactory: SocketFactory = (url) =>
  new WebSocket(url) as unknown as SocketLike;

/** Reconnect backoff: first retry after ~0.5 s, doubling up to ~8 s (±25 % jitter). */
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8000;
/** Heartbeat cadence, and how long without a pong means the link is dead. */
const PING_MS = 3000;
const PONG_TIMEOUT_MS = 9000;
/** Stay open this long before we trust the link and reset the backoff ladder. */
const STABLE_MS = 8000;
/** After this many failed reconnects in a row, tell the UI the link is lost
 *  (purge peers / "connexion perdue") — we keep retrying in the background. */
const LOST_AFTER_ATTEMPTS = 6;

function randomClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export class SessionClient {
  private socket: SocketLike | null = null;
  /** True once disconnect() ran: stops the auto-reconnect loop for good. */
  private deliberate = false;
  private attempt = 0;
  /** Set once we've told the UI the link is lost, to avoid flip-flopping. */
  private lostDeclared = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAt = 0;
  /** Stable across reconnects so the server can evict our previous ghost. */
  private readonly clientId = randomClientId();

  constructor(private readonly opts: SessionClientOptions) {}

  connect(): void {
    this.deliberate = false;
    this.attempt = 0;
    this.lostDeclared = false;
    this.open();
  }

  /** Open one socket. On an unexpected drop we re-open with backoff (re-joining
   *  on each reopen, since the server assigns a fresh peer id every connection). */
  private open(): void {
    this.clearReconnect();
    const make = this.opts.factory ?? defaultSocketFactory;
    const socket = make(this.opts.url);
    this.socket = socket;
    this.opts.onStatus?.('connecting');

    socket.onopen = () => {
      if (this.socket !== socket) return; // a newer socket superseded this one
      this.lastPongAt = Date.now();
      this.armStableTimer();
      this.lostDeclared = false;
      this.opts.onStatus?.('open');
      // join FIRST (callers assert it's the first frame), then start the heartbeat.
      this.send({
        t: 'join',
        room: this.opts.room,
        info: { ...this.opts.info, clientId: this.clientId },
      });
      this.startHeartbeat();
    };
    socket.onmessage = (ev) => {
      if (this.socket !== socket) return; // ignore frames from a superseded socket
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return; // ignore malformed frames
      }
      if (msg.t === 'pong') this.lastPongAt = Date.now();
      this.opts.onMessage(msg);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return; // event from a superseded socket
      this.socket = null;
      this.stopHeartbeat();
      this.clearStable();
      if (this.deliberate) return; // disconnect() already reported 'closed'
      this.scheduleReconnect();
    };
    socket.onerror = () => {
      // 'close' will follow.
    };
  }

  /** Ping on the wire and detect a half-open socket (no pong) — the dominant
   *  mobile failure where the browser never fires 'close'. */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.send({ t: 'ping', ts: performance.now() }); // calibrate latency immediately
    this.heartbeatTimer = setInterval(() => {
      if (this.socket === null) return;
      if (Date.now() - this.lastPongAt > PONG_TIMEOUT_MS) {
        // Dead though it still claims open → force a reconnect ourselves.
        const dead = this.socket;
        this.socket = null;
        this.stopHeartbeat();
        this.clearStable();
        try {
          dead.close();
        } catch {
          // already gone
        }
        this.scheduleReconnect();
        return;
      }
      this.send({ t: 'ping', ts: performance.now() });
    }, PING_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** A connection that stays open long enough is trusted: reset the backoff so a
   *  later, unrelated drop starts retrying fast again (not at the capped delay). */
  private armStableTimer(): void {
    this.clearStable();
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null;
      this.attempt = 0;
    }, STABLE_MS);
  }

  private clearStable(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.deliberate || this.reconnectTimer) return;
    if (!this.lostDeclared && this.attempt >= LOST_AFTER_ATTEMPTS) {
      // Give up visibly (purge peers, "connexion perdue") but keep retrying so a
      // long yet recoverable outage still heals on its own.
      this.lostDeclared = true;
      this.opts.onStatus?.('closed');
    } else if (!this.lostDeclared) {
      // Surface "retrying" rather than "dead" so the UI keeps its peers/transport.
      this.opts.onStatus?.('connecting');
    }
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(this.attempt, 16));
    const delay = base * (0.75 + Math.random() * 0.5); // ±25 % jitter, avoid thundering herd
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  send(msg: ClientMessage): void {
    try {
      this.socket?.send(JSON.stringify(msg));
    } catch {
      // Socket not OPEN yet (CONNECTING) or already closing: drop the frame.
    }
  }

  sendDevice(snapshot: DeviceSnapshot): void {
    this.send({ t: 'device', snapshot });
  }

  sendTransport(tick: TransportTick): void {
    this.send({ t: 'transport', ...tick });
  }

  sendCue(cue: Cue): void {
    this.send({ t: 'cue', cue });
  }

  disconnect(): void {
    this.deliberate = true;
    this.clearReconnect();
    this.clearStable();
    this.stopHeartbeat();
    this.send({ t: 'leave' });
    this.socket?.close();
    this.socket = null;
    this.opts.onStatus?.('closed');
  }
}
