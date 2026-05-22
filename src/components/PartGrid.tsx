import { usePartsStore } from '../store/parts.ts';
import { PartTile } from './PartTile.tsx';

export function PartGrid() {
  const parts = usePartsStore((s) => s.parts);
  const selectedPartId = usePartsStore((s) => s.selectedPartId);
  const activePartId = usePartsStore((s) => s.activePartId);
  const selectPart = usePartsStore((s) => s.selectPart);

  return (
    <div className="grid grid-cols-4 gap-2">
      {parts.map((part) => (
        <PartTile
          key={part.id}
          part={part}
          selected={part.id === selectedPartId}
          active={part.id === activePartId}
          onSelect={selectPart}
        />
      ))}
    </div>
  );
}
