// Session relay — pure room/fan-out logic, no I/O.
//
// The server is a thin fan-out relay (JAMBOREE §6): presence, the host's shared
// transport, device-state replication, bar-aligned cues, and (ADR-007) the
// audio grid + the recipients of the binary audio frames. Keeping the logic pure
// makes it fully unit-testable; the `ws` adapter (index.ts) only maps sockets
// to peer ids and ships the bytes.

import type {
  ClientMessage,
  Cue,
  LobbyInfo,
  PeerInfo,
  PeerState,
  ServerMessage,
  TransportTick,
} from '../src/core/session/protocol.ts';
import type { DeviceSnapshot } from '../src/core/session/snapshot.ts';
import { clampGrid, type AudioGrid } from '../src/core/audio/grid.ts';

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
  /** Audio grid per room (ADR-007). Created on first join, kept while the room lives. */
  private readonly grids = new Map<string, AudioGrid>();

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
      case 'lobbies':
        // Discovery: answer the asker only. The asker never joins a room, so it
        // stays out of `members` and alters nothing (like `ping`).
        return [
          { recipients: [peerId], msg: { t: 'lobbies', rooms: this.buildLobbies() } },
        ];
      case 'grid':
        return this.setGrid(peerId, msg.bpm, msg.bpi);
    }
  }

  /**
   * Binary audio frame from `peerId` (ADR-007): everyone else in its room gets
   * it — players AND listeners. Empty if the sender is in no room.
   */
  audioRecipients(peerId: string): string[] {
    const member = this.members.get(peerId);
    return member ? this.others(peerId, member.room) : [];
  }

  /** Current grid of a room, or null if the room has no member. */
  gridOf(room: string): AudioGrid | null {
    return this.grids.get(room) ?? null;
  }

  disconnect(peerId: string): Outbound[] {
    const member = this.members.get(peerId);
    if (!member) return [];
    this.members.delete(peerId);

    const others = this.roomPeerIds(member.room);
    if (others.length === 0) {
      this.grids.delete(member.room); // last one out: the grid dies with the room
      return [];
    }

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
    this.members.delete(peerId); // tolerate a same-id re-join
    const out: Outbound[] = [];
    // Fast reconnect: a stale ghost of the SAME client may still sit in the room
    // (its socket's close not yet noticed). Evict it so we don't duplicate
    // ourselves, nor strand the host role on a dead peer. Tell the others to drop
    // it; the rejoining peer learns the clean set from its own `welcome` below.
    if (info.clientId) {
      for (const [id, m] of [...this.members]) {
        if (m.room === room && m.state.info.clientId === info.clientId) {
          this.members.delete(id);
          out.push({ recipients: this.roomPeerIds(room), msg: { t: 'peer-leave', peer: id } });
        }
      }
    }
    const existing = this.roomPeerStates(room);
    // A listener (no machine) is never host; the first real player is.
    const isHost = !info.listener && !existing.some((p) => p.isHost);
    const state: PeerState = { id: peerId, info, isHost };
    this.members.set(peerId, { room, state, joinedAt: this.now() });
    let grid = this.grids.get(room);
    if (!grid) {
      grid = { id: 1, bpm: 120, bpi: 16, anchor: this.now() };
      this.grids.set(room, grid);
    }

    out.push({
      recipients: [peerId],
      msg: { t: 'welcome', self: peerId, peers: existing, grid },
    });
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

  /** Host only. Re-anchored NOW: a brief glitch on tempo change beats drift. */
  private setGrid(peerId: string, bpm: number, bpi: number): Outbound[] {
    const member = this.members.get(peerId);
    if (!member || !member.state.isHost) return [];
    const prev = this.grids.get(member.room);
    const c = clampGrid(bpm, bpi);
    const grid: AudioGrid = { id: ((prev?.id ?? 0) % 255) + 1, ...c, anchor: this.now() };
    this.grids.set(member.room, grid);
    return [{ recipients: this.roomPeerIds(member.room), msg: { t: 'grid', grid } }];
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

  /** Live sessions for the lobby browser, derived from the members map. */
  private buildLobbies(): LobbyInfo[] {
    const byRoom = new Map<string, Member[]>();
    for (const m of this.members.values()) {
      const list = byRoom.get(m.room);
      if (list) list.push(m);
      else byRoom.set(m.room, [m]);
    }
    return [...byRoom.entries()]
      .map(([room, members]) => {
        const host = members.find((m) => m.state.isHost);
        return {
          room,
          count: members.length,
          players: members.filter((m) => !m.state.info.listener).length,
          host: host?.state.info.name,
          hasHostWithMachine: host?.state.device != null,
        };
      })
      .sort((a, b) => b.count - a.count || a.room.localeCompare(b.room));
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

  /** Earliest-joined non-listener — the candidate for host promotion. */
  private oldestMember(room: string): Member | null {
    return (
      [...this.members.values()]
        .filter((m) => m.room === room && !m.state.info.listener)
        .sort((a, b) => a.joinedAt - b.joinedAt)[0] ?? null
    );
  }
}
