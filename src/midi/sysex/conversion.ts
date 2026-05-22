// Korg 7-to-8 bit data conversion for SysEx dumps (spec §6.7, MIDI doc NOTE 3).
//
// Each "set" packs 7 raw 8-bit bytes into 8 MIDI 7-bit bytes: the first MIDI
// byte holds the MSBs of the following 7 bytes (bit j -> byte j).

export function decode7to8(midi: Uint8Array): Uint8Array {
  const raw: number[] = [];
  for (let i = 0; i < midi.length; i += 8) {
    const msbs = midi[i]!;
    for (let j = 0; j < 7 && i + j + 1 < midi.length; j++) {
      const lo = midi[i + j + 1]!;
      raw.push(lo | (((msbs >> j) & 0x01) << 7));
    }
  }
  return new Uint8Array(raw);
}

export function encode8to7(raw: Uint8Array): Uint8Array {
  const midi: number[] = [];
  for (let i = 0; i < raw.length; i += 7) {
    let msbs = 0;
    const chunk: number[] = [];
    for (let j = 0; j < 7 && i + j < raw.length; j++) {
      const byte = raw[i + j]!;
      if (byte & 0x80) msbs |= 1 << j;
      chunk.push(byte & 0x7f);
    }
    midi.push(msbs, ...chunk);
  }
  return new Uint8Array(midi);
}
