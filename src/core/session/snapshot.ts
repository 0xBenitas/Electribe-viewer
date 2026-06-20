// DeviceSnapshot — the replicated, network-friendly view of one machine.
//
// This is THE merge seam. Locally a machine is driven by Web MIDI and shown by
// the editor (the EMX.PILOT panel). In a session, each peer serialises their
// machine into a DeviceSnapshot and broadcasts it; a remote peer's machine is
// just a snapshot fed into the SAME UI components. Replication is read-only in
// v1 (you see your friends' machines; you only drive your own).

export interface PartSnapshot {
  /** 1-based part/track index. */
  index: number;
  /** Display name (custom name, else oscillator/sample name). */
  name?: string;
  /** Resolved oscillator/sample name, if known. */
  oscName?: string;
  /** Raw oscillator/sample value (reference). */
  oscRaw?: number;
  muted?: boolean;
  /** Palette colour for the tile. */
  color?: string;
  /** ccParam name -> current value (app-space, decoded). */
  params: Record<string, number>;
}

export interface DeviceSnapshot {
  /** Profile id this machine resolved to ("korg-electribe-2"), or null if unknown. */
  profileId: string | null;
  /** Display model string. */
  model: string;
  firmware?: string;
  /** Currently edited part (1-based), or null if undetermined. */
  activePart: number | null;
  parts: PartSnapshot[];
  /** Pattern-level params not tied to a part (e.g. Master FX XY). */
  patternParams?: Record<string, number>;
  /** Sender clock, ms epoch — used to drop stale frames. */
  updatedAt: number;
}

/** Drop frames that arrive out of order (UDP-like reordering over fan-out). */
export function isNewerSnapshot(
  incoming: DeviceSnapshot,
  current: DeviceSnapshot | undefined,
): boolean {
  return !current || incoming.updatedAt > current.updatedAt;
}
