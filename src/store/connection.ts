import { create } from 'zustand';
import { MIDIClient, isWebMidiSupported } from '../midi/client.ts';
import type { ConnectionState } from '../midi/types.ts';

interface ConnectionStore {
  state: ConnectionState;
  connect: () => Promise<void>;
  selectPort: (key: string) => Promise<void>;
}

let client: MIDIClient | null = null;

export const useConnectionStore = create<ConnectionStore>((set) => {
  const setState = (state: ConnectionState) => set({ state });

  const ensureClient = (): MIDIClient => {
    if (!client) client = new MIDIClient({ onState: setState });
    return client;
  };

  return {
    state: isWebMidiSupported()
      ? { status: 'idle' }
      : { status: 'browser-unsupported' },
    connect: () => ensureClient().connect(),
    selectPort: (key: string) => ensureClient().selectByKey(key),
  };
});
