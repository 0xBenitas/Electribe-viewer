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
import { parseClientMessage } from '../src/core/session/validate.ts';

/** Plafonds (audit sécurité 2026-09-04) : le relais est public et sans auth. */
export const MAX_MEMBERS_PER_ROOM = 16;
export const MAX_ROOMS = 64;
/** Une trame Opus de 20 ms à 96 kb/s ≈ 240 o ; au-delà de 4 Kio ce n'est pas de l'audio. */
export const MAX_AUDIO_FRAME_BYTES = 4096;
/** Débits par membre et par seconde : ~50 trames/s légitimes, ~10 JSON/s. */
export const MAX_AUDIO_FRAMES_PER_S = 80;
export const MAX_JSON_PER_S = 40;
/** Membre muet (aucun message, même pas de ping) plus longtemps = fantôme, exclu. */
export const IDLE_TIMEOUT_MS = 30000;

export interface Outbound {
  /** Peer ids that should receive `msg`. */
  recipients: string[];
  msg: ServerMessage;
}

interface Member {
  room: string;
  state: PeerState;
  joinedAt: number;
  /** Last time this member sent a binary audio frame (ADR-007), 0 = never. */
  audioAt: number;
  /** Last message of any kind (ping included): silence too long = ghost. */
  seenAt: number;
  /** Client token for ghost eviction on fast reconnect — NEVER broadcast. */
  clientId: string | null;
  /** Rate limiting: current one-second window and counters. */
  windowAt: number;
  audioCount: number;
  jsonCount: number;
}

/** A member counts as "sending audio" this long after its last frame. */
export const AUDIO_ACTIVE_MS = 5000;

export class SessionHub {
  private readonly members = new Map<string, Member>();
  /** Audio grid per room (ADR-007). Created on first join, kept while the room lives. */
  private readonly grids = new Map<string, AudioGrid>();

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * Entry point for anything a socket sends: validated first (unknown or
   * malformed = ignored, never a crash), rate-limited, then dispatched.
   */
  handle(peerId: string, raw: unknown): Outbound[] {
    const msg = parseClientMessage(raw);
    if (!msg) return [];
    const member = this.members.get(peerId);
    if (member) {
      member.seenAt = this.now();
      if (!this.allow(member, 'json')) return [];
    }
    return this.dispatch(peerId, msg);
  }

  private dispatch(peerId: string, msg: ClientMessage): Outbound[] {
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
      default:
        return [];
    }
  }

  /** One-second window counters per member; over the cap = dropped. */
  private allow(member: Member, kind: 'json' | 'audio'): boolean {
    const now = this.now();
    if (now - member.windowAt >= 1000) {
      member.windowAt = now;
      member.audioCount = 0;
      member.jsonCount = 0;
    }
    if (kind === 'audio') return ++member.audioCount <= MAX_AUDIO_FRAMES_PER_S;
    return ++member.jsonCount <= MAX_JSON_PER_S;
  }

  /**
   * Members silent for IDLE_TIMEOUT_MS (no ping either) are ghosts: dropped with
   * the same notifications as a disconnect. Returns the ids to terminate too.
   */
  sweep(): { removed: string[]; out: Outbound[] } {
    const now = this.now();
    const removed: string[] = [];
    const out: Outbound[] = [];
    for (const [id, m] of [...this.members]) {
      if (now - m.seenAt > IDLE_TIMEOUT_MS) {
        removed.push(id);
        out.push(...this.disconnect(id));
      }
    }
    return { removed, out };
  }

  /**
   * Binary audio frame from `peerId` (ADR-007): everyone else in its room gets
   * it — players AND listeners. Empty if the sender is in no room.
   */
  audioRecipients(peerId: string, byteLength: number): string[] {
    const member = this.members.get(peerId);
    if (!member) return [];
    member.seenAt = this.now();
    // Listeners have no instrument: a listening page must never inject audio.
    if (member.state.info.listener) return [];
    if (byteLength > MAX_AUDIO_FRAME_BYTES) return [];
    if (!this.allow(member, 'audio')) return [];
    member.audioAt = this.now();
    return this.others(peerId, member.room);
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

  private join(peerId: string, room: string, rawInfo: PeerInfo): Outbound[] {
    // Re-join (same socket changing room): leave the old room properly first,
    // so the others get their peer-leave and the old grid can die.
    const out: Outbound[] = this.members.has(peerId) ? this.disconnect(peerId) : [];
    // The client token stays server-side; the broadcast info never carries it.
    const { clientId = null, ...info } = rawInfo;
    // Fast reconnect: a stale ghost of the SAME client may still sit in the room
    // (its socket's close not yet noticed). Evict it so we don't duplicate
    // ourselves, nor strand the host role on a dead peer. The evicted socket is
    // told (a hijacked victim rejoins at once); the others get a peer-leave.
    if (clientId) {
      for (const [id, m] of [...this.members]) {
        if (m.room === room && m.clientId === clientId) {
          // No host promotion here: if the ghost was host, the rejoining client
          // reclaims the role below (nobody else holds it).
          this.members.delete(id);
          out.push({ recipients: this.roomPeerIds(room), msg: { t: 'peer-leave', peer: id } });
          out.push({ recipients: [id], msg: { t: 'evicted' } });
        }
      }
    }
    const existing = this.roomPeerStates(room);
    if (existing.length >= MAX_MEMBERS_PER_ROOM) {
      out.push({ recipients: [peerId], msg: { t: 'error', code: 'room-full' } });
      return out;
    }
    if (existing.length === 0 && this.grids.size >= MAX_ROOMS) {
      out.push({ recipients: [peerId], msg: { t: 'error', code: 'too-many-rooms' } });
      return out;
    }
    // A listener (no machine) is never host; the first real player is.
    const isHost = !info.listener && !existing.some((p) => p.isHost);
    const state: PeerState = { id: peerId, info, isHost };
    const now = this.now();
    this.members.set(peerId, {
      room, state, joinedAt: now, audioAt: 0, seenAt: now, clientId,
      windowAt: now, audioCount: 0, jsonCount: 0,
    });
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
    // Same values = nothing to do: re-anchoring would cost everyone an interval.
    if (prev && prev.bpm === c.bpm && prev.bpi === c.bpi) return [];
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
        const now = this.now();
        return {
          room,
          count: members.length,
          players: members.filter((m) => !m.state.info.listener).length,
          host: host?.state.info.name,
          hasHostWithMachine: host?.state.device != null,
          audioPeers: members.filter((m) => m.audioAt > 0 && now - m.audioAt < AUDIO_ACTIVE_MS).length,
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
