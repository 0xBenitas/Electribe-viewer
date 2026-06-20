import type { CCParam } from '../midi/ccMap.ts';
import type { MachinePart } from '../model/machine.ts';
import { ParamSlider, ParamToggle } from './ParamSlider.tsx';

const SLIDERS: CCParam[] = [
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

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-bg-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-text">
          Paramètres temps réel · Part {String(mirrorPartId).padStart(2, '0')}
        </h2>
      </div>

      {editable && activePartId === null && (
        <p className="text-xs text-yellow">
          Part actif inconnu — tourne un knob sur la machine pour qu'EMX.PILOT
          détecte le part sélectionné (ADR-001).
        </p>
      )}

      <div className="flex flex-col gap-3">
        {SLIDERS.map((p) => (
          <ParamSlider
            key={p}
            param={p}
            value={mirrorPart?.params[p]}
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
    </div>
  );
}
