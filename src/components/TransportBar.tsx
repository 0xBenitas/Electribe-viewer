import { useSharedTransport } from '../model/useClock.ts';

const BEATS_PER_BAR = 4;

/** Compact transport: giant BPM, measure/beat, beat dots. No play control —
 *  the clock is driven by the hardware sequencer (F8); we mirror its state. */
export function TransportBar({ onFullscreen }: { onFullscreen: () => void }) {
  const t = useSharedTransport();
  const running = t?.running ?? false;
  const hasClock = t != null;

  return (
    <section className="card-acid flex flex-wrap items-center gap-x-6 gap-y-3 bg-bg-2 px-5 py-4">
      <span
        className={`pill-acid flex items-center gap-2 px-3.5 py-2 text-[11px] font-bold tracking-[0.16em] ${
          running ? 'bg-green/15 text-green' : 'bg-bg-3 text-text-dim'
        }`}
      >
        <span
          className={`size-2.5 rounded-full ${running ? 'animate-blink bg-green' : 'bg-line-bright'}`}
          style={running ? { boxShadow: '0 0 10px var(--color-green)' } : undefined}
        />
        {running ? 'EN LECTURE' : hasClock ? 'ARRÊTÉ' : 'EN ATTENTE'}
      </span>

      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[56px] font-extrabold leading-none tracking-[-0.03em] text-orange">
          {t?.bpm != null ? t.bpm.toFixed(0) : '—'}
        </span>
        <span className="text-[11px] tracking-[0.2em] text-text-dim">BPM</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-text">
            {t ? String(t.bar).padStart(3, '0') : '—'}
          </span>
          <span className="text-sm text-text-dim">: {t ? t.beat : '—'}</span>
          <span className="ml-1 text-[10px] tracking-[0.2em] text-text-dim">
            MESURE · TEMPS
          </span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: BEATS_PER_BAR }, (_, i) => {
            const active = t != null && i + 1 === t.beat && running;
            return (
              <span
                key={i}
                className="size-3 rounded-full border-2 border-black"
                style={{
                  background: active ? 'var(--color-orange)' : '#26262c',
                  boxShadow: active ? '0 0 12px var(--color-orange)' : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      {t?.source === 'remote' && (
        <span className="text-[10px] uppercase tracking-wide text-cyan">
          synchro hôte
        </span>
      )}

      <button
        onClick={onFullscreen}
        className="btn-acid ml-auto flex items-center gap-2 bg-yellow px-4 py-2.5 text-[#1a1405]"
      >
        <span
          className="inline-block size-4 rounded-full border-[3px] border-[#1a1405]"
          style={{ boxShadow: '0 0 0 3px #ffd43b, 0 0 0 5px #1a1405' }}
        />
        <span className="text-xs font-bold tracking-[0.1em]">PROJET PHARE</span>
      </button>
    </section>
  );
}
