import { useEffect, useRef } from 'react';
import { useSharedTransport } from '../model/useClock.ts';
import { useCueStore } from '../store/cues.ts';
import { useSessionStore } from '../store/session.ts';
import {
  buildCue,
  cueStatus,
  CUE_LABELS,
  CUE_ORDER,
  type CueKind,
} from '../model/cues.ts';
import { sendCue } from '../net/sessionLink.ts';
import { CUE_COLORS } from './cueColors.ts';

export function CueDeck() {
  const transport = useSharedTransport();
  const cues = useCueStore((s) => s.cues);
  const addCue = useCueStore((s) => s.add);
  const pruneCues = useCueStore((s) => s.prune);
  const clearCues = useCueStore((s) => s.clear);
  const self = useSessionStore((s) => s.self);
  const peers = useSessionStore((s) => s.peers);

  const currentBar = transport?.bar ?? 0;
  const running = transport?.running ?? false;
  const canFire = transport !== null && running;
  const selfId = self?.id ?? 'local';

  // landAtBar is an absolute bar, but the counter rewinds to 1 on Start; clear
  // cues when the timeline stops or rewinds so none are stranded, and drop those
  // whose bar has passed as the shared bar advances.
  const lastBar = useRef<number | null>(null);
  useEffect(() => {
    if (!running) {
      if (useCueStore.getState().cues.length) clearCues();
      lastBar.current = null;
      return;
    }
    if (lastBar.current !== null && currentBar < lastBar.current) clearCues();
    lastBar.current = currentBar;
    pruneCues(currentBar);
  }, [running, currentBar, pruneCues, clearCues]);

  const fire = (kind: CueKind) => {
    if (!transport || !transport.running) return;
    const cue = buildCue(kind, transport.bar + 1);
    sendCue(cue); // to peers (no-op when solo)
    addCue({ cue, peer: selfId }); // optimistic local feedback
  };

  // Keyboard shortcuts 1–5 fire the cues, hands-free from the machine. A ref
  // keeps the listener bound once while always calling the latest `fire`.
  const fireRef = useRef(fire);
  fireRef.current = fire;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        return;
      }
      const idx = Number(e.key) - 1;
      if (Number.isInteger(idx) && idx >= 0 && idx < CUE_ORDER.length) {
        fireRef.current(CUE_ORDER[idx]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const senderName = (peer: string) =>
    peer === selfId || peer === 'local'
      ? 'toi'
      : (peers[peer]?.info.name ?? peer);

  const live = cues
    .map((c) => ({ ...c, status: cueStatus(c.cue, currentBar) }))
    .filter((c) => c.status !== 'expired')
    .sort((a, b) => a.cue.landAtBar - b.cue.landAtBar);

  // What state each deck button reflects (its own cue armed/landing).
  const stateByKind = new Map<CueKind, 'pending' | 'active'>();
  for (const c of live) {
    const prev = stateByKind.get(c.cue.kind);
    if (c.status === 'active') stateByKind.set(c.cue.kind, 'active');
    else if (prev !== 'active') stateByKind.set(c.cue.kind, 'pending');
  }

  return (
    <section className="card-acid flex flex-col gap-3.5 bg-bg-2 p-[18px]">
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold text-text">
          CUE DECK
        </span>
        <span className="text-[10px] tracking-[0.18em] text-text-dim">
          {canFire ? 'TAP → DOWNBEAT' : 'LANCE LA LECTURE'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {CUE_ORDER.map((kind, i) => {
          const color = CUE_COLORS[kind];
          const st = stateByKind.get(kind);
          const filled = st !== undefined;
          const now = st === 'active';
          return (
            <button
              key={kind}
              onClick={() => fire(kind)}
              disabled={!canFire}
              title={`Raccourci : ${i + 1}`}
              className={`btn-acid flex flex-col items-start gap-1 px-3.5 py-3 ${
                now || st === 'pending' ? 'animate-blink' : ''
              }`}
              style={{
                background: filled ? color : '#0d0d10',
                color: filled ? '#0a0a0b' : 'var(--color-text)',
              }}
            >
              <span className="font-display text-[17px] font-extrabold tracking-[0.01em]">
                {CUE_LABELS[kind]}
              </span>
              <span className="text-[9px] tracking-[0.16em] opacity-80">
                {now ? '▶ NOW' : st === 'pending' ? '◷ ARMÉ' : `TAP · ${i + 1}`}
              </span>
            </button>
          );
        })}
      </div>

      {live.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {live.map(({ cue, peer, status }) => {
            const active = status === 'active';
            const barsAway = cue.landAtBar - currentBar;
            return (
              <li
                key={cue.id}
                className="flex items-center justify-between rounded-lg border-2 border-black px-3 py-1.5 text-xs"
                style={{
                  background: active ? CUE_COLORS[cue.kind] : '#0d0d10',
                  color: active ? '#0a0a0b' : 'var(--color-text)',
                }}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-bold">{CUE_LABELS[cue.kind]}</span>
                  <span className={active ? 'opacity-70' : 'text-text-dim'}>
                    {senderName(peer)}
                  </span>
                </span>
                <span className="font-medium">
                  {active
                    ? 'MAINTENANT'
                    : barsAway === 1
                      ? 'mesure prochaine'
                      : `dans ${barsAway} mesures`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
