import type { MachinePart } from '../model/machine.ts';
import { oscByRaw } from '../data/oscillators.ts';

const VOICE_ASSIGN = ['Mono1', 'Mono2', 'Poly1', 'Poly2'];

interface PartDetailProps {
  part: MachinePart;
  /** Pattern is hydrated → the descriptive fields are meaningful. */
  hydrated: boolean;
  editable: boolean;
  onRename?: (id: number, name: string) => void;
}

export function PartDetail({ part, hydrated, editable, onRename }: PartDetailProps) {
  // null oscType (e.g. a remote peer's partial data) must show '—', not osc #1:
  // oscByRaw(0) resolves to the first oscillator, so guard before looking up.
  const osc = part.oscType !== null ? oscByRaw(part.oscType) : null;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-bg-2 p-4">
      <div className="flex items-center gap-2">
        <span
          className="size-4 rounded-full"
          style={{ backgroundColor: part.color }}
        />
        <h2 className="text-lg font-bold text-text">
          Part {String(part.id).padStart(2, '0')}
        </h2>
      </div>

      {editable && onRename && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-dim">Nom (local)</span>
          <input
            value={part.customName ?? ''}
            maxLength={32}
            placeholder={`Part ${part.id}`}
            onChange={(e) => onRename(part.id, e.target.value)}
            className="rounded-md border border-line bg-bg-3 px-3 py-2 text-text outline-none focus:border-blue"
          />
        </label>
      )}

      {hydrated ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-text-dim">Oscillateur</dt>
          <dd className="text-right text-text">
            {osc?.name ?? '—'}
            {part.oscType !== null && (
              <span className="ml-1 text-text-muted">#{part.oscType}</span>
            )}
          </dd>
          <dt className="text-text-dim">Catégorie</dt>
          <dd className="text-right text-text">{osc?.category ?? '—'}</dd>
          <dt className="text-text-dim">Voice</dt>
          <dd className="text-right text-text">
            {part.voiceAssign !== null
              ? (VOICE_ASSIGN[part.voiceAssign] ?? part.voiceAssign)
              : '—'}
          </dd>
          <dt className="text-text-dim">Filter type</dt>
          <dd className="text-right text-text">{part.filterType ?? '—'}</dd>
          <dt className="text-text-dim">IFX type</dt>
          <dd className="text-right text-text">{part.ifxType ?? '—'}</dd>
          <dt className="text-text-dim">Last step</dt>
          <dd className="text-right text-text">{part.lastStep ?? '—'}</dd>
          <dt className="text-text-dim">Mute</dt>
          <dd className="text-right text-text">{part.muted ? 'On' : 'Off'}</dd>
        </dl>
      ) : (
        <p className="text-xs text-text-muted">
          Connecte la machine pour hydrater les params depuis le pattern courant.
        </p>
      )}
    </div>
  );
}
