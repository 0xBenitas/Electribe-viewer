import { create } from 'zustand';
import { isWebMidiSupported } from '../midi/client.ts';
import type { ConnectionState } from '../midi/types.ts';

interface ConnectionStore {
  state: ConnectionState;
}

/** State container. Actions live in `midi/bridge.ts` (owns the MIDIClient). */
export const useConnectionStore = create<ConnectionStore>(() => ({
  state: isWebMidiSupported()
    ? { status: 'idle' }
    : { status: 'browser-unsupported' },
}));
