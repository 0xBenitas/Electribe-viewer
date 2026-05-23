import { usePartsStore } from '../store/parts.ts';
import { useCurrentPatternStore } from '../store/currentPattern.ts';
import { PartTile } from './PartTile.tsx';

export function PartGrid() {
  const parts = usePartsStore((s) => s.parts);
  const selectedPartId = usePartsStore((s) => s.selectedPartId);
  const activePartId = usePartsStore((s) => s.activePartId);
  const selectPart = usePartsStore((s) => s.selectPart);
  const pattern = useCurrentPatternStore((s) => s.pattern);

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
            oscType={pattern?.parts[part.id - 1]?.oscType ?? null}
            muted={pattern?.parts[part.id - 1]?.mute ?? false}
            selected={part.id === selectedPartId}
            active={part.id === activePartId}
            onSelect={selectPart}
          />
        ))}
      </div>
    </section>
  );
}
