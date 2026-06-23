import type { MachinePart } from '../model/machine.ts';
import { PartTile } from './PartTile.tsx';

interface PartGridProps {
  parts: MachinePart[];
  selectedPartId: number;
  activePartId: number | null;
  onSelect?: (id: number) => void;
}

export function PartGrid({
  parts,
  selectedPartId,
  activePartId,
  onSelect,
}: PartGridProps) {
  return (
    <section className="card-acid bg-bg-2 p-[18px]">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="font-display text-base font-bold text-text">
          MACHINES{' '}
          <span className="font-mono text-xs font-medium text-text-dim">
            / {parts.length} PISTES
          </span>
        </span>
        <span className="text-[10px] tracking-[0.18em] text-text-dim">
          TAP = SÉLECTION · ◼ = COUPÉ
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {parts.map((part) => (
          <PartTile
            key={part.id}
            part={part}
            selected={part.id === selectedPartId}
            active={part.id === activePartId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
