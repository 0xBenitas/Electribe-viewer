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
const TOGGLES: CCParam[] = ['ifxOnOff', 'mfxSendOnOff', 'mfxOnOff'];

export function ParamPanel() {
  const activePartId = usePartsStore((s) => s.activePartId);
  const selectedPartId = usePartsStore((s) => s.selectedPartId);
  const mirrorPartId = activePartId ?? selectedPartId;

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
          <ParamSlider key={p} param={p} partId={mirrorPartId} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TOGGLES.map((p) => (
          <ParamToggle key={p} param={p} partId={mirrorPartId} />
        ))}
      </div>
    </div>
  );
}
