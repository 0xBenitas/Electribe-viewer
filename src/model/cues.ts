// Non-verbal cues — the project's differentiator (JAMBOREE §5).
//
// A cue fired during bar N lands at bar N+1 on the SHARED (host) timeline, so
// everyone reveals it at the same musical downbeat despite network latency: the
// one-bar offset is the signalling medium, not a bug to fight.

import type { Cue } from '../core/session/protocol.ts';

export type CueKind = Cue['kind'];

export interface ReceivedCue {
  cue: Cue;
  /** Sender peer id, or 'local' for our own optimistic copy. */
  peer: string;
}

export type CueStatus = 'pending' | 'active' | 'expired';

/** Fixed kinds offered in the deck (custom is reserved for future free text). */
export const CUE_ORDER: Exclude<CueKind, 'custom'>[] = [
  'break',
  'up',
  'down',
  'drop',
  'cut',
];

export const CUE_LABELS: Record<CueKind, string> = {
  break: 'Break',
  up: 'Monte',
  down: 'Baisse',
  drop: 'Drop',
  cut: 'Coupe',
  custom: 'Cue',
};

/** Where a cue sits relative to the shared bar it targets. */
export function cueStatus(cue: Cue, currentBar: number): CueStatus {
  if (currentBar < cue.landAtBar) return 'pending';
  if (currentBar === cue.landAtBar) return 'active';
  return 'expired';
}

export interface BuildCueOptions {
  id?: string;
  now?: number;
  label?: string;
}

/** UUID where available (secure context), else a good-enough random id. */
function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildCue(
  kind: CueKind,
  landAtBar: number,
  opts: BuildCueOptions = {},
): Cue {
  return {
    id: opts.id ?? randomId(),
    kind,
    label: opts.label,
    landAtBar,
    createdAt: opts.now ?? Date.now(),
  };
}

/** Beats per bar assumed for cue timing — matches MidiClock's 4/4 default. */
export const CUE_BEATS_PER_BAR = 4;

export interface CueLandInput {
  /** Current shared bar (1-based, host timeline). */
  bar: number;
  /** Current beat within the bar (1-based). */
  beat: number;
  bpm: number | null;
  /** 'local' = our own clock (host/solo) ; 'remote' = host's relayed transport. */
  source: 'local' | 'remote';
  /** Wall-clock now (ms). */
  now: number;
  /** When the relayed transport tick was received (ms) ; ignored when local. */
  transportAt?: number | null;
  /** Round-trip latency to the server (ms) ; ignored when local. */
  latencyMs?: number | null;
  beatsPerBar?: number;
}

/**
 * Absolute bar (host timeline) at which a cue fired *now* should land.
 *
 * Host / solo (`source === 'local'`): the deliberate one-bar NINJAM offset (§5)
 * → `bar + 1`. The host owns the live clock, there is no relay lag to absorb.
 *
 * Remote peer: the relay path has TWO hops each way (peer↔server and host↔server).
 * The tick reached us host→server→peer, and our cue travels back peer→server→host,
 * so by the time it lands on the host's timeline the host has advanced by
 * `(now − transportAt) + peerRTT + hostRTT`. We only measure `latencyMs` (the
 * peer↔server RTT) via ping/pong, so we budget the host segment as roughly equal
 * (`+ latencyMs` again). If that advance crosses a bar boundary, a plain `+1`
 * would land on a bar the host has already entered (the ±1-bar artefact); we add
 * the *whole bars* the host will have advanced, so a cue tapped late in the bar
 * lands `+2` (or more under heavy lag) instead of a bar too early. The signal
 * stays coarse-grained on purpose; erring late is always safe.
 */
export function cueLandBar(input: CueLandInput): number {
  const { bar, beat, bpm, source, now } = input;
  if (source === 'local' || bpm == null || bpm <= 0) return bar + 1;
  const beatsPerBar = input.beatsPerBar ?? CUE_BEATS_PER_BAR;
  const msPerBar = (60_000 / bpm) * beatsPerBar;
  const stale = input.transportAt != null ? Math.max(0, now - input.transportAt) : 0;
  const rtt = input.latencyMs != null ? Math.max(0, input.latencyMs) : 0;
  // Budget both relay legs: measured peer↔server RTT + an equal host↔server guess.
  const advanceBars = (stale + 2 * rtt) / msPerBar;
  const fracIntoBar = (beat - 1) / beatsPerBar + advanceBars;
  return bar + 1 + Math.floor(fracIntoBar);
}
