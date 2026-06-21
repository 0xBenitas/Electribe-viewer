import { useEffect } from 'react';
import { useSharedTransport } from '../model/useClock.ts';

const BEATS_PER_BAR = 4;

/** Fullscreen, projectable bar/beat lighthouse. Esc or the button closes it. */
export function LighthouseOverlay({ onClose }: { onClose: () => void }) {
  const t = useSharedTransport();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-bg">
      <button
        onClick={onClose}
        className="absolute right-6 top-6 rounded-md border border-line bg-bg-3 px-3 py-1.5 text-sm text-text-dim hover:text-text"
      >
        Fermer (Esc)
      </button>

      {t ? (
        <>
          <div className="text-center">
            <div className="font-mono text-[12vw] font-bold leading-none text-text">
              {String(t.bar).padStart(2, '0')}
            </div>
            <div className="mt-2 text-xl uppercase tracking-widest text-text-dim">
              mesure
            </div>
          </div>

          <div className="flex items-center gap-6">
            {Array.from({ length: BEATS_PER_BAR }, (_, i) => {
              const active = i + 1 === t.beat && t.running;
              return (
                <span
                  key={i}
                  className={`rounded-full transition-colors ${
                    active ? 'bg-green' : 'bg-line'
                  }`}
                  style={{ width: '6vw', height: '6vw' }}
                />
              );
            })}
          </div>

          <div className="text-2xl text-text-dim">
            {t.bpm !== null ? t.bpm.toFixed(0) : '—'} BPM
            {!t.running && <span className="ml-3 text-yellow">arrêté</span>}
          </div>
        </>
      ) : (
        <div className="text-2xl text-text-muted">
          En attente d'une horloge…
        </div>
      )}
    </div>
  );
}
