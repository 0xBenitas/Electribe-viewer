import type { Machine, MachineActions } from '../model/machine.ts';
import { getProfile } from '../core/profiles/registry.ts';
import { KnobModeBadge } from './KnobModeBadge.tsx';
import { PatternInfo } from './PatternInfo.tsx';
import { PartGrid } from './PartGrid.tsx';
import { PartDetail } from './PartDetail.tsx';
import { ParamPanel } from './ParamPanel.tsx';

interface MachinePanelProps {
  machine: Machine;
  /** Provided only for the editable local machine; null for remote peers. */
  actions?: MachineActions | null;
}

/**
 * Renders one machine — local (editable) or a remote peer's (read-only) — from
 * the Machine read-model. Capability-driven: the rich per-part editor for
 * machines that expose it (Electribe), a lite panel otherwise (the machine still
 * takes part in tempo, presence, cues and audio).
 */
export function MachinePanel({ machine, actions }: MachinePanelProps) {
  return (
    <section className="card-acid flex flex-col gap-4 bg-bg-2 p-[18px]">
      <header className="flex items-baseline gap-2">
        <span
          className={`size-2.5 rounded-full ${machine.online ? 'bg-green' : 'bg-line-bright'}`}
          style={machine.online ? { boxShadow: '0 0 8px var(--color-green)' } : undefined}
        />
        <h2 className="font-display text-base font-bold text-text">
          {machine.label}
        </h2>
        <span className="text-xs text-text-muted">{machine.model}</span>
        {!machine.editable && (
          <span className="ml-auto text-[10px] uppercase tracking-wide text-cyan">
            lecture seule
          </span>
        )}
      </header>

      {machine.richEditor ? (
        <Editor machine={machine} actions={actions} />
      ) : (
        <LitePanel machine={machine} />
      )}
    </section>
  );
}

function Editor({ machine, actions }: MachinePanelProps) {
  const selectedPart =
    machine.parts.find((p) => p.id === machine.selectedPartId) ??
    machine.parts[0];

  return (
    <>
      {machine.editable && <KnobModeBadge knobMode={machine.knobMode} />}
      <PatternInfo pattern={machine.pattern} />
      <PartGrid
        parts={machine.parts}
        selectedPartId={machine.selectedPartId}
        activePartId={machine.activePartId}
        onSelect={actions?.selectPart}
      />
      <div className="grid items-start gap-6 md:grid-cols-2">
        {selectedPart && (
          <PartDetail
            part={selectedPart}
            hydrated={machine.pattern !== null}
            editable={machine.editable}
            onRename={actions?.rename}
          />
        )}
        <ParamPanel
          parts={machine.parts}
          activePartId={machine.activePartId}
          selectedPartId={machine.selectedPartId}
          editable={machine.editable}
          onSetParam={actions?.setParam}
        />
      </div>
    </>
  );
}

function LitePanel({ machine }: { machine: Machine }) {
  const profile = machine.profileId ? getProfile(machine.profileId) : null;
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border-2 border-black bg-bg-3 p-3 text-sm">
      {profile ? (
        <p className="text-text-dim">
          {profile.tracks.count} {profile.tracks.label}
          {profile.status === 'draft' && (
            <span className="ml-2 text-[10px] uppercase tracking-wide text-yellow">
              profil draft
            </span>
          )}
        </p>
      ) : (
        <p className="text-text-dim">
          Machine non reconnue — décris-la via « Ajouter une machine ».
        </p>
      )}
      <p className="text-xs text-text-muted">
        Édition détaillée non disponible pour ce profil. La machine participe au
        tempo partagé, à la présence, aux repères et à l'audio.
      </p>
    </div>
  );
}
