import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session.ts';
import type { DeviceSnapshot } from '../core/session/snapshot.ts';

const snap = (updatedAt: number, activePart: number | null = 1): DeviceSnapshot => ({
  profileId: 'korg-electribe-2',
  model: 'Electribe 2',
  activePart,
  parts: [],
  pattern: null,
  updatedAt,
});

describe('session store', () => {
  beforeEach(() => useSessionStore.getState().reset());

  it('tracks self and peers', () => {
    const s = useSessionStore.getState();
    s.setSelf('me', { name: 'Bastou' });
    s.addPeer({ id: 'p1', info: { name: 'Alice' }, isHost: true });
    const st = useSessionStore.getState();
    expect(st.self?.info.name).toBe('Bastou');
    expect(st.peers.p1!.isHost).toBe(true);
  });

  it('applies a snapshot only to a known peer', () => {
    const s = useSessionStore.getState();
    s.applySnapshot('ghost', snap(1)); // unknown peer → no-op
    expect(useSessionStore.getState().peers.ghost).toBeUndefined();

    s.addPeer({ id: 'p1', info: { name: 'Alice' }, isHost: false });
    s.applySnapshot('p1', snap(10, 3));
    expect(useSessionStore.getState().peers.p1!.device?.activePart).toBe(3);
  });

  it('drops strictly-older snapshots but keeps same-ms follow-ups', () => {
    const s = useSessionStore.getState();
    s.addPeer({ id: 'p1', info: { name: 'Alice' }, isHost: false });
    s.applySnapshot('p1', snap(20, 5));
    s.applySnapshot('p1', snap(10, 9)); // older → ignored
    expect(useSessionStore.getState().peers.p1!.device?.activePart).toBe(5);
    s.applySnapshot('p1', snap(20, 8)); // same ms → applied (TCP-ordered)
    expect(useSessionStore.getState().peers.p1!.device?.activePart).toBe(8);
    s.applySnapshot('p1', snap(30, 7)); // newer → applied
    expect(useSessionStore.getState().peers.p1!.device?.activePart).toBe(7);
  });

  it('removes peers and resets', () => {
    const s = useSessionStore.getState();
    s.addPeer({ id: 'p1', info: { name: 'Alice' }, isHost: false });
    s.removePeer('p1');
    expect(useSessionStore.getState().peers.p1).toBeUndefined();

    s.setSelf('me', { name: 'B' });
    s.setTransport({ bpm: 120, bar: 1, beat: 1 });
    useSessionStore.getState().reset();
    const st = useSessionStore.getState();
    expect(st.self).toBeNull();
    expect(st.transport).toBeNull();
    expect(Object.keys(st.peers)).toHaveLength(0);
  });
});
