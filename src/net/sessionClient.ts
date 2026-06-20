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

const defaultFactory: SocketFactory = (url) =>
  new WebSocket(url) as unknown as SocketLike;

export class SessionClient {
  private socket: SocketLike | null = null;

  constructor(private readonly opts: SessionClientOptions) {}

  connect(): void {
    const make = this.opts.factory ?? defaultFactory;
    const socket = make(this.opts.url);
    this.socket = socket;
    this.opts.onStatus?.('connecting');

    socket.onopen = () => {
      this.opts.onStatus?.('open');
      this.send({ t: 'join', room: this.opts.room, info: this.opts.info });
    };
    socket.onmessage = (ev) => {
      try {
        this.opts.onMessage(JSON.parse(String(ev.data)) as ServerMessage);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      this.opts.onStatus?.('closed');
      this.socket = null;
    };
    socket.onerror = () => {
      // 'close' will follow.
    };
  }

  send(msg: ClientMessage): void {
    this.socket?.send(JSON.stringify(msg));
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
    this.send({ t: 'leave' });
    this.socket?.close();
    this.socket = null;
  }
}
