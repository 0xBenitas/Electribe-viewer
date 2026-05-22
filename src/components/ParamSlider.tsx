import { CC_MAP, type CCParam } from '../midi/ccMap.ts';
import type { CCEncoding } from '../midi/encoding.ts';
import { sendParam } from '../midi/bridge.ts';
import { useParamsStore } from '../store/params.ts';

function range(enc: CCEncoding): [number, number] {
  switch (enc) {
    case 'signed':
      return [-63, 63];
    case 'pan':
      return [-64, 63];
    default:
      return [0, 127];
  }
}

interface Props {
  param: CCParam;
  partId: number;
}

export function ParamSlider({ param, partId }: Props) {
  const spec = CC_MAP[param];
  const [min, max] = range(spec.encoding);
  const value = useParamsStore((s) => s.byPart[partId]?.[param]);
  const display = value ?? Math.round((min + max) / 2);

  return (
    <label className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-dim">{spec.description}</span>
        <span className="text-text">{value ?? '—'}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={display}
        onChange={(e) => sendParam(param, Number(e.target.value))}
        className="accent-blue"
      />
    </label>
  );
}

export function ParamToggle({ param, partId }: Props) {
  const spec = CC_MAP[param];
  const value = useParamsStore((s) => s.byPart[partId]?.[param]);
  const on = value === 1;
  return (
    <button
      onClick={() => sendParam(param, on ? 0 : 1)}
      className={`rounded-md border px-3 py-1.5 text-xs ${
        on
          ? 'border-green bg-green/15 text-green'
          : 'border-line bg-bg-3 text-text-dim'
      }`}
    >
      {spec.description}: {on ? 'On' : 'Off'}
    </button>
  );
}
