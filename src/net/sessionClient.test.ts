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
    expect(socket.parsedSent()[0]).toEqual({
      t: 'join',
      room: 'jam',
      info: { name: 'Bastou' },
    });
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
    client.sendTransport({ bpm: 120, bar: 1, beat: 2 });
    client.sendDevice({
      profileId: null,
      model: 'X',
      activePart: null,
      parts: [],
      pattern: null,
      updatedAt: 9,
    });
    expect(socket.parsedSent()[0]).toEqual({ t: 'transport', bpm: 120, bar: 1, beat: 2 });
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

  it('reports closed status', () => {
    const { socket, statuses, client } = setup();
    client.connect();
    socket.onclose?.(null);
    expect(statuses[statuses.length - 1]).toBe('closed');
    expect(vi.isMockFunction(socket.send)).toBe(false); // sanity: real fake used
  });
});
