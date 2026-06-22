import type { MachinePart } from '../model/machine.ts';
import { oscByRaw } from '../data/oscillators.ts';

interface PartTileProps {
  part: MachinePart;
  selected: boolean;
  active: boolean;
  /** Omitted = not selectable (e.g. a remote peer's machine). */
  onSelect?: (id: number) => void;
}

/** A part tile: colour, real step on/off (parser data), level. Mute is a
 *  read-only indicator (◼) — mute lives on the hardware, not driven here. */
export function PartTile({ part, selected, active, onSelect }: PartTileProps) {
  const osc = part.oscType !== null ? oscByRaw(part.oscType) : null;
  const label =
    part.customName ?? osc?.name ?? `P${String(part.id).padStart(2, '0')}`;
  const steps = part.steps.slice(0, 16);
  const level = part.level != null ? Math.round((part.level / 127) * 100) : 0;
  const dim = part.muted;

  return (
    <button
      onClick={() => onSelect?.(part.id)}
      title={osc ? `${osc.name} — ${osc.category}` : `Part ${part.id}`}
      className="flex flex-col rounded-[14px] border-[3px] border-black p-3 text-left transition-[box-shadow,background] duration-100"
      style={{
        background: selected ? '#1a1620' : '#0d0d10',
        boxShadow: selected ? `4px 4px 0 ${part.color}` : '3px 3px 0 #000',
        opacity: dim ? 0.6 : 1,
        cursor: onSelect ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="inline-block size-3.5 rounded border-2 border-black"
          style={{ background: part.color }}
        />
        <span
          className={`text-[11px] font-bold leading-none ${
            active ? 'text-green' : 'text-text-muted'
          }`}
        >
          {part.muted ? '◼' : active ? '●' : String(part.id).padStart(2, '0')}
        </span>
      </div>

      <div
        className="mt-2 truncate font-display text-[17px] font-bold leading-tight"
        style={{ color: dim ? '#5a5a60' : selected ? part.color : '#eceae6' }}
      >
        {label}
      </div>
      <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.16em] text-text-dim">
        {osc?.category ?? '—'}
      </div>

      {steps.length > 0 && (
        <div className="mt-2.5 flex gap-[3px]">
          {steps.map((on, i) => (
            <span
              key={i}
              className="h-3.5 flex-1 rounded-[2px] border border-black"
              style={{
                background: on && !dim ? part.color : '#000',
                boxShadow: on && !dim ? `0 0 7px -1px ${part.color}` : 'none',
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-2.5 h-[5px] overflow-hidden rounded-[3px] bg-black">
        <div
          className="h-full"
          style={{ width: `${dim ? 0 : level}%`, background: part.color }}
        />
      </div>
    </button>
  );
}
