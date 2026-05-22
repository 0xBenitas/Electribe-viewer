import type { PartMeta } from '../store/parts.ts';
import { partColor } from '../lib/colors.ts';

interface PartTileProps {
  part: PartMeta;
  selected: boolean;
  active: boolean;
  onSelect: (id: number) => void;
}

export function PartTile({ part, selected, active, onSelect }: PartTileProps) {
  const color = part.customColor ?? partColor(part.id);
  return (
    <button
      onClick={() => onSelect(part.id)}
      className={`relative flex aspect-square flex-col items-start justify-between rounded-lg border bg-bg-2 p-2 text-left transition-colors ${
        selected ? 'border-blue' : 'border-line hover:border-line-bright'
      }`}
    >
      <span
        className="size-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-text-dim">
        {String(part.id).padStart(2, '0')}
      </span>
      <span className="w-full truncate text-sm text-text">
        {part.customName ?? `Part ${part.id}`}
      </span>
      {active && (
        <span className="absolute right-1 top-1 rounded bg-green/20 px-1 text-[10px] font-bold text-green">
          ACTIVE
        </span>
      )}
    </button>
  );
}
