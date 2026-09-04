// Central wiring between the MIDIClient and the Zustand stores.
// Owns the single MIDIClient + outbound throttler.

import { MIDIClient, type MidiMessage } from './client.ts';
import { CCThrottler } from './throttle.ts';
import { MidiClock } from '../core/clock/midiClock.ts';
import type { ClockSnapshot } from '../core/clock/types.ts';
import { getProfile, supportsRichEditor } from '../core/profiles/registry.ts';
import {
  CC_MAP,
  PATTERN_LEVEL_PARAMS,
  decodeCC,
  encodeCC,
  paramForCC,
  type CCParam,
} from './ccMap.ts';
import { getSysExFunction } from './sysex/envelope.ts';
import { SYSEX_FN } from './sysex/functions.ts';
import {
  buildGlobalDumpRequest,
  decodeGlobalDump,
  parseGlobalDump,
} from './sysex/globalDump.ts';
import {
  buildCurrentPatternDumpRequest,
  decodeCurrentPatternDump,
  parsePatternDump,
} from './sysex/parser.ts';
import { buildCurrentPatternDump, patchPartSound } from './sysex/write.ts';
import { patternToParams } from './hydrate.ts';
import { DumpAwaiter } from './dumpAwaiter.ts';
import { saveDump } from './dumpVault.ts';
import type { ConnectionState } from './types.ts';
import type { PartSound } from '../db/types.ts';
import { useConnectionStore } from '../store/connection.ts';
import { usePartsStore } from '../store/parts.ts';
import { useParamsStore } from '../store/params.ts';
import { useGlobalsStore } from '../store/globals.ts';
import { useCurrentPatternStore } from '../store/currentPattern.ts';
import { useSysexStore } from '../store/sysex.ts';

let client: MIDIClient | null = null;
const throttler = new CCThrottler((msg) => client?.send(msg));

/** Attente du prochain Current Pattern Dump (0x40) après une demande 0x10. */
const dumpAwaiter = new DumpAwaiter();
const DUMP_REPLY_TIMEOUT_MS = 2500;
/** Debounce de la re-demande sur Program Change (la machine émet Bank Select + PC). */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Profile of the connected machine; gates Electribe-specific SysEx/CC handling. */
let activeProfileId: string | null = null;

/** Live MIDI clock, fed from realtime messages (Phase 1c). */
const clock = new MidiClock();

/** Current shared-tempo snapshot (BPM + bar position). */
export function clockSnapshot(now?: number): ClockSnapshot {
  return clock.snapshot(now);
}

/** MIDI realtime + Song Position statuses routed to the clock. */
const CLOCK_STATUS = new Set([0xf8, 0xfa, 0xfb, 0xfc, 0xf2]);

function onState(state: ConnectionState): void {
  useConnectionStore.setState({ state });
  if (state.status === 'connected') {
    activeProfileId = state.profileId;
    throttler.start();
    const profile = state.profileId ? getProfile(state.profileId) : null;
    // Electribe only: request Knob Mode (spec §6.9) + hydrate the 16 parts
    // (spec §1.2). Needs the global channel from the Korg Identity Reply.
    if (profile?.telemetry.reportsPatternDump && state.identity) {
      const gc = state.identity.globalChannel;
      client?.send(buildGlobalDumpRequest(gc));
      client?.send(buildCurrentPatternDumpRequest(gc));
    }
  } else {
    activeProfileId = null;
    throttler.reset();
    clock.reset();
  }
}

function onMessage({ channel, data, timeStamp }: MidiMessage): void {
  if (CLOCK_STATUS.has(data[0]!)) {
    clock.feed(data, timeStamp);
    return;
  }
  // Beyond the clock, the SysEx/CC handling below is Electribe-specific
  // (pattern hydration + ADR-001 active-part CC mirror). Other machines still
  // get tempo, presence, cues and audio — just not the rich editor.
  if (!supportsRichEditor(activeProfileId)) return;

  if (data[0] === 0xf0) {
    const fn = getSysExFunction(data);
    if (fn === SYSEX_FN.GLOBAL_DUMP) {
      try {
        const globals = parseGlobalDump(decodeGlobalDump(data));
        useGlobalsStore.getState().setKnobMode(globals.knobMode);
      } catch {
        // ignore malformed dumps
      }
    } else if (fn === SYSEX_FN.CURRENT_PATTERN_DUMP) {
      try {
        const raw = decodeCurrentPatternDump(data);
        const pattern = parsePatternDump(raw);
        useCurrentPatternStore.getState().setPattern(pattern, raw);
        useParamsStore.getState().hydrate(patternToParams(pattern));
        dumpAwaiter.deliver(raw);
        // Coffre (ADR-006) : chaque dump reçu est gardé, best-effort.
        void saveDump({
          receivedAt: Date.now(),
          name: pattern.name,
          tempo: pattern.tempo,
          raw,
        }).catch(() => {});
      } catch {
        // ignore malformed dumps
      }
    } else if (fn === SYSEX_FN.DATA_LOAD_COMPLETED) {
      useSysexStore.getState().pushEvent('load-ok');
    } else if (fn === SYSEX_FN.DATA_LOAD_ERROR) {
      useSysexStore.getState().pushEvent('load-error');
    } else if (fn === SYSEX_FN.WRITE_COMPLETED) {
      useSysexStore.getState().pushEvent('write-ok');
    } else if (fn === SYSEX_FN.WRITE_ERROR) {
      useSysexStore.getState().pushEvent('write-error');
    } else if (fn === SYSEX_FN.DATA_FORMAT_ERROR) {
      useSysexStore.getState().pushEvent('format-error');
    }
    return;
  }

  // Pattern changé sur la machine (Program Change) : le dump en mémoire est
  // périmé → on le redemande (ADR-006).
  if ((data[0]! & 0xf0) === 0xc0) {
    schedulePatternRefresh();
    return;
  }

  if ((data[0]! & 0xf0) === 0xb0) {
    const param = paramForCC(data[1]!);
    if (!param) return; // ignore Bank Select / unmapped CC (Phase 0 finding)
    // Pattern-level CCs come on the global channel: never treat them as a part
    // signal (would corrupt active-part detection + per-part store).
    if (PATTERN_LEVEL_PARAMS.has(param)) return;
    // ADR-001: the channel of an incoming part-level CC is the active edit part.
    usePartsStore.getState().setActivePart(channel);
    useParamsStore
      .getState()
      .applyIncoming(channel, param, decodeCC(CC_MAP[param], data[2]!));
  }
}

export function connectMidi(): Promise<void> {
  if (!client) client = new MIDIClient({ onState, onMessage });
  return client.connect();
}

export function selectMidiPort(key: string): Promise<void> {
  return client?.selectByKey(key) ?? Promise.resolve();
}

/** Names of MIDI ports currently visible (for the guided device setup). */
export function connectedPortNames(): string[] {
  return client?.getPairNames() ?? [];
}

/** Send a mapped CC to the active part's channel (ADR-001). */
export function sendParam(param: CCParam, value: number): void {
  const parts = usePartsStore.getState();
  const partId = parts.activePartId ?? parts.selectedPartId;
  const spec = CC_MAP[param];
  useParamsStore.getState().setLocal(partId, param, value);
  throttler.enqueue(partId - 1, spec.cc, encodeCC(spec, value));
}

function connectedChannel(): number | null {
  const st = useConnectionStore.getState().state;
  return st.status === 'connected' && st.identity
    ? st.identity.globalChannel
    : null;
}

function schedulePatternRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void requestCurrentPattern();
  }, 200);
}

/**
 * Redemande le pattern courant à la machine (0x10) et attend le dump (0x40).
 * Résout le dump frais (aussi poussé dans le store + le coffre), ou `null` si
 * la machine n'a pas répondu / n'est pas connectée.
 */
export function requestCurrentPattern(): Promise<Uint8Array | null> {
  const gc = connectedChannel();
  if (gc === null || !client) return Promise.resolve(null);
  const wait = dumpAwaiter.wait(DUMP_REPLY_TIMEOUT_MS);
  if (!dumpAwaiter.pending) return wait; // (jamais : wait() vient d'armer)
  client.send(buildCurrentPatternDumpRequest(gc));
  return wait;
}

export type ResendResult = 'sent' | 'offline' | 'no-reply';

/**
 * Phase 5b — envoie un dump complet dans l'edit buffer de la machine (Current
 * Pattern Dump 0x40, volatile : le slot n'est écrit que par un Write). ADR-006 :
 * on redemande TOUJOURS le pattern juste avant, on ne renvoie jamais un dump
 * périmé ; `mutate` (optionnel) transforme le dump FRAIS avant envoi. La machine
 * répond DATA_LOAD_COMPLETED (0x23) → useSysexStore.
 */
export async function resendCurrentPattern(
  mutate?: (fresh: Uint8Array) => Uint8Array,
): Promise<ResendResult> {
  const gc = connectedChannel();
  if (gc === null || !client) return 'offline';
  const sysex = useSysexStore.getState();
  sysex.pushEvent('refresh');
  const fresh = await requestCurrentPattern();
  if (!fresh) {
    sysex.pushEvent('refresh-error');
    return 'no-reply';
  }
  const name = useCurrentPatternStore.getState().pattern?.name ?? '';
  client.send(buildCurrentPatternDump(gc, mutate ? mutate(fresh) : fresh));
  sysex.pushEvent('sent', name ? `pattern « ${name} »` : undefined);
  return 'sent';
}

/**
 * Recall des params SysEx-only d'un son sur un part via edit buffer : patche le
 * dump FRAIS (redemandé à la machine) et le renvoie.
 */
export function recallSoundEditBuffer(
  partIndex: number,
  sound: PartSound,
): Promise<ResendResult> {
  return resendCurrentPattern((fresh) => patchPartSound(fresh, partIndex, sound));
}
