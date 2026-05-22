import { usePartsStore } from '../store/parts.ts';
import { partColor } from '../lib/colors.ts';

export function PartDetail() {
  const selectedPartId = usePartsStore((s) => s.selectedPartId);
  const part = usePartsStore((s) =>
    s.parts.find((p) => p.id === s.selectedPartId),
  );
  const setMetadata = usePartsStore((s) => s.setMetadata);

  if (!part) return null;
  const color = part.customColor ?? partColor(part.id);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-bg-2 p-4">
      <div className="flex items-center gap-2">
        <span
          className="size-4 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h2 className="text-lg font-bold text-text">
          Part {String(selectedPartId).padStart(2, '0')}
        </h2>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-dim">Nom (local)</span>
        <input
          value={part.customName ?? ''}
          maxLength={32}
          placeholder={`Part ${part.id}`}
          onChange={(e) =>
            setMetadata(part.id, { customName: e.target.value })
          }
          className="rounded-md border border-line bg-bg-3 px-3 py-2 text-text outline-none focus:border-blue"
        />
      </label>

      <p className="text-xs text-text-muted">
        Les paramètres temps réel (Cutoff, Reso, etc.) arriveront en Phase 3, et
        l'hydratation depuis la machine en Phase 4.
      </p>
    </div>
  );
}
