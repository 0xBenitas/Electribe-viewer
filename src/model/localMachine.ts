// Build a Machine read-model from the local Web MIDI stores.
//
// `buildLocalMachine` is pure (takes plain inputs) so it can be unit-tested
// without React or stores. `useLocalMachine` is the thin hook that wires it to
// the live stores — the wrapper that lets components migrate to the read-model
// while MIDI keeps flowing exactly as before.

import type { ConnectionState } from '../midi/types.ts';
import type { ParsedPattern } from '../midi/sysex/parser.ts';
import type { PartMeta } from '../store/parts.ts';
import { partColor } from '../lib/colors.ts';
import { getProfile } from '../core/profiles/registry.ts';
import { sendParam } from '../midi/bridge.ts';
import type { Machine, MachineActions, MachinePart, ParamValues } from './machine.ts';

import { useConnectionStore } from '../store/connection.ts';
import { usePartsStore } from '../store/parts.ts';
import { useParamsStore } from '../store/params.ts';
import { useCurrentPatternStore } from '../store/currentPattern.ts';
import { useGlobalsStore } from '../store/globals.ts';

export interface LocalMachineInput {
  connectionStatus: ConnectionState['status'];
  profileId: string | null;
  knobMode: number | null;
  partsMeta: readonly PartMeta[];
  pattern: ParsedPattern | null;
  paramsByPart: Record<number, ParamValues>;
  activePartId: number | null;
  selectedPartId: number;
  label?: string;
}

export function buildLocalMachine(input: LocalMachineInput): Machine {
  const parts: MachinePart[] = input.partsMeta.map((meta) => {
    const parsed = input.pattern?.parts[meta.id - 1] ?? null;
    return {
      id: meta.id,
      customName: meta.customName ?? null,
      color: meta.customColor ?? partColor(meta.id),
      oscType: parsed?.oscType ?? null,
      muted: parsed?.mute ?? false,
      voiceAssign: parsed?.voiceAssign ?? null,
      filterType: parsed?.filterType ?? null,
      ifxType: parsed?.ifxType ?? null,
      lastStep: parsed?.lastStep ?? null,
      params: input.paramsByPart[meta.id] ?? {},
    };
  });

  const profile = input.profileId ? getProfile(input.profileId) : null;

  return {
    id: 'local',
    label: input.label ?? 'Ma machine',
    model: profile?.identity.model ?? 'Machine inconnue',
    profileId: input.profileId,
    editable: true,
    online: input.connectionStatus === 'connected',
    knobMode: input.knobMode,
    activePartId: input.activePartId,
    selectedPartId: input.selectedPartId,
    parts,
    pattern: input.pattern
      ? {
          name: input.pattern.name,
          tempo: input.pattern.tempo,
          beat: input.pattern.beat,
          length: input.pattern.length,
          key: input.pattern.key,
        }
      : null,
  };
}

export function useLocalMachine(): Machine {
  const connectionStatus = useConnectionStore((s) => s.state.status);
  const partsMeta = usePartsStore((s) => s.parts);
  const activePartId = usePartsStore((s) => s.activePartId);
  const selectedPartId = usePartsStore((s) => s.selectedPartId);
  const pattern = useCurrentPatternStore((s) => s.pattern);
  const paramsByPart = useParamsStore((s) => s.byPart);
  const knobMode = useGlobalsStore((s) => s.knobMode);

  return buildLocalMachine({
    connectionStatus,
    // Single-device today; resolved from the connected identity in a later phase.
    profileId: 'korg-electribe-2',
    knobMode,
    partsMeta,
    pattern,
    paramsByPart,
    activePartId,
    selectedPartId,
  });
}

/**
 * Edit actions for the local machine. Stable module singleton (reads store state
 * lazily), wired only to the editable local panel — never to a remote peer.
 */
export const localMachineActions: MachineActions = {
  selectPart: (id) => usePartsStore.getState().selectPart(id),
  setParam: (param, value) => sendParam(param, value),
  rename: (id, name) =>
    usePartsStore.getState().setMetadata(id, { customName: name }),
};
