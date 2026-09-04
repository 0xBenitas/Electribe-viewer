import { describe, it, expect } from 'vitest';
import { parseClientMessage } from './validate.ts';

describe('parseClientMessage', () => {
  it('rejette tout ce qui n’est pas un message connu', () => {
    for (const bad of [null, 1, 'join', [], {}, { t: 'x' }, { t: 42 }, { t: 'join' }, { t: 'join', room: 'r' }]) {
      expect(parseClientMessage(bad)).toBeNull();
    }
  });

  it('accepte un join propre et le nettoie', () => {
    expect(
      parseClientMessage({ t: 'join', room: '  cave ', info: { name: ' Bastou ', listener: false, extra: 1 } }),
    ).toEqual({ t: 'join', room: 'cave', info: { name: 'Bastou', listener: false } });
  });

  it('borne les tailles et les formes', () => {
    expect(parseClientMessage({ t: 'join', room: 'x'.repeat(65), info: { name: 'a' } })).toBeNull();
    expect(parseClientMessage({ t: 'join', room: 'r', info: { name: 'a'.repeat(33) } })).toBeNull();
    expect(parseClientMessage({ t: 'join', room: 'r', info: { name: 'a', color: 'red' } })).toBeNull();
    expect(parseClientMessage({ t: 'join', room: 'r', info: { name: 'a', clientId: 'c'.repeat(65) } })).toBeNull();
    expect(parseClientMessage({ t: 'join', room: 12, info: { name: 'a' } })).toBeNull();
  });

  it('valide transport, ping, grid', () => {
    expect(parseClientMessage({ t: 'transport', bpm: 128, bar: 3, beat: 1, running: true })).toEqual({
      t: 'transport', bpm: 128, bar: 3, beat: 1, running: true,
    });
    expect(parseClientMessage({ t: 'transport', bpm: Infinity, bar: 3, beat: 1, running: true })).toBeNull();
    expect(parseClientMessage({ t: 'ping', ts: 'now' })).toBeNull();
    expect(parseClientMessage({ t: 'ping', ts: 12.5 })).toEqual({ t: 'ping', ts: 12.5 });
    expect(parseClientMessage({ t: 'grid', bpm: 120, bpi: 16 })).toEqual({ t: 'grid', bpm: 120, bpi: 16 });
    expect(parseClientMessage({ t: 'grid', bpm: NaN, bpi: 16 })).toBeNull();
  });

  it('valide device (16 parts max) et cue', () => {
    const parts = Array.from({ length: 16 }, () => ({}));
    expect(parseClientMessage({ t: 'device', snapshot: { parts, pattern: null, updatedAt: 1 } })).toMatchObject({ t: 'device' });
    expect(parseClientMessage({ t: 'device', snapshot: { parts: [...parts, {}], pattern: null, updatedAt: 1 } })).toBeNull();
    expect(parseClientMessage({ t: 'device', snapshot: { parts: 'nope', updatedAt: 1 } })).toBeNull();
    expect(parseClientMessage({ t: 'cue', cue: { id: 'c1', kind: 'drop', landAtBar: 9, createdAt: 1 } })).toMatchObject({ t: 'cue' });
    expect(parseClientMessage({ t: 'cue', cue: { id: 'c1', kind: 'nuke', landAtBar: 9, createdAt: 1 } })).toBeNull();
    expect(parseClientMessage({ t: 'cue', cue: { id: 'c1', kind: 'custom', label: 'x'.repeat(65), landAtBar: 9, createdAt: 1 } })).toBeNull();
  });
});
