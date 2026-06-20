import { describe, it, expect } from 'vitest';
import { MidiClock } from './midiClock.ts';
import { PPQN } from './types.ts';

const CLOCK = [0xf8];
const START = [0xfa];
const CONTINUE = [0xfb];
const STOP = [0xfc];
const spp = (midiBeats: number) => [0xf2, midiBeats & 0x7f, (midiBeats >> 7) & 0x7f];

/** Feed `count` clock ticks at a fixed BPM, starting at `ts0`. Returns next ts. */
function feedTicks(clock: MidiClock, count: number, bpm: number, ts0: number): number {
  const msPerTick = 60000 / bpm / PPQN;
  let ts = ts0;
  for (let i = 0; i < count; i++) {
    clock.feed(CLOCK, ts);
    ts += msPerTick;
  }
  return ts;
}

describe('MidiClock', () => {
  it('estimates BPM from a running clock', () => {
    const clock = new MidiClock();
    clock.feed(START, 0);
    feedTicks(clock, 48, 120, 0);
    expect(clock.snapshot().bpm).toBeCloseTo(120, 1);
  });

  it('reports null BPM before enough ticks', () => {
    const clock = new MidiClock();
    clock.feed(START, 0);
    feedTicks(clock, 2, 120, 0);
    expect(clock.snapshot().bpm).toBeNull();
  });

  it('advances position only while running', () => {
    const clock = new MidiClock();
    // Free-running clock before Start: BPM tracks, position stays at the downbeat.
    feedTicks(clock, 24, 120, 0);
    expect(clock.snapshot()).toMatchObject({ running: false, bar: 1, beat: 1, tick: 0 });

    clock.feed(START, 1000);
    const after = feedTicks(clock, PPQN, 120, 1000);
    expect(clock.snapshot()).toMatchObject({ running: true, bar: 1, beat: 2 });
    expect(after).toBeGreaterThan(1000);
  });

  it('rewinds to the downbeat on Start', () => {
    const clock = new MidiClock();
    clock.feed(START, 0);
    feedTicks(clock, PPQN * 5, 120, 0); // into bar 2
    expect(clock.snapshot().bar).toBe(2);
    clock.feed(START, 5000);
    expect(clock.snapshot()).toMatchObject({ bar: 1, beat: 1, tick: 0 });
  });

  it('freezes position on Stop and resumes on Continue', () => {
    const clock = new MidiClock();
    clock.feed(START, 0);
    let ts = feedTicks(clock, PPQN * 2, 120, 0); // bar 1, beat 3
    clock.feed(STOP, ts);
    const frozen = clock.snapshot();
    expect(frozen).toMatchObject({ running: false, beat: 3 });

    // Ticks while stopped must not advance position.
    ts = feedTicks(clock, PPQN, 120, ts + 10);
    expect(clock.snapshot().beat).toBe(3);

    clock.feed(CONTINUE, ts);
    feedTicks(clock, PPQN, 120, ts);
    expect(clock.snapshot()).toMatchObject({ running: true, beat: 4 });
  });

  it('jumps position on Song Position Pointer', () => {
    const clock = new MidiClock();
    // 16 MIDI-beats (16th notes) = 16 * 6 = 96 ticks = one 4/4 bar.
    clock.feed(spp(16), 0);
    expect(clock.snapshot()).toMatchObject({ bar: 2, beat: 1 });
  });

  it('flags the clock as stale after a gap', () => {
    const clock = new MidiClock({ staleAfterMs: 500 });
    clock.feed(START, 0);
    feedTicks(clock, 48, 120, 0);
    const lastTs = 48 * (60000 / 120 / PPQN);
    expect(clock.snapshot(lastTs + 10).hasClock).toBe(true);
    expect(clock.snapshot(lastTs + 1000).hasClock).toBe(false);
  });

  it('drops stale samples so a gap never poisons BPM', () => {
    const clock = new MidiClock({ staleAfterMs: 500 });
    clock.feed(START, 0);
    let ts = feedTicks(clock, 24, 120, 0);
    // Long silence (clock lost), then a clean 90 BPM run resumes.
    ts += 5000;
    feedTicks(clock, 48, 90, ts);
    expect(clock.snapshot().bpm).toBeCloseTo(90, 1);
  });

  it('ignores unrelated messages (notes, CC, SysEx)', () => {
    const clock = new MidiClock();
    clock.feed(START, 0);
    clock.feed([0x90, 60, 100], 1); // note on
    clock.feed([0xb0, 74, 64], 2); // CC
    clock.feed([0xf0, 0x42, 0xf7], 3); // sysex
    expect(clock.snapshot()).toMatchObject({ tick: 0, bar: 1, beat: 1 });
  });

  it('resets fully', () => {
    const clock = new MidiClock();
    clock.feed(START, 0);
    feedTicks(clock, 48, 120, 0);
    clock.reset();
    expect(clock.snapshot()).toMatchObject({
      running: false,
      bpm: null,
      bar: 1,
      beat: 1,
      tick: 0,
      hasClock: false,
    });
  });
});
