import type { Machine, MachineActions } from '../model/machine.ts';
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
 * the Machine read-model. The same component for both is the whole point of the
 * fusion: a remote panel is just a snapshot-fed Machine with no actions.
 */
export function MachinePanel({ machine, actions }: MachinePanelProps) {
  const selectedPart =
    machine.parts.find((p) => p.id === machine.selectedPartId) ??
    machine.parts[0];

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <header className="flex items-baseline gap-2">
        <span
          className={`size-2 rounded-full ${machine.online ? 'bg-green' : 'bg-line-bright'}`}
        />
        <h2 className="text-sm font-bold text-text">{machine.label}</h2>
        <span className="text-xs text-text-muted">{machine.model}</span>
        {!machine.editable && (
          <span className="text-[10px] uppercase tracking-wide text-text-dim">
            lecture seule
          </span>
        )}
      </header>
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
    </section>
  );
}
