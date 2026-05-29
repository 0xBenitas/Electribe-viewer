import { usePartsStore } from '../store/parts.ts';
import type { CCParam } from '../midi/ccMap.ts';
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

export function ParamPanel() {
  const activePartId = usePartsStore((s) => s.activePartId);
  const selectedPartId = usePartsStore((s) => s.selectedPartId);
  const mirrorPartId = activePartId ?? selectedPartId;
  // ADR-001: until a knob reveals the active part, sending CC would edit an
  // unknown part on the machine. Disable editing (still show values).
  const disabled = activePartId === null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-bg-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-text">
          Paramètres temps réel · Part{' '}
          {String(mirrorPartId).padStart(2, '0')}
        </h2>
      </div>

      {activePartId === null && (
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
            partId={mirrorPartId}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TOGGLES.map((p) => (
          <ParamToggle
            key={p}
            param={p}
            partId={mirrorPartId}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
