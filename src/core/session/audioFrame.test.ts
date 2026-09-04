import { describe, it, expect } from 'vitest';
import {
  decodeDownFrame,
  decodeUpFrame,
  encodeUpFrame,
  toDownFrame,
} from './audioFrame.ts';

const chunk = {
  gridId: 3,
  interval: -2,
  seq: 65535,
  offsetSamples: 3_000_000,
  payload: new Uint8Array([9, 8, 7, 6, 5]),
};

describe('audioFrame', () => {
  it('encode / décode une trame montante byte-exact', () => {
    const up = encodeUpFrame(chunk);
    const back = decodeUpFrame(up);
    expect(back).not.toBeNull();
    expect({ ...back!, payload: [...back!.payload] }).toEqual({ ...chunk, payload: [9, 8, 7, 6, 5] });
  });

  it('le relais signe la trame de l’émetteur sans toucher au reste', () => {
    const down = toDownFrame('p12', encodeUpFrame(chunk));
    const back = decodeDownFrame(down!);
    expect(back?.peerId).toBe('p12');
    expect(back?.interval).toBe(-2);
    expect(back?.seq).toBe(65535);
    expect(back?.offsetSamples).toBe(3_000_000);
    expect([...back!.payload]).toEqual([9, 8, 7, 6, 5]);
  });

  it('rejette les trames malformées', () => {
    expect(decodeUpFrame(new Uint8Array([0x01, 0]))).toBeNull();
    expect(decodeUpFrame(new Uint8Array(20))).toBeNull(); // mauvais type
    expect(toDownFrame('x', new Uint8Array([0x02, 1, 2]))).toBeNull();
    expect(decodeDownFrame(new Uint8Array([0x02, 5, 1]))).toBeNull();
  });

  it('gère un id de pair en UTF-8', () => {
    const down = toDownFrame('pé', encodeUpFrame(chunk));
    expect(decodeDownFrame(down!)?.peerId).toBe('pé');
  });
});
