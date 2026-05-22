// Central wiring between the MIDIClient and the Zustand stores.
// Owns the single MIDIClient + outbound throttler.

import { MIDIClient, type MidiMessage } from './client.ts';
import { CCThrottler } from './throttle.ts';
import { CC_MAP, decodeCC, encodeCC, paramForCC, type CCParam } from './ccMap.ts';
import { getSysExFunction } from './sysex/envelope.ts';
import { SYSEX_FN } from './sysex/functions.ts';
import {
  buildGlobalDumpRequest,
  decodeGlobalDump,
  parseGlobalDump,
} from './sysex/globalDump.ts';
import type { ConnectionState } from './types.ts';
import { useConnectionStore } from '../store/connection.ts';
import { usePartsStore } from '../store/parts.ts';
import { useParamsStore } from '../store/params.ts';
import { useGlobalsStore } from '../store/globals.ts';

let client: MIDIClient | null = null;
const throttler = new CCThrottler((msg) => client?.send(msg));

function onState(state: ConnectionState): void {
  useConnectionStore.setState({ state });
  if (state.status === 'connected') {
    throttler.start();
    // Knob Mode awareness (spec §6.9): fetch globals once connected.
    client?.send(buildGlobalDumpRequest(state.identity.globalChannel));
  }
}

function onMessage({ channel, data }: MidiMessage): void {
  if (data[0] === 0xf0) {
    if (getSysExFunction(data) === SYSEX_FN.GLOBAL_DUMP) {
      try {
        const globals = parseGlobalDump(decodeGlobalDump(data));
        useGlobalsStore.getState().setKnobMode(globals.knobMode);
      } catch {
        // ignore malformed dumps
      }
    }
    return;
  }

  if ((data[0]! & 0xf0) === 0xb0) {
    const param = paramForCC(data[1]!);
    if (!param) return; // ignore Bank Select / unmapped CC (Phase 0 finding)
    // ADR-001: the channel of an incoming mapped CC is the active edit part.
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

/** Send a mapped CC to the active part's channel (ADR-001). */
export function sendParam(param: CCParam, value: number): void {
  const parts = usePartsStore.getState();
  const partId = parts.activePartId ?? parts.selectedPartId;
  const spec = CC_MAP[param];
  useParamsStore.getState().setLocal(partId, param, value);
  throttler.enqueue(partId - 1, spec.cc, encodeCC(spec, value));
}
