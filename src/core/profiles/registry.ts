// Device Profile registry + matching (ENSEMBLE §4).
// Profiles are versioned JSON under /device-profiles. Auto-detection matches a
// live Web MIDI port (and, when available, the SysEx Identity Reply) to a profile.

import electribe2 from '../../../device-profiles/korg-electribe-2.json';
import modelSamples from '../../../device-profiles/elektron-model-samples.json';
import type { DeviceProfile } from './types.ts';
import type { DeviceIdentity } from '../../midi/deviceInquiry.ts';

export const PROFILES: readonly DeviceProfile[] = [
  electribe2 as DeviceProfile,
  modelSamples as DeviceProfile,
];

/** Find a profile whose port-name matchers are a substring of `portName`. */
export function matchProfileByPortName(portName: string): DeviceProfile | null {
  const lower = portName.toLowerCase();
  return (
    PROFILES.find((p) =>
      p.identity.webMidiPortNames.some((n) => lower.includes(n.toLowerCase())),
    ) ?? null
  );
}

/**
 * Resolve the best profile for a connected device. Port name is the primary
 * signal (works before any SysEx handshake); the parsed identity refines it.
 * Returns null for an unknown machine → the cockpit falls back to guided setup.
 */
export function resolveProfile(
  portName: string,
  identity?: DeviceIdentity | null,
): DeviceProfile | null {
  const byName = matchProfileByPortName(portName);
  if (byName) return byName;
  if (identity?.product === 'electribe') {
    return PROFILES.find((p) => p.id === 'korg-electribe-2') ?? null;
  }
  return null;
}

export function getProfile(id: string): DeviceProfile | null {
  return PROFILES.find((p) => p.id === id) ?? null;
}
