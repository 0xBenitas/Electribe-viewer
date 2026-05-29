// Value encoding helpers between app representation and MIDI bytes (spec §6.5).

export type CCEncoding = 'unsigned' | 'signed' | 'pan' | 'toggle';

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/**
 * Pan: 00=L63, 40=Center, 7F=R63.
 * App representation: -64..0..+63 (negative = L, positive = R).
 */
export function encodePan(value: number): number {
  return clamp(value + 64, 0, 127);
}

export function decodePan(midi: number): number {
  return clamp(midi - 64, -64, 63);
}

/**
 * Signed (Pitch, EG Int): 00,01..7F = -63,-63..+63.
 * Note: 0x00 and 0x01 both map to -63 (Korg idiosyncrasy).
 */
export function encodeSigned(value: number): number {
  if (value <= -63) return 0x01; // canonical form
  return clamp(value + 64, 0, 127);
}

export function decodeSigned(midi: number): number {
  if (midi === 0x00) return -63;
  return clamp(midi - 64, -63, 63);
}

/** Toggle: 0=Off, 7F=On. Tolerant decode (>= center = on). */
export function encodeToggle(on: boolean): number {
  return on ? 0x7f : 0x00;
}

export function decodeToggle(midi: number): boolean {
  return midi >= 0x40;
}

export function encodeUnsigned(value: number): number {
  return clamp(Math.round(value), 0, 127);
}
