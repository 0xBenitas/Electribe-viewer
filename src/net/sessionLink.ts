// Module-level handle on the active SessionClient, so UI (e.g. the cue deck) can
// send without threading the client through props. Mirrors how `bridge` owns the
// MIDIClient. Set/cleared by useSessionSync; no-ops when offline.

import type { SessionClient } from './sessionClient.ts';
import type { Cue } from '../core/session/protocol.ts';

let active: SessionClient | null = null;

export function setActiveClient(client: SessionClient | null): void {
  active = client;
}

export function sendCue(cue: Cue): void {
  active?.sendCue(cue);
}
