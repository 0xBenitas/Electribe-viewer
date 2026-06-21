import { useState } from 'react';
import { useSharedTransport } from '../model/useClock.ts';
import { LighthouseOverlay } from './LighthouseOverlay.tsx';

const BEATS_PER_BAR = 4;

export function TransportBar() {
  const t = useSharedTransport();
  const [expanded, setExpanded] = useState(false);
  const overlay = expanded ? (
    <LighthouseOverlay onClose={() => setExpanded(false)} />
  ) : null;

  const fullscreenButton = (
    <button
      onClick={() => setExpanded(true)}
      title="Phare plein écran"
      className="ml-auto rounded-md border border-line bg-bg-3 px-2 py-1 text-xs text-text-dim hover:text-text"
    >
      ⛶ plein écran
    </button>
  );

  if (!t || (!t.running && t.bpm === null)) {
    return (
      <>
        {overlay}
        <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-2 px-4 py-3 text-xs text-text-muted">
          <span>
            Transport : en attente d'une horloge MIDI (lance la lecture sur la
            machine hôte).
          </span>
          {fullscreenButton}
        </div>
      </>
    );
  }

  return (
    <>
      {overlay}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-bg-2 px-4 py-3">
        <span className="font-mono text-lg font-bold text-text">
          {t.bpm !== null ? t.bpm.toFixed(1) : '—'}
          <span className="ml-1 text-xs font-normal text-text-dim">BPM</span>
        </span>
        <span className="text-sm text-text-dim">
          mesure {t.bar} · temps {t.beat}
        </span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: BEATS_PER_BAR }, (_, i) => {
            const active = i + 1 === t.beat && t.running;
            return (
              <span
                key={i}
                className={`size-3 rounded-full transition-colors ${
                  active ? 'bg-green' : 'bg-line'
                }`}
              />
            );
          })}
        </div>
        {t.source === 'remote' && (
          <span className="text-[10px] uppercase tracking-wide text-text-dim">
            synchro hôte
          </span>
        )}
        {!t.running && <span className="text-xs text-yellow">arrêté</span>}
        {fullscreenButton}
      </div>
    </>
  );
}
