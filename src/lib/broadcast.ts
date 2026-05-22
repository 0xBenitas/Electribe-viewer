// Multi-tab guard (spec §6.12). Only one tab should drive the MIDI port.

const CHANNEL = 'emx-pilot';

interface GuardMessage {
  type: 'claim' | 'present' | 'released';
  id: string;
}

export interface TabGuard {
  /** Another tab already holds the device. */
  onConflict: (cb: () => void) => void;
  /** The conflicting tab went away; we may proceed again. */
  onResolved: (cb: () => void) => void;
  release: () => void;
}

export function createTabGuard(): TabGuard {
  const channel = new BroadcastChannel(CHANNEL);
  const id = crypto.randomUUID();
  let conflictCb: (() => void) | null = null;
  let resolvedCb: (() => void) | null = null;
  let released = false;

  const announce = (type: GuardMessage['type']) => {
    try {
      channel.postMessage({ type, id } satisfies GuardMessage);
    } catch {
      // channel closed
    }
  };

  channel.onmessage = (e: MessageEvent<GuardMessage>) => {
    const msg = e.data;
    if (msg.id === id) return;
    if (msg.type === 'claim') {
      announce('present'); // tell the newcomer we already hold it
    } else if (msg.type === 'present') {
      conflictCb?.();
    } else if (msg.type === 'released') {
      // The other tab left. Clear our conflict, then re-claim so that any
      // remaining tab re-asserts and we don't end up with two active tabs.
      resolvedCb?.();
      announce('claim');
    }
  };

  const doRelease = () => {
    if (released) return;
    released = true;
    announce('released');
    window.removeEventListener('beforeunload', doRelease);
    channel.close();
  };
  window.addEventListener('beforeunload', doRelease);

  announce('claim');

  return {
    onConflict: (cb) => {
      conflictCb = cb;
    },
    onResolved: (cb) => {
      resolvedCb = cb;
    },
    release: doRelease,
  };
}
