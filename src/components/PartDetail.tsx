import { usePartsStore } from '../store/parts.ts';
import { useCurrentPatternStore } from '../store/currentPattern.ts';
import { partColor } from '../lib/colors.ts';
import { oscByRaw } from '../data/oscillators.ts';

const VOICE_ASSIGN = ['Mono1', 'Mono2', 'Poly1', 'Poly2'];

export function PartDetail() {
  const selectedPartId = usePartsStore((s) => s.selectedPartId);
  const part = usePartsStore((s) =>
    s.parts.find((p) => p.id === s.selectedPartId),
  );
  const setMetadata = usePartsStore((s) => s.setMetadata);
  const parsed = useCurrentPatternStore(
    (s) => s.pattern?.parts[selectedPartId - 1] ?? null,
  );

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

      {parsed ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-text-dim">Oscillateur</dt>
          <dd className="text-right text-text">
            {oscByRaw(parsed.oscType)?.name ?? '—'}
            <span className="ml-1 text-text-muted">#{parsed.oscType}</span>
          </dd>
          <dt className="text-text-dim">Catégorie</dt>
          <dd className="text-right text-text">
            {oscByRaw(parsed.oscType)?.category ?? '—'}
          </dd>
          <dt className="text-text-dim">Voice</dt>
          <dd className="text-right text-text">
            {VOICE_ASSIGN[parsed.voiceAssign] ?? parsed.voiceAssign}
          </dd>
          <dt className="text-text-dim">Filter type</dt>
          <dd className="text-right text-text">{parsed.filterType}</dd>
          <dt className="text-text-dim">IFX type</dt>
          <dd className="text-right text-text">{parsed.ifxType}</dd>
          <dt className="text-text-dim">Last step</dt>
          <dd className="text-right text-text">{parsed.lastStep}</dd>
          <dt className="text-text-dim">Mute</dt>
          <dd className="text-right text-text">{parsed.mute ? 'On' : 'Off'}</dd>
        </dl>
      ) : (
        <p className="text-xs text-text-muted">
          Connecte la machine pour hydrater les params depuis le pattern courant.
        </p>
      )}
    </div>
  );
}
