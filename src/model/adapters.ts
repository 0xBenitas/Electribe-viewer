// Adapters between the Machine read-model and the network DeviceSnapshot.
//
//   local stores ──buildLocalMachine──► Machine ──machineToSnapshot──► wire
//   wire ──snapshotToMachine──► Machine (read-only) ──► same UI components
//
// Machine is the hub; the snapshot carries device facts only. UI-only fields
// (selection, label, custom colours) are re-derived on receive.

import { partColor } from '../lib/colors.ts';
import type { DeviceSnapshot } from '../core/session/snapshot.ts';
import type { PeerInfo } from '../core/session/protocol.ts';
import type { Machine, MachinePart, ParamValues } from './machine.ts';

/** Project the local machine into a broadcastable snapshot. */
export function machineToSnapshot(
  machine: Machine,
  updatedAt: number,
): DeviceSnapshot {
  return {
    profileId: machine.profileId,
    model: machine.model,
    activePart: machine.activePartId,
    parts: machine.parts.map((p) => ({
      index: p.id,
      muted: p.muted,
      oscType: p.oscType,
      voiceAssign: p.voiceAssign,
      filterType: p.filterType,
      ifxType: p.ifxType,
      lastStep: p.lastStep,
      params: { ...p.params } as Record<string, number>,
    })),
    pattern: machine.pattern ? { ...machine.pattern } : null,
    updatedAt,
  };
}

/** Build a read-only Machine from a peer's snapshot. */
export function snapshotToMachine(
  snapshot: DeviceSnapshot,
  peer: { id: string; info: PeerInfo },
): Machine {
  const parts: MachinePart[] = snapshot.parts.map((p) => ({
    id: p.index,
    customName: null,
    color: partColor(p.index),
    oscType: p.oscType,
    muted: p.muted,
    voiceAssign: p.voiceAssign,
    filterType: p.filterType,
    ifxType: p.ifxType,
    lastStep: p.lastStep,
    // Copy: the read-model must not alias the session store's snapshot object.
    params: { ...p.params } as ParamValues,
  }));

  return {
    id: peer.id,
    label: peer.info.name,
    model: snapshot.model,
    profileId: snapshot.profileId,
    editable: false,
    online: true,
    knobMode: null,
    activePartId: snapshot.activePart,
    selectedPartId: snapshot.activePart ?? 1,
    parts,
    pattern: snapshot.pattern ? { ...snapshot.pattern } : null,
  };
}
