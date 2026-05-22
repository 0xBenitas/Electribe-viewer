import type { DeviceIdentity } from './deviceInquiry.ts';

export interface PortInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface PortPair {
  /** Stable key derived from the port name (parts share IN/OUT name). */
  key: string;
  name: string;
  input: MIDIInput;
  output: MIDIOutput;
}

/** Connection state machine (spec §6.10). */
export type ConnectionState =
  | { status: 'idle' }
  | { status: 'browser-unsupported' }
  | { status: 'requesting-permission' }
  | { status: 'permission-denied' }
  | { status: 'scanning' }
  | { status: 'no-device' }
  | { status: 'manual-select'; candidates: PortInfo[] }
  | { status: 'connecting'; port: PortInfo }
  | { status: 'inquiring'; port: PortInfo }
  | {
      status: 'connected';
      port: PortInfo;
      identity: DeviceIdentity;
      lastSeen: number;
    }
  | { status: 'stale'; port: PortInfo; lastSeen: number }
  | { status: 'error'; message: string };
