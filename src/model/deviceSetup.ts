// Guided setup for an unknown machine (ENSEMBLE §4.3): a few simple answers →
// a draft Device Profile JSON the user can drop into /device-profiles and PR.
// Pure and testable; the UI (DeviceSetup) just collects the answers.

import type { DeviceProfile } from '../core/profiles/types.ts';

export interface SetupAnswers {
  manufacturer: string;
  model: string;
  /** Substring matched against Web MIDI port names for auto-detection. */
  portNameMatch: string;
  channelModel: 'global' | 'per-part' | 'multi';
  trackCount: number;
  trackLabel: string;
  sysex: boolean;
  clockMaster: boolean;
  clockSlave: boolean;
  /** Emits Start/Stop/Continue transport. */
  transport: boolean;
  songPosition: boolean;
  /** Single main output: stereo (true) or mono (false). */
  stereoOut: boolean;
}

export const DEFAULT_ANSWERS: SetupAnswers = {
  manufacturer: '',
  model: '',
  portNameMatch: '',
  channelModel: 'multi',
  trackCount: 8,
  trackLabel: 'tracks',
  sysex: false,
  clockMaster: false,
  clockSlave: true,
  transport: true,
  songPosition: false,
  stereoOut: true,
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** True once the answers carry enough to identify the machine. */
export function answersComplete(a: SetupAnswers): boolean {
  return (
    a.manufacturer.trim() !== '' && a.model.trim() !== '' && a.trackCount > 0
  );
}

export function buildProfileDraft(a: SetupAnswers): DeviceProfile {
  const portMatch = a.portNameMatch.trim();
  return {
    schemaVersion: 1,
    id: `${slugify(a.manufacturer)}-${slugify(a.model)}`,
    status: 'draft',
    identity: {
      manufacturer: a.manufacturer.trim(),
      model: a.model.trim(),
      webMidiPortNames: portMatch ? [portMatch] : [],
    },
    midi: {
      channelModel: a.channelModel,
      sysex: a.sysex,
      ccParams: [],
    },
    clock: {
      canBeMaster: a.clockMaster,
      canBeSlave: a.clockSlave,
      transport: a.transport ? ['start', 'stop', 'continue'] : [],
      songPosition: a.songPosition,
    },
    tracks: {
      count: a.trackCount,
      label: a.trackLabel.trim() || 'tracks',
    },
    audio: {
      outputs: [{ name: 'Main', channels: a.stereoOut ? 'stereo' : 'mono' }],
    },
    telemetry: {
      reportsActivePart: false,
      reportsPatternDump: false,
      reportsGlobalDump: false,
      reportsCcTweaks: false,
    },
  };
}

export function profileFilename(profile: DeviceProfile): string {
  return `${profile.id}.json`;
}

export function profileJson(profile: DeviceProfile): string {
  return JSON.stringify(profile, null, 2) + '\n';
}
