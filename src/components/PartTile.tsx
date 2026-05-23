import type { PartMeta } from '../store/parts.ts';
import { partColor } from '../lib/colors.ts';
import { oscByRaw } from '../data/oscillators.ts';

interface PartTileProps {
  part: PartMeta;
  oscType: number | null;
  muted: boolean;
  selected: boolean;
  active: boolean;
  onSelect: (id: number) => void;
}

export function PartTile({
  part,
  oscType,
  muted,
  selected,
  active,
  onSelect,
}: PartTileProps) {
  const color = part.customColor ?? partColor(part.id);
  const osc = oscType !== null ? oscByRaw(oscType) : null;
  return (
    <button
      onClick={() => onSelect(part.id)}
      className={`relative flex aspect-square flex-col items-start justify-between rounded-lg border bg-bg-2 p-2 text-left transition-colors ${
        selected ? 'border-blue' : 'border-line hover:border-line-bright'
      } ${muted ? 'opacity-50' : ''}`}
    >
      <span
        className="size-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-text-dim">
        {String(part.id).padStart(2, '0')}
        {osc && (
          <span className="ml-1 text-text-muted">{osc.category}</span>
        )}
      </span>
      <span className="w-full truncate text-sm text-text">
        {part.customName ?? osc?.name ?? `Part ${part.id}`}
      </span>
      {active && (
        <span className="absolute right-1 top-1 rounded bg-green/20 px-1 text-[10px] font-bold text-green">
          ACTIVE
        </span>
      )}
      {muted && (
        <span className="absolute bottom-1 right-1 text-[10px] font-bold text-red">
          MUTE
        </span>
      )}
    </button>
  );
}
