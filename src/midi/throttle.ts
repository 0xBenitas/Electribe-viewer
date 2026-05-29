// Outbound CC throttle (spec §6.11): coalesce by (channel, cc), flush at a
// fixed interval. Default 20 ms = 50 Hz (Phase 0 left fine calibration to here).

interface QueuedCC {
  ch: number;
  cc: number;
  value: number;
}

export class CCThrottler {
  private queue = new Map<string, QueuedCC>();
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly send: (msg: number[]) => void,
    private readonly flushMs = 20,
  ) {}

  start(): void {
    if (this.interval !== null) return;
    this.interval = setInterval(() => this.flush(), this.flushMs);
  }

  /** Stop the timer and flush whatever is queued (graceful shutdown). */
  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.flush();
  }

  /** Stop the timer and DISCARD the queue (used on disconnect). */
  reset(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.queue.clear();
  }

  /** Channel is 0-based here (status byte low nibble). */
  enqueue(ch: number, cc: number, value: number): void {
    this.queue.set(`${ch}:${cc}`, { ch, cc, value });
  }

  flush(): void {
    for (const { ch, cc, value } of this.queue.values()) {
      this.send([0xb0 | (ch & 0x0f), cc & 0x7f, value & 0x7f]);
    }
    this.queue.clear();
  }
}
