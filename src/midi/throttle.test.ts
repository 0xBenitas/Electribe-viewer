import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CCThrottler } from './throttle.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.restoreAllMocks());

describe('CCThrottler', () => {
  it('coalesces repeated values for the same (channel, cc)', () => {
    const sent: number[][] = [];
    const t = new CCThrottler((m) => sent.push(m), 20);
    t.start();

    for (let v = 0; v <= 100; v++) t.enqueue(5, 74, v);
    vi.advanceTimersByTime(20);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([0xb5, 74, 100]); // ch6 (index 5), last value
    t.stop();
  });

  it('keeps distinct (channel, cc) pairs', () => {
    const sent: number[][] = [];
    const t = new CCThrottler((m) => sent.push(m), 20);
    t.start();

    t.enqueue(0, 74, 10);
    t.enqueue(0, 71, 20);
    t.enqueue(5, 74, 30);
    vi.advanceTimersByTime(20);

    expect(sent).toHaveLength(3);
    t.stop();
  });

  it('flushes pending messages on stop', () => {
    const sent: number[][] = [];
    const t = new CCThrottler((m) => sent.push(m), 20);
    t.start();
    t.enqueue(0, 74, 42);
    t.stop();
    expect(sent).toEqual([[0xb0, 74, 42]]);
  });
});
