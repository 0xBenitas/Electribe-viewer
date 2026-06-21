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

  it('relays peer events to its callbacks', () => {
    const t = new NinjamTransport();
    const joined: string[] = [];
    const left: string[] = [];
    t.onPeerJoin((p) => joined.push(p.id));
    t.onPeerLeave((p) => left.push(p.id));
    t.emitPeerJoin({ id: 'p1', name: 'A' });
    t.emitPeerLeave({ id: 'p1', name: 'A' });
    expect(joined).toEqual(['p1']);
    expect(left).toEqual(['p1']);
  });
});
