import { describe, it, expect } from 'vitest';
import { machineToSnapshot, snapshotToMachine } from './adapters.ts';
import { buildLocalMachine, type LocalMachineInput } from './localMachine.ts';
import { partColor } from '../lib/colors.ts';

function input(over: Partial<LocalMachineInput> = {}): LocalMachineInput {
  return {
    connectionStatus: 'connected',
    profileId: 'korg-electribe-2',
    knobMode: 1,
    partsMeta: [
      { id: 1, customName: 'Kick', customColor: '#abc' },
      { id: 2 },
    ],
    pattern: null,
    paramsByPart: { 1: { filterCutoff: 100 }, 2: { ampLevel: 64 } },
    activePartId: 2,
    selectedPartId: 1,
    ...over,
  };
}

describe('machine ⇄ snapshot adapters', () => {
  it('round-trips device facts local → snapshot → remote machine', () => {
    const local = buildLocalMachine(input());
    const snap = machineToSnapshot(local, 1000);
    const remote = snapshotToMachine(snap, { id: 'p1', info: { name: 'Bastou' } });

    // Device facts survive the round-trip.
    expect(remote.model).toBe(local.model);
    expect(remote.profileId).toBe(local.profileId);
    expect(remote.activePartId).toBe(local.activePartId);
    expect(remote.parts.map((p) => p.oscType)).toEqual(
      local.parts.map((p) => p.oscType),
    );
    expect(remote.parts[0]!.params).toEqual(local.parts[0]!.params);
  });

  it('strips local UI state and forces read-only on receive', () => {
    const local = buildLocalMachine(input());
    const snap = machineToSnapshot(local, 1000);
    const remote = snapshotToMachine(snap, { id: 'p1', info: { name: 'Bastou' } });

    expect(remote.editable).toBe(false);
    expect(remote.knobMode).toBeNull(); // local hardware concern, not replicated
    expect(remote.label).toBe('Bastou'); // owner, not "Ma machine"
    expect(remote.id).toBe('p1');
    // Custom name/colour are not broadcast: remote falls back to palette.
    expect(remote.parts[0]!.customName).toBeNull();
    expect(remote.parts[0]!.color).toBe(partColor(1));
  });

  it('defaults remote selection to the active part', () => {
    const local = buildLocalMachine(input({ activePartId: 2 }));
    const remote = snapshotToMachine(machineToSnapshot(local, 1), {
      id: 'p1',
      info: { name: 'X' },
    });
    expect(remote.selectedPartId).toBe(2);
  });

  it('carries the timestamp for staleness checks', () => {
    const snap = machineToSnapshot(buildLocalMachine(input()), 4242);
    expect(snap.updatedAt).toBe(4242);
  });
});
