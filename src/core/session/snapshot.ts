// DeviceSnapshot — the replicated, network-friendly view of one machine.
//
// This is THE merge seam. Locally a machine is driven by Web MIDI and shown by
// the editor (the EMX.PILOT panel). In a session, each peer serialises their
// machine into a DeviceSnapshot and broadcasts it; a remote peer's machine is
// just a snapshot fed into the SAME UI components. Replication is read-only in
// v1 (you see your friends' machines; you only drive your own).
//
// It carries device FACTS only — no local UI state (selection, custom names,
// colours). Those are re-derived on the receiving side.

export interface PartSnapshot {
  /** 1-based part/track index. */
  index: number;
  muted: boolean;
  /** Raw oscillator/sample value, or null if unknown. */
  oscType: number | null;
  /** Descriptive "sound" fields for the detail view (null if unknown). */
  voiceAssign: number | null;
  filterType: number | null;
  ifxType: number | null;
  lastStep: number | null;
  /** CC-mirrored realtime params (app-space, decoded), keyed by ccParam name. */
  params: Record<string, number>;
}

export interface PatternInfoSnapshot {
  name: string;
  tempo: number;
  beat: number;
  length: number;
  key: number;
}

export interface DeviceSnapshot {
  /** Profile id this machine resolved to ("korg-electribe-2"), or null. */
  profileId: string | null;
  /** Display model string. */
  model: string;
  firmware?: string;
  /** Currently edited part (1-based), or null if undetermined. */
  activePart: number | null;
  parts: PartSnapshot[];
  pattern: PatternInfoSnapshot | null;
  /** Sender clock, ms epoch — used to drop stale frames. */
  updatedAt: number;
}

/**
 * Accept a snapshot unless it is strictly older than the one we hold. Delivery
 * over a single WebSocket is TCP-ordered, so this mainly guards against replays;
 * `>=` keeps a same-millisecond follow-up frame (two states emitted within one
 * ms) instead of dropping it.
 */
export function isNewerSnapshot(
  incoming: DeviceSnapshot,
  current: DeviceSnapshot | undefined,
): boolean {
  return !current || incoming.updatedAt >= current.updatedAt;
}
