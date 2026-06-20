import { useSharedTransport } from '../model/useClock.ts';

const BEATS_PER_BAR = 4;

export function TransportBar() {
  const t = useSharedTransport();

  if (!t || (!t.running && t.bpm === null)) {
    return (
      <div className="rounded-lg border border-line bg-bg-2 px-4 py-3 text-xs text-text-muted">
        Transport : en attente d'une horloge MIDI (lance la lecture sur la
        machine hôte).
      </div>
    );
  }

  return (
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
    </div>
  );
}
