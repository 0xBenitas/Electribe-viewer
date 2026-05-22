// Universal SysEx Device Inquiry handshake (spec §6.3).
// Validated Phase 0: reply F0 7E 0g 06 02 42 23 01 00 00 vMaj vMin vRel _ F7

export function buildDeviceInquiryRequest(): Uint8Array {
  // Universal Non-Realtime, Identity Request, Any Channel.
  return new Uint8Array([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
}

export interface DeviceIdentity {
  globalChannel: number;
  manufacturer: 'korg';
  product: 'electribe';
  versionMajor: number;
  versionMinor: number;
  versionRelease: number;
}

export function parseDeviceInquiryReply(
  data: Uint8Array,
): DeviceIdentity | null {
  // Expected: F0 7E 0g 06 02 42 23 01 00 00 vMaj vMin vRel _ F7
  if (data.length < 14) return null;
  if (data[0] !== 0xf0 || data[1] !== 0x7e) return null;
  if (data[3] !== 0x06 || data[4] !== 0x02) return null;
  if (data[5] !== 0x42) return null; // Korg
  if (data[6] !== 0x23 || data[7] !== 0x01) return null; // electribe family
  return {
    globalChannel: data[2]! & 0x0f,
    manufacturer: 'korg',
    product: 'electribe',
    versionMajor: data[10]!,
    versionMinor: data[11]!,
    versionRelease: data[12]!,
  };
}

/**
 * Human-readable firmware string.
 * Phase 0 finding (99.4): bytes `02 02 00` correspond to firmware "2.02".
 */
export function formatFirmware(id: DeviceIdentity): string {
  return `${id.versionMajor}.${String(id.versionMinor).padStart(2, '0')}`;
}
