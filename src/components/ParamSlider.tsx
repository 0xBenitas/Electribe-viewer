import { CC_MAP, type CCParam } from '../midi/ccMap.ts';
import type { CCEncoding } from '../midi/encoding.ts';

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
  value: number | undefined;
  disabled?: boolean;
  /** Omitted = read-only (e.g. a remote peer's machine). */
  onChange?: (param: CCParam, value: number) => void;
}

export function ParamSlider({ param, value, disabled = false, onChange }: Props) {
  const spec = CC_MAP[param];
  const [min, max] = range(spec.encoding);
  const display = value ?? Math.round((min + max) / 2);
  const locked = disabled || !onChange;

  return (
    <label className={`flex flex-col gap-1 ${locked ? 'opacity-50' : ''}`}>
      <div className="flex justify-between text-xs">
        <span className="text-text-dim">{spec.description}</span>
        <span className="text-text">{value ?? '—'}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={display}
        disabled={locked}
        onChange={(e) => onChange?.(param, Number(e.target.value))}
        className="accent-blue"
      />
    </label>
  );
}

export function ParamToggle({ param, value, disabled = false, onChange }: Props) {
  const spec = CC_MAP[param];
  const on = value === 1;
  const locked = disabled || !onChange;
  return (
    <button
      disabled={locked}
      onClick={() => onChange?.(param, on ? 0 : 1)}
      className={`btn-acid px-3 py-1.5 text-xs font-medium ${
        on ? 'bg-green text-[#0a1404]' : 'bg-bg-3 text-text-dim'
      }`}
      style={{ borderWidth: '2px', borderRadius: '10px', boxShadow: '2px 2px 0 #000' }}
    >
      {spec.description}: {on ? 'On' : 'Off'}
    </button>
  );
}
