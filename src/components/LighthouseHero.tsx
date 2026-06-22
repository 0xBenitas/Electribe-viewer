import type { Machine } from '../model/machine.ts';
import { useSharedTransport } from '../model/useClock.ts';
import { oscByRaw } from '../data/oscillators.ts';

/** The hero "phare": acid sweep centred on the part in focus, with the live
 *  measure underneath (Bastien's choice: part name + measure). Opens the
 *  projectable fullscreen overlay. */
export function LighthouseHero({
  machine,
  onFullscreen,
}: {
  machine: Machine | null;
  onFullscreen: () => void;
}) {
  const t = useSharedTransport();
  const part =
    machine && machine.parts.length > 0
      ? (machine.parts.find((p) => p.id === machine.selectedPartId) ??
        machine.parts[0]!)
      : null;
  const osc = part && part.oscType !== null ? oscByRaw(part.oscType) : null;
  const name = part
    ? (part.customName ?? osc?.name ?? `Part ${String(part.id).padStart(2, '0')}`)
    : t
      ? 'EN JEU'
      : '—';
  const kind = part ? (osc?.category ?? machine?.model ?? '') : null;
  const color = part?.color ?? '#ff6b35';
  const pattern = machine?.pattern?.name;

  return (
    <section
      className="card-acid relative flex min-h-[330px] flex-col overflow-hidden p-5"
      style={{
        background: 'radial-gradient(120% 90% at 50% 0%, #1a1320 0%, #0e0e12 60%)',
      }}
    >
      <div className="relative z-[2] flex items-center justify-between">
        <span className="text-[10px] tracking-[0.32em] text-text-dim">
          LE PHARE · EN COURS
        </span>
        <span className="text-[10px] tracking-[0.2em] text-cyan">
          ● PROJETABLE
        </span>
      </div>

      {/* acid sweep */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <div
          className="animate-sweep size-[300px] rounded-full opacity-85"
          style={{
            background: `conic-gradient(from 0deg, ${color}55, transparent 22%, transparent 78%, ${color}55)`,
          }}
        />
      </div>
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-50">
        <div
          className="animate-spin-slow size-[170px] rounded-full"
          style={{ border: `2px solid ${color}` }}
        />
      </div>

      <div className="relative z-[2] flex flex-1 flex-col items-center justify-center py-3.5 text-center">
        <div
          className="mb-4 size-[74px] rounded-full border-[3px] border-black"
          style={{ background: color, boxShadow: `0 0 0 4px #0a0a0b, 0 0 34px ${color}` }}
        />
        <div
          className="font-display text-[44px] font-extrabold leading-[0.92] tracking-[-0.02em] text-white"
          style={{ textShadow: '3px 3px 0 #000' }}
        >
          {name}
        </div>
        <div className="mt-2.5 text-xs tracking-[0.2em] text-text-dim">
          {kind || 'CONNECTE TA MACHINE'}
          {t && (
            <>
              {' · '}
              {t.bpm != null ? t.bpm.toFixed(0) : '—'} BPM ·{' '}
              {String(t.bar).padStart(3, '0')}:{t.beat}
            </>
          )}
          {pattern && <> · {pattern}</>}
        </div>
      </div>

      <button
        onClick={onFullscreen}
        className="btn-acid relative z-[2] self-center bg-bg-2 px-4 py-2 text-[11px] font-bold tracking-[0.14em] text-yellow"
        style={{ borderWidth: '2px', borderRadius: '11px', boxShadow: '3px 3px 0 #000' }}
      >
        PLEIN ÉCRAN ⤢
      </button>
    </section>
  );
}
