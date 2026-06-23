// Lobby client — discovery transport only.
//
// Opens a WebSocket to the session server and asks for the live sessions
// (`{ t: 'lobbies' }`) WITHOUT ever joining a room. Because it never sends
// `join`, the server never registers it as a member: discovery is read-only and
// alters no jam. Used by the landing screen to list joinable sessions.

import {
  defaultSocketFactory,
  type SocketFactory,
  type SocketLike,
} from './sessionClient.ts';
import type { LobbyInfo, ServerMessage } from '../core/session/protocol.ts';

export type LobbyStatus = 'connecting' | 'open' | 'closed';

export interface LobbyClientOptions {
  url: string;
  onLobbies: (rooms: LobbyInfo[]) => void;
  onStatus?: (status: LobbyStatus) => void;
  /** Override the socket constructor (tests). Defaults to global WebSocket. */
  factory?: SocketFactory;
}

export class LobbyClient {
  private socket: SocketLike | null = null;

  constructor(private readonly opts: LobbyClientOptions) {}

  connect(): void {
    const make = this.opts.factory ?? defaultSocketFactory;
    const socket = make(this.opts.url);
    this.socket = socket;
    this.opts.onStatus?.('connecting');

    socket.onopen = () => {
      this.opts.onStatus?.('open');
      this.request(); // first snapshot as soon as we're connected
    };
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMessage;
        if (msg.t === 'lobbies') this.opts.onLobbies(msg.rooms);
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

  /** Ask the server for the current list of live sessions. */
  request(): void {
    try {
      this.socket?.send(JSON.stringify({ t: 'lobbies' }));
    } catch {
      // socket not OPEN yet or already closing: the next poll will retry
    }
  }

  /** Steady tick: ask again, reconnecting first if the link dropped. */
  poll(): void {
    if (this.socket) this.request();
    else this.connect(); // onopen re-requests immediately
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}
