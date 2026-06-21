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
    if (!transport) return;
    const cue = buildCue(kind, transport.bar + 1);
    sendCue(cue); // to peers (no-op when solo)
    addCue({ cue, peer: selfId }); // optimistic local feedback
  };

  const senderName = (peer: string) =>
    peer === selfId || peer === 'local'
      ? 'toi'
      : (peers[peer]?.info.name ?? peer);

  const live = cues
    .map((c) => ({ ...c, status: cueStatus(c.cue, currentBar) }))
    .filter((c) => c.status !== 'expired')
    .sort((a, b) => a.cue.landAtBar - b.cue.landAtBar);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-bg-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-dim">
          Cues
        </h2>
        {!canFire && (
          <span className="text-[10px] text-text-muted">
            lance la lecture pour signaler
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {CUE_ORDER.map((kind) => (
          <button
            key={kind}
            onClick={() => fire(kind)}
            disabled={!canFire}
            className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-blue hover:text-blue disabled:opacity-40 disabled:hover:border-line disabled:hover:text-text"
          >
            {CUE_LABELS[kind]}
          </button>
        ))}
      </div>

      {live.length > 0 && (
        <ul className="flex flex-col gap-2">
          {live.map(({ cue, peer, status }) => {
            const active = status === 'active';
            const barsAway = cue.landAtBar - currentBar;
            return (
              <li
                key={cue.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  active
                    ? 'animate-pulse border-green bg-green/20'
                    : 'border-line bg-bg-3'
                }`}
              >
                <span className="flex items-baseline gap-2">
                  <span
                    className={`text-sm font-bold ${active ? 'text-green' : 'text-text'}`}
                  >
                    {CUE_LABELS[cue.kind]}
                  </span>
                  <span className="text-xs text-text-dim">
                    {senderName(peer)}
                  </span>
                </span>
                <span
                  className={`text-xs font-medium ${active ? 'text-green' : 'text-text-dim'}`}
                >
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
    </div>
  );
}
