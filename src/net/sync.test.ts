import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchServerMessage } from './sync.ts';
import { useSessionStore } from '../store/session.ts';
import type { DeviceSnapshot } from '../core/session/snapshot.ts';
import type { PeerState } from '../core/session/protocol.ts';

const snap = (updatedAt: number, activePart: number | null = 1): DeviceSnapshot => ({
  profileId: 'korg-electribe-2',
  model: 'Electribe 2',
  activePart,
  parts: [],
  pattern: null,
  updatedAt,
});

const peer = (id: string, isHost = false): PeerState => ({
  id,
  info: { name: id },
  isHost,
});

describe('dispatchServerMessage', () => {
  beforeEach(() => useSessionStore.getState().reset());

  it('welcome sets self id (keeping our name) and seeds existing peers', () => {
    useSessionStore.getState().setSelf('', { name: 'Bastou' });
    dispatchServerMessage({ t: 'welcome', self: 'p3', peers: [peer('p1', true)] });
    const st = useSessionStore.getState();
    expect(st.self).toEqual({ id: 'p3', info: { name: 'Bastou' } });
    expect(st.peers.p1!.isHost).toBe(true);
  });

  it('peer-join upserts without dropping an existing device snapshot', () => {
    const store = useSessionStore.getState();
    store.addPeer(peer('p1'));
    store.applySnapshot('p1', snap(10, 4));
    // A host-promotion peer-join arrives for the same peer.
    dispatchServerMessage({ t: 'peer-join', peer: peer('p1', true) });
    const p1 = useSessionStore.getState().peers.p1!;
    expect(p1.isHost).toBe(true);
    expect(p1.device?.activePart).toBe(4); // snapshot preserved
  });

  it('derives host: first joiner is host, else the existing host', () => {
    // No existing host among peers → we are the host.
    useSessionStore.getState().setSelf('', { name: 'B' });
    dispatchServerMessage({ t: 'welcome', self: 'me', peers: [] });
    expect(useSessionStore.getState().hostId).toBe('me');

    useSessionStore.getState().reset();
    useSessionStore.getState().setSelf('', { name: 'B' });
    dispatchServerMessage({ t: 'welcome', self: 'me', peers: [peer('p1', true)] });
    expect(useSessionStore.getState().hostId).toBe('p1');
  });

  it('clears host on host departure and adopts a promoted host', () => {
    useSessionStore.getState().setSelf('', { name: 'B' });
    dispatchServerMessage({ t: 'welcome', self: 'me', peers: [peer('p1', true)] });
    dispatchServerMessage({ t: 'peer-leave', peer: 'p1' });
    expect(useSessionStore.getState().hostId).toBeNull();
    dispatchServerMessage({ t: 'peer-join', peer: peer('me', true) });
    expect(useSessionStore.getState().hostId).toBe('me');
  });

  it('routes device, transport, and peer-leave', () => {
    const store = useSessionStore.getState();
    store.addPeer(peer('p1'));
    dispatchServerMessage({ t: 'device', peer: 'p1', snapshot: snap(5, 2) });
    expect(useSessionStore.getState().peers.p1!.device?.activePart).toBe(2);

    dispatchServerMessage({ t: 'transport', host: 'p1', serverTs: 1, bpm: 128, bar: 3, beat: 4 });
    expect(useSessionStore.getState().transport).toEqual({ bpm: 128, bar: 3, beat: 4 });

    dispatchServerMessage({ t: 'peer-leave', peer: 'p1' });
    expect(useSessionStore.getState().peers.p1).toBeUndefined();
  });
});
