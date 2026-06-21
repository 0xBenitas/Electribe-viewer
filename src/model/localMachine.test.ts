import { describe, it, expect } from 'vitest';
import { buildLocalMachine, type LocalMachineInput } from './localMachine.ts';
import { partColor } from '../lib/colors.ts';
import type { ParsedPart, ParsedPattern } from '../midi/sysex/parser.ts';

function fakePart(over: Partial<ParsedPart> = {}): ParsedPart {
  return {
    lastStep: 16,
    mute: false,
    voiceAssign: 0,
    motionSeqMode: 0,
    trgPadVelocity: false,
    scaleMode: false,
    partPriority: 0,
    oscType: 0,
    oscEdit: 0,
    filterType: 0,
    filterCutoff: 0,
    filterReso: 0,
    filterEgInt: 0,
    modType: 0,
    modSpeed: 0,
    modDepth: 0,
    egAttack: 0,
    egDecay: 0,
    ampLevel: 0,
    ampPan: 0,
    egOn: false,
    mfxSend: false,
    grooveType: 0,
    grooveDepth: 0,
    ifxOn: false,
    ifxType: 0,
    ifxEdit: 0,
    oscPitch: 0,
    oscGlide: 0,
    steps: [],
    ...over,
  };
}

function baseInput(over: Partial<LocalMachineInput> = {}): LocalMachineInput {
  return {
    connectionStatus: 'connected',
    profileId: 'korg-electribe-2',
    knobMode: null,
    partsMeta: Array.from({ length: 16 }, (_, i) => ({ id: i + 1 })),
    pattern: null,
    paramsByPart: {},
    activePartId: null,
    selectedPartId: 1,
    ...over,
  };
}

describe('buildLocalMachine', () => {
  it('produces 16 editable parts with palette colours', () => {
    const m = buildLocalMachine(baseInput());
    expect(m.editable).toBe(true);
    expect(m.parts).toHaveLength(16);
    expect(m.parts[0]!.color).toBe(partColor(1));
    expect(m.model).toBe('Electribe 2 (EMX, synth)');
  });

  it('flags richEditor only for profiles that expose it', () => {
    expect(buildLocalMachine(baseInput()).richEditor).toBe(true);
    expect(
      buildLocalMachine(baseInput({ profileId: 'elektron-model-samples' }))
        .richEditor,
    ).toBe(false);
    expect(buildLocalMachine(baseInput({ profileId: null })).richEditor).toBe(
      false,
    );
  });

  it('reports online only when connected', () => {
    expect(buildLocalMachine(baseInput({ connectionStatus: 'scanning' })).online).toBe(false);
    expect(buildLocalMachine(baseInput({ connectionStatus: 'connected' })).online).toBe(true);
  });

  it('flattens parsed part fields into the read-model', () => {
    const pattern = {
      name: 'JAM',
      tempo: 128,
      swing: 0,
      length: 1,
      beat: 0,
      key: 0,
      scale: 0,
      parts: [fakePart({ oscType: 42, mute: true, filterType: 3, lastStep: 12 })],
    } as unknown as ParsedPattern;
    const m = buildLocalMachine(baseInput({ pattern }));
    expect(m.parts[0]).toMatchObject({
      oscType: 42,
      muted: true,
      filterType: 3,
      lastStep: 12,
    });
    expect(m.pattern).toMatchObject({ name: 'JAM', tempo: 128 });
  });

  it('honours custom name/colour and per-part params', () => {
    const m = buildLocalMachine(
      baseInput({
        partsMeta: [{ id: 1, customName: 'Kick', customColor: '#fff' }],
        paramsByPart: { 1: { filterCutoff: 90 } },
      }),
    );
    expect(m.parts[0]).toMatchObject({
      customName: 'Kick',
      color: '#fff',
      params: { filterCutoff: 90 },
    });
  });
});
