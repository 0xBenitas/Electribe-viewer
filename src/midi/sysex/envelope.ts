// Korg SysEx envelope for the electribe 2 (spec §6.1).
// F0 42 3<g> 00 01 23 <function> <data> F7

export const KORG_ID = 0x42;
export const ELECTRIBE_PRODUCT_ID = [0x00, 0x01, 0x23] as const;
export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;

export function buildSysExHeader(globalChannel: number): number[] {
  const deviceId = 0x30 | (globalChannel & 0x0f);
  return [SYSEX_START, KORG_ID, deviceId, ...ELECTRIBE_PRODUCT_ID];
}

export function buildSysEx(
  globalChannel: number,
  fn: number,
  data: number[] = [],
): Uint8Array {
  return new Uint8Array([
    ...buildSysExHeader(globalChannel),
    fn,
    ...data,
    SYSEX_END,
  ]);
}

export function isElectribeSysEx(data: Uint8Array): boolean {
  return (
    data.length >= 7 &&
    data[0] === SYSEX_START &&
    data[1] === KORG_ID &&
    (data[2]! & 0xf0) === 0x30 &&
    data[3] === 0x00 &&
    data[4] === 0x01 &&
    data[5] === 0x23
  );
}

export function getSysExFunction(data: Uint8Array): number | null {
  return isElectribeSysEx(data) ? data[6]! : null;
}
