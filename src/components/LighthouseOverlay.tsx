import { useEffect } from 'react';
import { useSharedTransport } from '../model/useClock.ts';

const BEATS_PER_BAR = 4;

interface Props {
  onClose: () => void;
  /** Projected big (Bastien's choice: part name + measure). */
  name?: string;
  kind?: string;
  color?: string;
}

/** Fullscreen, projectable phare: the part in focus huge, the live measure
 *  underneath. Click or Esc closes it. Ultra-contrasted for the stage. */
export function LighthouseOverlay({ onClose, name, kind, color = '#ff6b35' }: Props) {
  const t = useSharedTransport();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center overflow-hidden bg-[#050505]"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="animate-sweep rounded-full"
          style={{
            width: '140vmin',
            height: '140vmin',
            background: `conic-gradient(from 0deg, ${color}44, transparent 18%, transparent 82%, ${color}44)`,
          }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-55">
        <div
          className="animate-spin-slow rounded-full"
          style={{ width: '62vmin', height: '62vmin', border: `3px solid ${color}` }}
        />
      </div>

      <div className="relative z-[2] px-6 text-center">
        <div className="mb-6 text-[13px] uppercase tracking-[0.4em] text-text-dim">
          Le phare
        </div>
        <div
          className="mx-auto mb-8 size-[110px] rounded-full border-4 border-black"
          style={{ background: color, boxShadow: `0 0 0 6px #050505, 0 0 70px ${color}` }}
        />
        <div
          className="font-display font-extrabold leading-[0.84] tracking-[-0.03em] text-white"
          style={{ fontSize: 'clamp(60px,13vw,150px)', textShadow: '5px 5px 0 #000' }}
        >
          {name ?? (t ? 'EN JEU' : '—')}
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-4 text-base uppercase tracking-[0.2em]">
          {kind && <span style={{ color }}>{kind}</span>}
          {kind && <span className="size-2 rounded-full bg-line-bright" />}
          <span className="text-text-dim">
            {t?.bpm != null ? t.bpm.toFixed(0) : '—'} BPM
          </span>
          <span className="size-2 rounded-full bg-line-bright" />
          <span className="text-text-dim">
            MESURE {t ? String(t.bar).padStart(3, '0') : '—'}:{t ? t.beat : '—'}
          </span>
        </div>

        <div className="mt-8 flex items-center justify-center gap-5">
          {Array.from({ length: BEATS_PER_BAR }, (_, i) => {
            const active = t != null && i + 1 === t.beat && t.running;
            return (
              <span
                key={i}
                className="rounded-full border-2 border-black"
                style={{
                  width: '3.4vw',
                  height: '3.4vw',
                  background: active ? color : '#26262c',
                  boxShadow: active ? `0 0 24px ${color}` : 'none',
                }}
              />
            );
          })}
        </div>

        <div className="mt-10 text-[11px] uppercase tracking-[0.24em] text-text-muted">
          Clic ou Échap pour fermer
        </div>
      </div>
    </div>
  );
}
