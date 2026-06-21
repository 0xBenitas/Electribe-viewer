import {
  buildDeviceInquiryRequest,
  parseDeviceInquiryReply,
  type DeviceIdentity,
} from './deviceInquiry.ts';
import { pairPorts, toPortInfo } from './ports.ts';
import { matchProfileByPortName, resolveProfile } from '../core/profiles/registry.ts';
import type { ConnectionState, PortPair } from './types.ts';

const INQUIRY_TIMEOUT_MS = 1000;

export interface MidiMessage {
  /** Low nibble of the status byte + 1, i.e. the 1-based MIDI channel. */
  channel: number;
  data: Uint8Array;
  /** Event timestamp (DOMHighResTimeStamp, ms) — same domain as performance.now(). */
  timeStamp: number;
}

export interface MIDIClientCallbacks {
  onState: (state: ConnectionState) => void;
  onMessage?: (msg: MidiMessage) => void;
}

export function isWebMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

export class MIDIClient {
  private access: MIDIAccess | null = null;
  private pair: PortPair | null = null;
  private identity: DeviceIdentity | null = null;

  constructor(private readonly cb: MIDIClientCallbacks) {}

  async connect(): Promise<void> {
    if (!isWebMidiSupported()) {
      this.cb.onState({ status: 'browser-unsupported' });
      return;
    }

    this.cb.onState({ status: 'requesting-permission' });
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: true });
    } catch {
      this.cb.onState({ status: 'permission-denied' });
      return;
    }

    this.access.onstatechange = () => {
      void this.rescan();
    };

    await this.scanAndConnect();
  }

  private async scanAndConnect(): Promise<void> {
    if (!this.access) return;
    this.cb.onState({ status: 'scanning' });

    const pairs = pairPorts(this.access);
    if (pairs.length === 0) {
      this.cb.onState({ status: 'no-device' });
      return;
    }
    // Prefer ports that match a known Device Profile; otherwise offer them all.
    const known = pairs.filter((p) => matchProfileByPortName(p.name) !== null);
    const candidates = known.length > 0 ? known : pairs;

    if (candidates.length === 1) {
      await this.openAndConnect(candidates[0]!);
      return;
    }
    this.cb.onState({
      status: 'manual-select',
      candidates: candidates.map((p) => toPortInfo(p.output)),
    });
  }

  async selectByKey(key: string): Promise<void> {
    if (!this.access) return;
    const pair = pairPorts(this.access).find((p) => p.key === key);
    if (!pair) {
      this.cb.onState({ status: 'no-device' });
      return;
    }
    await this.openAndConnect(pair);
  }

  private async openAndConnect(pair: PortPair): Promise<void> {
    this.pair = pair;
    const port = toPortInfo(pair.output);
    this.cb.onState({ status: 'connecting', port });

    await pair.input.open();
    await pair.output.open();
    pair.input.onmidimessage = (e) => this.handleMessage(e);

    this.cb.onState({ status: 'inquiring', port });

    // Identity is best-effort: Korg replies (gives us the global channel), other
    // machines may not — we still connect, resolving the profile by port name.
    const identity = await this.awaitIdentity(pair);
    this.identity = identity;
    const profile = resolveProfile(port.name, identity);
    this.cb.onState({
      status: 'connected',
      port,
      identity,
      profileId: profile?.id ?? null,
      lastSeen: Date.now(),
    });
  }

  private awaitIdentity(pair: PortPair): Promise<DeviceIdentity | null> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(null);
      }, INQUIRY_TIMEOUT_MS);

      this.pendingInquiry = (identity) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(identity);
      };

      pair.output.send(buildDeviceInquiryRequest());
    });
  }

  private pendingInquiry: ((identity: DeviceIdentity) => void) | null = null;

  private handleMessage(e: MIDIMessageEvent): void {
    const data = e.data;
    if (!data || data.length === 0) return;

    if (this.pendingInquiry && data[0] === 0xf0) {
      const identity = parseDeviceInquiryReply(data);
      if (identity) {
        const cb = this.pendingInquiry;
        this.pendingInquiry = null;
        cb(identity);
        return;
      }
    }

    this.cb.onMessage?.({
      channel: (data[0]! & 0x0f) + 1,
      data,
      timeStamp: e.timeStamp,
    });
  }

  private async rescan(): Promise<void> {
    if (!this.access || !this.pair) return;
    // If our paired output disappeared, attempt a fresh scan.
    const stillPresent = [...this.access.outputs.values()].some(
      (o) => o.id === this.pair?.output.id,
    );
    if (!stillPresent) {
      this.pair = null;
      this.identity = null;
      await this.scanAndConnect();
    }
  }

  send(bytes: number[] | Uint8Array): void {
    try {
      this.pair?.output.send(
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      );
    } catch {
      // Output may be closing/disconnected (InvalidStateError); drop the message.
    }
  }

  getIdentity(): DeviceIdentity | null {
    return this.identity;
  }

  /** Names of all paired MIDI ports currently visible. */
  getPairNames(): string[] {
    if (!this.access) return [];
    return pairPorts(this.access).map((p) => p.name);
  }

  dispose(): void {
    if (this.pair) this.pair.input.onmidimessage = null;
    if (this.access) this.access.onstatechange = null;
    this.pair = null;
    this.access = null;
  }
}
