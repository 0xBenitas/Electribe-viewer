// Multi-tab guard (spec §6.12). Only one tab should drive the MIDI port.

const CHANNEL = 'emx-pilot';

export interface TabGuard {
  /** True if another tab already claimed the device. */
  onConflict: (cb: () => void) => void;
  release: () => void;
}

export function createTabGuard(): TabGuard {
  const channel = new BroadcastChannel(CHANNEL);
  const id = crypto.randomUUID();
  let conflictCb: (() => void) | null = null;

  channel.postMessage({ type: 'claim', id });

  channel.onmessage = (e: MessageEvent) => {
    const msg = e.data as { type: string; id: string };
    if (msg.type === 'claim' && msg.id !== id) {
      // Another tab is claiming: announce we already hold it.
      channel.postMessage({ type: 'present', id });
    }
    if (msg.type === 'present' && msg.id !== id) {
      conflictCb?.();
    }
  };

  return {
    onConflict: (cb) => {
      conflictCb = cb;
    },
    release: () => channel.close(),
  };
}
