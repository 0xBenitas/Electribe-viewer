// Trames audio binaires sur le WebSocket de session (ADR-007). Le relais ne
// décode rien : il préfixe l'id de l'émetteur et renvoie aux autres membres de
// la room. Encodage/décodage partagés client/serveur, testés.
//
// Client → serveur :  [0x01][gridId u8][interval i32][seq u16][offsetSamples u32][opus…]
// Serveur → clients : [0x02][idLen u8][peerId utf8…][gridId u8][interval i32][seq u16][offsetSamples u32][opus…]

export const FRAME_UP = 0x01;
export const FRAME_DOWN = 0x02;

export interface AudioChunkHeader {
  gridId: number;
  interval: number;
  seq: number;
  offsetSamples: number;
}

export interface AudioChunk extends AudioChunkHeader {
  payload: Uint8Array;
}

const UP_HEADER = 1 + 1 + 4 + 2 + 4;

export function encodeUpFrame(chunk: AudioChunk): Uint8Array {
  const out = new Uint8Array(UP_HEADER + chunk.payload.length);
  const dv = new DataView(out.buffer);
  out[0] = FRAME_UP;
  out[1] = chunk.gridId & 0xff;
  dv.setInt32(2, chunk.interval);
  dv.setUint16(6, chunk.seq & 0xffff);
  dv.setUint32(8, chunk.offsetSamples >>> 0);
  out.set(chunk.payload, UP_HEADER);
  return out;
}

function readHeader(dv: DataView, at: number): AudioChunkHeader {
  return {
    gridId: dv.getUint8(at),
    interval: dv.getInt32(at + 1),
    seq: dv.getUint16(at + 5),
    offsetSamples: dv.getUint32(at + 7),
  };
}

/** Trame client → serveur ; null si malformée. */
export function decodeUpFrame(bytes: Uint8Array): AudioChunk | null {
  if (bytes.length < UP_HEADER || bytes[0] !== FRAME_UP) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { ...readHeader(dv, 1), payload: bytes.subarray(UP_HEADER) };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Le relais convertit une trame montante en trame descendante signée de l'émetteur. */
export function toDownFrame(peerId: string, up: Uint8Array): Uint8Array | null {
  if (up.length < UP_HEADER || up[0] !== FRAME_UP) return null;
  const id = encoder.encode(peerId);
  if (id.length > 255) return null;
  const out = new Uint8Array(2 + id.length + (up.length - 1));
  out[0] = FRAME_DOWN;
  out[1] = id.length;
  out.set(id, 2);
  out.set(up.subarray(1), 2 + id.length); // gridId… payload, tels quels
  return out;
}

export interface DownFrame extends AudioChunk {
  peerId: string;
}

/** Trame serveur → client ; null si malformée. */
export function decodeDownFrame(bytes: Uint8Array): DownFrame | null {
  if (bytes.length < 2 || bytes[0] !== FRAME_DOWN) return null;
  const idLen = bytes[1]!;
  const headerAt = 2 + idLen;
  if (bytes.length < headerAt + (UP_HEADER - 1)) return null;
  const peerId = decoder.decode(bytes.subarray(2, headerAt));
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    peerId,
    ...readHeader(dv, headerAt),
    payload: bytes.subarray(headerAt + (UP_HEADER - 1)),
  };
}
