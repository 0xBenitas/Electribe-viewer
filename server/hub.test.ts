import { describe, it, expect } from 'vitest';
import { SessionHub, type Outbound } from './hub.ts';
import type { DeviceSnapshot } from '../src/core/session/snapshot.ts';

const snap = (updatedAt: number): DeviceSnapshot => ({
  profileId: 'korg-electribe-2',
  model: 'Electribe 2',
  activePart: 1,
  parts: [],
  pattern: null,
  updatedAt,
});

/** Find the single outbound addressed to exactly `recipients` (order-free). */
function to(out: Outbound[], ...recipients: string[]): Outbound | undefined {
  const want = [...recipients].sort().join(',');
  return out.find((o) => [...o.recipients].sort().join(',') === want);
}

describe('SessionHub', () => {
  it('welcomes the first joiner as host with no peers', () => {
    const hub = new SessionHub(() => 1);
    const out = hub.handle('a', { t: 'join', room: 'jam', info: { name: 'A' } });
    const welcome = to(out, 'a');
    expect(welcome?.msg).toEqual({ t: 'welcome', self: 'a', peers: [] });
  });

  it('tells the joiner about existing peers and notifies them', () => {
    const hub = new SessionHub(() => 1);
    hub.handle('a', { t: 'join', room: 'jam', info: { name: 'A' } });
    const out = hub.handle('b', { t: 'join', room: 'jam', info: { name: 'B' } });

    const welcome = to(out, 'b');
    expect(welcome?.msg.t).toBe('welcome');
    if (welcome?.msg.t === 'welcome') {
      expect(welcome.msg.peers.map((p) => p.id)).toEqual(['a']);
      expect(welcome.msg.peers[0]!.isHost).toBe(true);
    }
    const joinNotice = to(out, 'a');
    expect(joinNotice?.msg).toMatchObject({ t: 'peer-join', peer: { id: 'b', isHost: false } });
  });

  it('isolates rooms', () => {
    const hub = new SessionHub(() => 1);
    hub.handle('a', { t: 'join', room: 'room1', info: { name: 'A' } });
    const out = hub.handle('b', { t: 'join', room: 'room2', info: { name: 'B' } });
    // b is alone in room2 → host, no one to notify.
    const welcome = to(out, 'b');
    expect(welcome?.msg.t === 'welcome' && welcome.msg.peers).toEqual([]);
    expect(to(out, 'a')).toBeUndefined();
  });

  it('relays a device snapshot to others only', () => {
    const hub = new SessionHub(() => 1);
    hub.handle('a', { t: 'join', room: 'jam', info: { name: 'A' } });
    hub.handle('b', { t: 'join', room: 'jam', info: { name: 'B' } });
    const out = hub.handle('a', { t: 'device', snapshot: snap(5) });
    expect(out).toHaveLength(1);
    expect(out[0]!.recipients).toEqual(['b']);
    expect(out[0]!.msg).toMatchObject({ t: 'device', peer: 'a' });
  });

  it('relays transport only from the host', () => {
    const hub = new SessionHub(() => 42);
    hub.handle('a', { t: 'join', room: 'jam', info: { name: 'A' } }); // host
    hub.handle('b', { t: 'join', room: 'jam', info: { name: 'B' } });

    const fromHost = hub.handle('a', {
      t: 'transport',
      bpm: 120,
      bar: 2,
      beat: 3,
      running: true,
    });
    expect(fromHost[0]!.msg).toMatchObject({
      t: 'transport',
      host: 'a',
      serverTs: 42,
      bpm: 120,
      bar: 2,
      beat: 3,
      running: true,
    });

    const fromNonHost = hub.handle('b', {
      t: 'transport',
      bpm: 99,
      bar: 1,
      beat: 1,
      running: true,
    });
    expect(fromNonHost).toEqual([]);
  });

  it('answers ping with a timestamped pong to the sender', () => {
    const hub = new SessionHub(() => 7);
    hub.handle('a', { t: 'join', room: 'jam', info: { name: 'A' } });
    const out = hub.handle('a', { t: 'ping', ts: 123 });
    expect(out).toEqual([
      { recipients: ['a'], msg: { t: 'pong', ts: 123, serverTs: 7 } },
    ]);
  });

  it('promotes a new host when the host disconnects', () => {
    let t = 0;
    const hub = new SessionHub(() => ++t);
    hub.handle('a', { t: 'join', room: 'jam', info: { name: 'A' } }); // host, joined first
    hub.handle('b', { t: 'join', room: 'jam', info: { name: 'B' } });

    const out = hub.disconnect('a');
    expect(to(out, 'b')?.msg).toMatchObject({ t: 'peer-leave', peer: 'a' });
    const promote = out.find((o) => o.msg.t === 'peer-join');
    expect(promote?.msg).toMatchObject({ t: 'peer-join', peer: { id: 'b', isHost: true } });
  });

  it('never makes a listener host; the first real player gets it', () => {
    let t = 0;
    const hub = new SessionHub(() => ++t);
    // A listener joins first.
    hub.handle('L', { t: 'join', room: 'jam', info: { name: 'Listener', listener: true } });
    // Then a player joins → the player is host, not the listener.
    const out = hub.handle('p', { t: 'join', room: 'jam', info: { name: 'P' } });
    const welcome = to(out, 'p');
    expect(welcome?.msg.t === 'welcome' && welcome.msg.peers.find((x) => x.id === 'L')?.isHost).toBe(false);
    // The player's own state is host (seen by the listener's peer-join notice).
    const notice = to(out, 'L');
    expect(notice?.msg).toMatchObject({ t: 'peer-join', peer: { id: 'p', isHost: true } });
  });

  it('promotes the oldest non-listener when the host leaves', () => {
    let t = 0;
    const hub = new SessionHub(() => ++t);
    hub.handle('p1', { t: 'join', room: 'jam', info: { name: 'P1' } }); // host
    hub.handle('L', { t: 'join', room: 'jam', info: { name: 'L', listener: true } });
    hub.handle('p2', { t: 'join', room: 'jam', info: { name: 'P2' } });
    const out = hub.disconnect('p1');
    const promote = out.find((o) => o.msg.t === 'peer-join');
    expect(promote?.msg).toMatchObject({ t: 'peer-join', peer: { id: 'p2', isHost: true } });
  });

  it('ignores messages from unknown peers and empty rooms', () => {
    const hub = new SessionHub(() => 1);
    expect(hub.handle('ghost', { t: 'device', snapshot: snap(1) })).toEqual([]);
    expect(hub.disconnect('ghost')).toEqual([]);
  });

  describe('lobby discovery', () => {
    /** Pull the `rooms` list from a `lobbies` response addressed to `peerId`. */
    function lobbiesOf(hub: SessionHub, peerId: string) {
      const out = hub.handle(peerId, { t: 'lobbies' });
      const msg = to(out, peerId)?.msg;
      return msg?.t === 'lobbies' ? msg.rooms : undefined;
    }

    it('returns no rooms when nobody is connected', () => {
      const hub = new SessionHub(() => 1);
      expect(lobbiesOf(hub, 'x')).toEqual([]);
    });

    it('aggregates rooms with their participant counts, busiest first', () => {
      const hub = new SessionHub(() => 1);
      hub.handle('a', { t: 'join', room: 'cave', info: { name: 'A' } });
      hub.handle('b', { t: 'join', room: 'cave', info: { name: 'B' } });
      hub.handle('c', { t: 'join', room: 'garage', info: { name: 'C' } });

      const rooms = lobbiesOf(hub, 'a')!;
      expect(rooms).toEqual([
        { room: 'cave', count: 2, players: 2, host: 'A', hasHostWithMachine: false },
        { room: 'garage', count: 1, players: 1, host: 'C', hasHostWithMachine: false },
      ]);
    });

    it('counts listeners apart from players', () => {
      const hub = new SessionHub(() => 1);
      hub.handle('a', { t: 'join', room: 'cave', info: { name: 'A' } });
      hub.handle('L', {
        t: 'join',
        room: 'cave',
        info: { name: 'L', listener: true },
      });

      const room = lobbiesOf(hub, 'a')![0]!;
      expect(room).toMatchObject({ count: 2, players: 1, host: 'A' });
    });

    it('flags a room whose host is already streaming a machine', () => {
      const hub = new SessionHub(() => 1);
      hub.handle('a', { t: 'join', room: 'cave', info: { name: 'A' } }); // host
      hub.handle('b', { t: 'join', room: 'cave', info: { name: 'B' } });
      hub.handle('a', { t: 'device', snapshot: snap(5) });

      const room = lobbiesOf(hub, 'b')![0]!;
      expect(room).toMatchObject({ room: 'cave', host: 'A', hasHostWithMachine: true });
    });

    it('does not register the asker as a member (discovery is read-only)', () => {
      const hub = new SessionHub(() => 1);
      hub.handle('a', { t: 'join', room: 'cave', info: { name: 'A' } });
      // 'ghost' only ever asks for lobbies — it must not appear or create a room.
      const rooms = lobbiesOf(hub, 'ghost')!;
      expect(rooms).toEqual([
        { room: 'cave', count: 1, players: 1, host: 'A', hasHostWithMachine: false },
      ]);
      // A real joiner afterwards sees only 'a', never 'ghost'.
      const welcome = to(
        hub.handle('b', { t: 'join', room: 'cave', info: { name: 'B' } }),
        'b',
      );
      if (welcome?.msg.t === 'welcome') {
        expect(welcome.msg.peers.map((p) => p.id)).toEqual(['a']);
      }
    });
  });
});
