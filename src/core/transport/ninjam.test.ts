import { describe, it, expect } from 'vitest';
import {
  NinjamTransport,
  ninjamTarget,
  NINJAM_DEFAULT_PORT,
} from './ninjam.ts';

describe('ninjamTarget', () => {
  it('appends the default port when none is given', () => {
    expect(ninjamTarget('jam.example.org')).toBe(
      `jam.example.org:${NINJAM_DEFAULT_PORT}`,
    );
  });

  it('keeps an explicit port and trims trailing slashes/space', () => {
    expect(ninjamTarget(' jam.example.org:9000/ ')).toBe('jam.example.org:9000');
  });
});

describe('NinjamTransport', () => {
  it('has no target until connected, then exposes host:port', async () => {
    const t = new NinjamTransport();
    expect(t.nativeClientTarget()).toBeNull();
    await t.connect({ room: 'jam', serverHost: 'localhost', user: 'A' });
    expect(t.nativeClientTarget()).toBe(`localhost:${NINJAM_DEFAULT_PORT}`);
    await t.disconnect();
    expect(t.nativeClientTarget()).toBeNull();
  });

});
