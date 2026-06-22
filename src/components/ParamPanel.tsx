import type { CCParam } from '../midi/ccMap.ts';
import type { MachinePart } from '../model/machine.ts';
import { ParamKnob } from './ParamKnob.tsx';
import { ParamToggle } from './ParamSlider.tsx';

const KNOBS: CCParam[] = [
  'filterCutoff',
  'filterReso',
  'egAttack',
  'egDecay',
  'ampLevel',
  'ampPan',
  'ifxEdit',
];
// mfxOnOff / masterFxX/Y are pattern-level (not per-part) — handled elsewhere.
const TOGGLES: CCParam[] = ['ifxOnOff', 'mfxSendOnOff'];

interface ParamPanelProps {
  parts: MachinePart[];
  activePartId: number | null;
  selectedPartId: number;
  editable: boolean;
  onSetParam?: (param: CCParam, value: number) => void;
}

export function ParamPanel({
  parts,
  activePartId,
  selectedPartId,
  editable,
  onSetParam,
}: ParamPanelProps) {
  const mirrorPartId = activePartId ?? selectedPartId;
  const mirrorPart = parts.find((p) => p.id === mirrorPartId);
  // ADR-001: until a knob reveals the active part, sending CC would edit an
  // unknown part on the machine. A remote machine is never editable.
  const disabled = !editable || activePartId === null;
  const onChange = editable ? onSetParam : undefined;
  const color = mirrorPart?.color ?? '#ff6b35';

  return (
    <section className="card-acid flex flex-col gap-4 bg-bg-2 p-5">
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold text-text">
          PARAMÈTRES
        </span>
        <span className="text-[10px] tracking-[0.16em] text-text-dim">
          PART {String(mirrorPartId).padStart(2, '0')}
        </span>
      </div>

      {editable && activePartId === null && (
        <p className="text-xs text-yellow">
          Part actif inconnu — tourne un knob sur la machine pour que JAMBOREE
          détecte le part sélectionné (ADR-001).
        </p>
      )}

      <div className="grid grid-cols-4 gap-x-3 gap-y-4">
        {KNOBS.map((p) => (
          <ParamKnob
            key={p}
            param={p}
            value={mirrorPart?.params[p]}
            color={color}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TOGGLES.map((p) => (
          <ParamToggle
            key={p}
            param={p}
            value={mirrorPart?.params[p]}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}
