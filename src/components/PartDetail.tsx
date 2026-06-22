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

export function PartDetail({
  part,
  hydrated,
  editable,
  onRename,
}: PartDetailProps) {
  // null oscType (e.g. a remote peer's partial data) must show '—', not osc #1:
  // oscByRaw(0) resolves to the first oscillator, so guard before looking up.
  const osc = part.oscType !== null ? oscByRaw(part.oscType) : null;
  const name =
    part.customName ?? osc?.name ?? `Part ${String(part.id).padStart(2, '0')}`;
  const steps = part.steps.slice(0, 16);

  return (
    <section className="card-acid flex flex-col gap-4 bg-bg-2 p-5">
      <div className="flex items-center gap-3">
        <span
          className="size-[18px] rounded border-2 border-black"
          style={{ background: part.color }}
        />
        <span className="font-display text-2xl font-extrabold tracking-[-0.01em] text-text">
          {name}
        </span>
        <span className="ml-auto text-[10px] tracking-[0.18em] text-text-dim">
          DÉTAIL
        </span>
      </div>

      {editable && onRename && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-dim">Nom (local)</span>
          <input
            value={part.customName ?? ''}
            maxLength={32}
            placeholder={`Part ${part.id}`}
            onChange={(e) => onRename(part.id, e.target.value)}
            className="rounded-md border-2 border-black bg-bg-3 px-3 py-2 text-text outline-none focus:border-blue"
          />
        </label>
      )}

      {hydrated ? (
        <>
          {steps.length > 0 && (
            <div className="flex gap-1">
              {steps.map((on, i) => (
                <span
                  key={i}
                  className="h-[26px] flex-1 rounded border-[1.5px] border-black"
                  style={{
                    background: on ? part.color : '#000',
                    boxShadow: on ? `0 0 8px -1px ${part.color}` : 'none',
                  }}
                />
              ))}
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <Item
              k="Oscillateur"
              v={
                osc
                  ? `${osc.name}${part.oscType !== null ? ' #' + part.oscType : ''}`
                  : '—'
              }
            />
            <Item k="Catégorie" v={osc?.category ?? '—'} />
            <Item
              k="Voice"
              v={
                part.voiceAssign !== null
                  ? (VOICE_ASSIGN[part.voiceAssign] ?? String(part.voiceAssign))
                  : '—'
              }
            />
            <Item k="Filter type" v={part.filterType ?? '—'} />
            <Item k="IFX type" v={part.ifxType ?? '—'} />
            <Item k="Last step" v={part.lastStep ?? '—'} />
          </dl>
        </>
      ) : (
        <p className="text-xs text-text-muted">
          Connecte la machine pour hydrater les params depuis le pattern courant.
        </p>
      )}
    </section>
  );
}

function Item({ k, v }: { k: string; v: string | number }) {
  return (
    <>
      <dt className="text-text-dim">{k}</dt>
      <dd className="text-right text-text">{v}</dd>
    </>
  );
}
