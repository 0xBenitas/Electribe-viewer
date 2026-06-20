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
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-text-dim">
        Parts
      </h2>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
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
