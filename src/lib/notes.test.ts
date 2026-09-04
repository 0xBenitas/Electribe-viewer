import { describe, it, expect } from 'vitest';
import { noteName } from './notes.ts';

describe('noteName', () => {
  it('nomme les notes MIDI (60 = C4)', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(69)).toBe('A4');
    expect(noteName(0)).toBe('C-1');
    expect(noteName(127)).toBe('G9');
    expect(noteName(37)).toBe('C#2');
  });
});
