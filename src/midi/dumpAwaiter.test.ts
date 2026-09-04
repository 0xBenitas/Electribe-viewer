import { describe, it, expect, vi } from 'vitest';
import { DumpAwaiter } from './dumpAwaiter.ts';

describe('DumpAwaiter', () => {
  it('résout avec le dump livré', async () => {
    const a = new DumpAwaiter();
    const p = a.wait(1000);
    expect(a.pending).toBe(true);
    const raw = new Uint8Array([1, 2, 3]);
    expect(a.deliver(raw)).toBe(true);
    await expect(p).resolves.toBe(raw);
    expect(a.pending).toBe(false);
  });

  it('résout null après le délai, sans dump', async () => {
    vi.useFakeTimers();
    try {
      const a = new DumpAwaiter();
      const p = a.wait(500);
      vi.advanceTimersByTime(500);
      await expect(p).resolves.toBeNull();
      expect(a.pending).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignore un dump livré sans attente en cours', () => {
    const a = new DumpAwaiter();
    expect(a.deliver(new Uint8Array([9]))).toBe(false);
  });

  it('partage une attente entre appels concurrents', async () => {
    const a = new DumpAwaiter();
    const p1 = a.wait(1000);
    const p2 = a.wait(1000);
    expect(p1).toBe(p2);
    const raw = new Uint8Array([7]);
    a.deliver(raw);
    await expect(Promise.all([p1, p2])).resolves.toEqual([raw, raw]);
  });

  it('un dump tardif après le délai ne réveille rien', async () => {
    vi.useFakeTimers();
    try {
      const a = new DumpAwaiter();
      const p = a.wait(100);
      vi.advanceTimersByTime(100);
      await expect(p).resolves.toBeNull();
      expect(a.deliver(new Uint8Array([1]))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
