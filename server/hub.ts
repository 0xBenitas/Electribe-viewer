// Session relay — pure room/fan-out logic, no I/O.
//
// The server is a thin fan-out relay (ENSEMBLE §6): presence, the host's shared
// transport, device-state replication, and bar-aligned cues. No audio touches
// this socket. Keeping the logic pure makes it fully unit-testable; the `ws`
// adapter (index.ts) only maps sockets to peer ids and ships the bytes.

import type {
  ClientMessage,
  Cue,
  PeerInfo,
  PeerState,
  ServerMessage,
  TransportTick,
} from '../src/core/session/protocol.ts';
import type { DeviceSnapshot } from '../src/core/session/snapshot.ts';

export interface Outbound {
  /** Peer ids that should receive `msg`. */
  recipients: string[];
  msg: ServerMessage;
}

interface Member {
  room: string;
  state: PeerState;
  joinedAt: number;
}

export class SessionHub {
  private readonly members = new Map<string, Member>();

  constructor(private readonly now: () => number = Date.now) {}

  handle(peerId: string, msg: ClientMessage): Outbound[] {
    switch (msg.t) {
      case 'join':
        return this.join(peerId, msg.room, msg.info);
      case 'leave':
        return this.disconnect(peerId);
      case 'transport':
        return this.transport(peerId, msg);
      case 'device':
        return this.device(peerId, msg.snapshot);
      case 'cue':
        return this.cue(peerId, msg.cue);
      case 'ping':
        return [
          {
            recipients: [peerId],
            msg: { t: 'pong', ts: msg.ts, serverTs: this.now() },
          },
        ];
    }
  }

  disconnect(peerId: string): Outbound[] {
    const member = this.members.get(peerId);
    if (!member) return [];
    this.members.delete(peerId);

    const others = this.roomPeerIds(member.room);
    if (others.length === 0) return [];

    const out: Outbound[] = [
      { recipients: others, msg: { t: 'peer-leave', peer: peerId } },
    ];
    // Promote a new host if the one that left held the BPM (§5).
    if (member.state.isHost) {
      const next = this.oldestMember(member.room);
      if (next) {
        next.state.isHost = true;
        out.push({
          recipients: this.roomPeerIds(member.room),
          msg: { t: 'peer-join', peer: next.state },
        });
      }
    }
    return out;
  }

  private join(peerId: string, room: string, info: PeerInfo): Outbound[] {
    this.members.delete(peerId); // tolerate a re-join
    const existing = this.roomPeerStates(room);
    const isHost = !existing.some((p) => p.isHost);
    const state: PeerState = { id: peerId, info, isHost };
    this.members.set(peerId, { room, state, joinedAt: this.now() });

    const out: Outbound[] = [
      {
        recipients: [peerId],
        msg: { t: 'welcome', self: peerId, peers: existing },
      },
    ];
    const others = this.others(peerId, room);
    if (others.length) {
      out.push({ recipients: others, msg: { t: 'peer-join', peer: state } });
    }
    return out;
  }

  private transport(peerId: string, tick: TransportTick): Outbound[] {
    const member = this.members.get(peerId);
    if (!member || !member.state.isHost) return []; // only the host drives BPM
    const others = this.others(peerId, member.room);
    if (others.length === 0) return [];
    return [
      {
        recipients: others,
        msg: {
          t: 'transport',
          host: peerId,
          serverTs: this.now(),
          bpm: tick.bpm,
          bar: tick.bar,
          beat: tick.beat,
          running: tick.running,
        },
      },
    ];
  }

  private device(peerId: string, snapshot: DeviceSnapshot): Outbound[] {
    const member = this.members.get(peerId);
    if (!member) return [];
    member.state.device = snapshot;
    const others = this.others(peerId, member.room);
    if (others.length === 0) return [];
    return [
      { recipients: others, msg: { t: 'device', peer: peerId, snapshot } },
    ];
  }

  private cue(peerId: string, cue: Cue): Outbound[] {
    const member = this.members.get(peerId);
    if (!member) return [];
    const others = this.others(peerId, member.room);
    if (others.length === 0) return [];
    return [{ recipients: others, msg: { t: 'cue', peer: peerId, cue } }];
  }

  private roomPeerStates(room: string): PeerState[] {
    return [...this.members.values()]
      .filter((m) => m.room === room)
      .map((m) => m.state);
  }

  private roomPeerIds(room: string): string[] {
    return [...this.members.entries()]
      .filter(([, m]) => m.room === room)
      .map(([id]) => id);
  }

  private others(peerId: string, room: string): string[] {
    return this.roomPeerIds(room).filter((id) => id !== peerId);
  }

  private oldestMember(room: string): Member | null {
    return (
      [...this.members.values()]
        .filter((m) => m.room === room)
        .sort((a, b) => a.joinedAt - b.joinedAt)[0] ?? null
    );
  }
}
