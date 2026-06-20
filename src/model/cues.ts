// Non-verbal cues — the project's differentiator (ENSEMBLE §5).
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
