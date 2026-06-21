// Device Profile registry + matching (ENSEMBLE §4).
// Profiles are versioned JSON under /device-profiles. Auto-detection matches a
// live Web MIDI port (and, when available, the SysEx Identity Reply) to a profile.

import electribe2 from '../../../device-profiles/korg-electribe-2.json';
import modelSamples from '../../../device-profiles/elektron-model-samples.json';
import modelCycles from '../../../device-profiles/elektron-model-cycles.json';
import digitakt from '../../../device-profiles/elektron-digitakt.json';
import td3 from '../../../device-profiles/behringer-td-3.json';
import tb3 from '../../../device-profiles/roland-tb-3.json';
import type { DeviceProfile } from './types.ts';
import type { DeviceIdentity } from '../../midi/deviceInquiry.ts';

export const PROFILES: readonly DeviceProfile[] = [
  electribe2 as DeviceProfile,
  modelSamples as DeviceProfile,
  modelCycles as DeviceProfile,
  digitakt as DeviceProfile,
  td3 as DeviceProfile,
  tb3 as DeviceProfile,
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

/** Whether a Web MIDI port name matches any known profile. */
export function isKnownPortName(portName: string): boolean {
  return matchProfileByPortName(portName) !== null;
}

/**
 * Whether a profile exposes the rich per-part editor (full SysEx telemetry).
 * Only the Electribe today; other machines get the lite cockpit (tempo,
 * presence, cues, audio) until their SysEx is reverse-engineered.
 */
export function supportsRichEditor(profileId: string | null): boolean {
  const profile = profileId ? getProfile(profileId) : null;
  return profile?.telemetry.reportsPatternDump ?? false;
}
