// MIDI real-time clock reducer.
//
// Consumes raw MIDI messages (status + optional data) with timestamps and
// derives a stable {bpm, bar, beat, phase} snapshot. Pure of any I/O — feed it
// from Web MIDI live, or from synthetic streams in tests. The cockpit reads
// snapshot() on each animation frame.

import { bpmFromTickIntervals } from './bpm.ts';
import { barBeatFromTicks } from './position.ts';
import type { ClockSnapshot, TimeSignature } from './types.ts';

const STATUS = {
  CLOCK: 0xf8,
  START: 0xfa,
  CONTINUE: 0xfb,
  STOP: 0xfc,
  SONG_POSITION: 0xf2,
} as const;

/** One Song Position "MIDI beat" = a 16th note = 6 clock ticks. */
const SPP_TICKS_PER_UNIT = 6;

export interface MidiClockOptions {
  timeSignature?: TimeSignature;
  /** Recent tick intervals kept for BPM smoothing. Default 24 (= one beat). */
  smoothingWindow?: number;
  /** A gap longer than this (ms) means the clock was lost: drop stale samples. */
  staleAfterMs?: number;
  /** Minimum interval samples before reporting BPM. Default 4. */
  minBpmSamples?: number;
}

export class MidiClock {
  private readonly beatsPerBar: number;
  private readonly window: number;
  private readonly staleAfterMs: number;
  private readonly minBpmSamples: number;

  private intervals: number[] = [];
  private lastTickTs: number | null = null;
  private positionTicks = 0;
  private running = false;

  constructor(opts: MidiClockOptions = {}) {
    this.beatsPerBar = opts.timeSignature?.beatsPerBar ?? 4;
    this.window = opts.smoothingWindow ?? 24;
    this.staleAfterMs = opts.staleAfterMs ?? 500;
    this.minBpmSamples = opts.minBpmSamples ?? 4;
  }

  /** Feed one MIDI message. Non-clock messages are ignored. */
  feed(message: ArrayLike<number>, timeStampMs: number): void {
    if (message.length === 0) return;
    switch (message[0]) {
      case STATUS.CLOCK:
        this.onTick(timeStampMs);
        break;
      case STATUS.START:
        // Start always rewinds to the downbeat (bar 1, beat 1).
        this.positionTicks = 0;
        this.running = true;
        break;
      case STATUS.CONTINUE:
        this.running = true;
        break;
      case STATUS.STOP:
        this.running = false;
        break;
      case STATUS.SONG_POSITION:
        if (message.length >= 3) {
          const value = (message[1]! & 0x7f) | ((message[2]! & 0x7f) << 7);
          this.positionTicks = value * SPP_TICKS_PER_UNIT;
        }
        break;
      default:
        break;
    }
  }

  private onTick(ts: number): void {
    if (this.lastTickTs !== null) {
      const delta = ts - this.lastTickTs;
      if (delta <= 0 || delta > this.staleAfterMs) {
        // Clock lost, or timestamps went backwards: restart the estimate so a
        // huge gap never pollutes the median.
        this.intervals = [];
      } else {
        this.intervals.push(delta);
        if (this.intervals.length > this.window) this.intervals.shift();
      }
    }
    this.lastTickTs = ts;
    if (this.running) this.positionTicks += 1;
  }

  /**
   * Current clock state. Pass `now` (e.g. performance.now()) to detect a stalled
   * clock; omit it to report state as of the last tick.
   */
  snapshot(now?: number): ClockSnapshot {
    const pos = barBeatFromTicks(this.positionTicks, this.beatsPerBar);
    const reference = now ?? this.lastTickTs ?? 0;
    const hasClock =
      this.lastTickTs !== null &&
      reference - this.lastTickTs < this.staleAfterMs;
    return {
      running: this.running,
      bpm: bpmFromTickIntervals(this.intervals, this.minBpmSamples),
      bar: pos.bar,
      beat: pos.beat,
      phase: pos.phase,
      tick: this.positionTicks,
      hasClock,
    };
  }

  reset(): void {
    this.intervals = [];
    this.lastTickTs = null;
    this.positionTicks = 0;
    this.running = false;
  }
}
