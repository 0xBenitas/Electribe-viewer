import { describe, it, expect, vi } from 'vitest';
import {
  SessionClient,
  type SessionStatus,
  type SocketLike,
} from './sessionClient.ts';
import type { ServerMessage } from '../core/session/protocol.ts';

class FakeSocket implements SocketLike {
  sent: string[] = [];
  closed = false;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  parsedSent() {
    return this.sent.map((s) => JSON.parse(s));
  }
}

function setup() {
  const socket = new FakeSocket();
  const messages: ServerMessage[] = [];
  const statuses: SessionStatus[] = [];
  const client = new SessionClient({
    url: 'ws://x',
    room: 'jam',
    info: { name: 'Bastou' },
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    factory: () => socket,
  });
  return { socket, messages, statuses, client };
}

describe('SessionClient', () => {
  it('joins automatically on open', () => {
    const { socket, statuses, client } = setup();
    client.connect();
    expect(statuses).toContain('connecting');
    socket.onopen?.(null);
    expect(statuses).toContain('open');
    // join is the first frame; info now also carries a stable clientId.
    expect(socket.parsedSent()[0]).toMatchObject({
      t: 'join',
      room: 'jam',
      info: { name: 'Bastou' },
    });
    client.disconnect(); // stop the heartbeat started on open
  });

  it('parses inbound messages and ignores malformed frames', () => {
    const { socket, messages, client } = setup();
    client.connect();
    socket.onmessage?.({ data: JSON.stringify({ t: 'peer-leave', peer: 'p2' }) });
    socket.onmessage?.({ data: 'not json{' });
    expect(messages).toEqual([{ t: 'peer-leave', peer: 'p2' }]);
  });

  it('serialises typed sends', () => {
    const { socket, client } = setup();
    client.connect();
    socket.sent = [];
    client.sendTransport({ bpm: 120, bar: 1, beat: 2, running: true });
    client.sendDevice({
      profileId: null,
      model: 'X',
      activePart: null,
      parts: [],
      pattern: null,
      updatedAt: 9,
    });
    expect(socket.parsedSent()[0]).toEqual({
      t: 'transport',
      bpm: 120,
      bar: 1,
      beat: 2,
      running: true,
    });
    expect(socket.parsedSent()[1]).toMatchObject({ t: 'device', snapshot: { updatedAt: 9 } });
  });

  it('sends leave and closes on disconnect', () => {
    const { socket, client } = setup();
    client.connect();
    socket.sent = [];
    client.disconnect();
    expect(socket.parsedSent()[0]).toEqual({ t: 'leave' });
    expect(socket.closed).toBe(true);
  });

  it('does not throw when sending before connect', () => {
    const { client } = setup();
    expect(() => client.send({ t: 'ping', ts: 1 })).not.toThrow();
  });

  it('reconnects with backoff after an unexpected drop, re-joining on reopen', () => {
    vi.useFakeTimers();
    try {
      const sockets: FakeSocket[] = [];
      const statuses: SessionStatus[] = [];
      const client = new SessionClient({
        url: 'ws://x',
        room: 'jam',
        info: { name: 'Bastou' },
        onMessage: () => {},
        onStatus: (s) => statuses.push(s),
        factory: () => {
          const s = new FakeSocket();
          sockets.push(s);
          return s;
        },
      });
      client.connect();
      sockets[0]!.onopen?.(null);
      expect(statuses).toContain('open');

      sockets[0]!.onclose?.(null); // unexpected drop
      expect(statuses[statuses.length - 1]).toBe('connecting'); // retrying, not dead
      expect(sockets).toHaveLength(1); // not reconnected yet (waiting on backoff)

      vi.advanceTimersByTime(10_000); // let the backoff fire
      expect(sockets).toHaveLength(2); // a fresh socket was opened
      sockets[1]!.onopen?.(null);
      expect(sockets[1]!.parsedSent()[0]).toMatchObject({
        t: 'join',
        room: 'jam',
        info: { name: 'Bastou' },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports closed and stops retrying on a deliberate disconnect', () => {
    vi.useFakeTimers();
    try {
      const sockets: FakeSocket[] = [];
      const statuses: SessionStatus[] = [];
      const client = new SessionClient({
        url: 'ws://x',
        room: 'jam',
        info: { name: 'B' },
        onMessage: () => {},
        onStatus: (s) => statuses.push(s),
        factory: () => {
          const s = new FakeSocket();
          sockets.push(s);
          return s;
        },
      });
      client.connect();
      sockets[0]!.onopen?.(null);

      client.disconnect();
      expect(statuses[statuses.length - 1]).toBe('closed');
      expect(sockets[0]!.closed).toBe(true);

      // A trailing close (ws fires it after our close()) must NOT reconnect.
      sockets[0]!.onclose?.(null);
      vi.advanceTimersByTime(10_000);
      expect(sockets).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconnects a half-open socket that stops ponging (watchdog)', () => {
    vi.useFakeTimers();
    try {
      const sockets: FakeSocket[] = [];
      const client = new SessionClient({
        url: 'ws://x',
        room: 'jam',
        info: { name: 'B' },
        onMessage: () => {},
        factory: () => {
          const s = new FakeSocket();
          sockets.push(s);
          return s;
        },
      });
      client.connect();
      sockets[0]!.onopen?.(null); // open; heartbeat starts, lastPongAt = now
      // Never deliver a pong → after the pong timeout the watchdog forces a
      // reconnect even though 'close' never fired (the half-open mobile case).
      vi.advanceTimersByTime(14_000);
      expect(sockets[0]!.closed).toBe(true); // forced closed by the watchdog
      expect(sockets.length).toBeGreaterThanOrEqual(2); // and it reopened
    } finally {
      vi.useRealTimers();
    }
  });

  it('declares the link lost after repeated failures but keeps retrying', () => {
    vi.useFakeTimers();
    try {
      const sockets: FakeSocket[] = [];
      const statuses: SessionStatus[] = [];
      const client = new SessionClient({
        url: 'ws://x',
        room: 'jam',
        info: { name: 'B' },
        onMessage: () => {},
        onStatus: (s) => statuses.push(s),
        factory: () => {
          const s = new FakeSocket();
          sockets.push(s);
          return s;
        },
      });
      client.connect(); // socket[0], never opens
      for (let i = 0; i < 8; i++) {
        sockets[sockets.length - 1]!.onclose?.(null); // drop → schedule reconnect
        vi.advanceTimersByTime(20_000); // fire the (capped) backoff → next open
      }
      expect(statuses).toContain('closed'); // gave up visibly at some point
      expect(sockets.length).toBeGreaterThan(6); // …yet kept retrying
    } finally {
      vi.useRealTimers();
    }
  });
});
