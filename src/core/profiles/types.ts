// Device Profile schema — the declarative description of a machine (JAMBOREE §4).
// One JSON file per machine, versioned under /device-profiles. The cockpit reads
// these to drive auto-detection and a capability-driven UI (never a dead button).

/** How confident we are in this profile's data. */
export type ProfileStatus = 'verified' | 'draft';

export interface DeviceProfile {
  /** Format version of this schema. Bump on breaking changes. */
  schemaVersion: 1;
  /** Stable slug, also the filename: "korg-electribe-2" -> korg-electribe-2.json */
  id: string;
  /** `verified` = confirmed on hardware; `draft` = from docs, not yet validated. */
  status: ProfileStatus;
  identity: DeviceIdentitySpec;
  midi: MidiCapabilities;
  clock: ClockCapabilities;
  tracks: TrackStructure;
  audio: AudioConnectivity;
  telemetry: TelemetryCapabilities;
}

export interface DeviceIdentitySpec {
  manufacturer: string;
  model: string;
  /** Notable firmware variants (e.g. Hacktribe). Informational. */
  variants?: string[];
  /** Case-insensitive substrings matched against Web MIDI port names. */
  webMidiPortNames: string[];
  /** Web USB product strings for fine identification (optional). */
  webUsbProductStrings?: string[];
  /** Discriminators from the Universal SysEx Identity Reply, as decimal bytes. */
  sysex?: {
    /** Manufacturer ID, e.g. [66] for Korg (0x42). */
    manufacturerId: number[];
    /** Family/member bytes, e.g. [35, 1] for the Electribe family (0x23 0x01). */
    familyId?: number[];
  };
}

export interface MidiCapabilities {
  /**
   * Channel model:
   * - `global`  : one global channel, CC affect the current edit target (Electribe).
   * - `per-part`: each part/track owns a channel.
   * - `multi`   : multitimbral with per-part channels addressable independently.
   */
  channelModel: 'global' | 'per-part' | 'multi';
  sysex: boolean;
  /** Mappable CC params the cockpit can surface. Full encoding lives in code. */
  ccParams: { name: string; cc: number }[];
}

export interface ClockCapabilities {
  /** Can emit MIDI clock to drive others (master). */
  canBeMaster: boolean;
  /** Can be driven by an external MIDI clock (slave). */
  canBeSlave: boolean;
  /** Transport messages it understands/emits. */
  transport: ('start' | 'stop' | 'continue')[];
  /** Emits Song Position Pointer. */
  songPosition: boolean;
}

export interface TrackStructure {
  /** Number of parts/tracks. */
  count: number;
  /** What the manufacturer calls them: "parts", "tracks", "pads"... */
  label: string;
  /** Explicit names if fixed (omit for numbered parts). */
  names?: string[];
}

export interface AudioConnectivity {
  outputs: { name: string; channels: 'mono' | 'stereo' }[];
}

/** What the machine can actually report back to the cockpit over MIDI. */
export interface TelemetryCapabilities {
  /** Cockpit can detect which part is being edited. */
  reportsActivePart: boolean;
  /** Exposes a full current-pattern SysEx dump. */
  reportsPatternDump: boolean;
  /** Exposes a global-settings SysEx dump. */
  reportsGlobalDump: boolean;
  /** Streams CC tweaks live (for mirroring / visualisation). */
  reportsCcTweaks: boolean;
}
