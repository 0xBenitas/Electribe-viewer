import type { MachinePart } from '../model/machine.ts';
import { oscByRaw } from '../data/oscillators.ts';

interface PartTileProps {
  part: MachinePart;
  selected: boolean;
  active: boolean;
  /** Omitted = not selectable (e.g. a remote peer's machine). */
  onSelect?: (id: number) => void;
}

export function PartTile({ part, selected, active, onSelect }: PartTileProps) {
  const osc = part.oscType !== null ? oscByRaw(part.oscType) : null;
  const label = part.customName ?? osc?.name ?? '—';
  return (
    <button
      onClick={() => onSelect?.(part.id)}
      title={osc ? `${osc.name} — ${osc.category}` : `Part ${part.id}`}
      className={`relative flex aspect-square flex-col justify-between overflow-hidden rounded-lg border p-2 text-left transition-all ${
        selected
          ? 'border-blue bg-bg-3 ring-1 ring-blue'
          : 'border-line bg-bg-2 hover:border-line-bright'
      } ${part.muted ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded px-1 font-mono text-[11px] font-bold ${
            active ? 'bg-green/20 text-green' : 'text-text-dim'
          }`}
        >
          {String(part.id).padStart(2, '0')}
        </span>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: part.color }}
        />
      </div>

      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium leading-tight text-text">
          {label}
        </div>
        {osc && (
          <div className="truncate text-[10px] uppercase tracking-wide text-text-muted">
            {osc.category}
          </div>
        )}
      </div>

      {part.muted && (
        <span className="absolute bottom-1 right-1 text-[9px] font-bold text-red">
          MUTE
        </span>
      )}
    </button>
  );
}
