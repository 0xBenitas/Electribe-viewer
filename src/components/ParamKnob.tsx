import { useRef } from 'react';
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
  color?: string;
  disabled?: boolean;
  /** Omitted = read-only (a remote peer's machine, or ADR-001 lock). */
  onChange?: (param: CCParam, value: number) => void;
}

/** Functional acid knob: drag vertically or use arrow keys. Read-only when no
 *  onChange (peer machine) or disabled (active part unknown, ADR-001). */
export function ParamKnob({ param, value, color = '#ff6b35', disabled = false, onChange }: Props) {
  const spec = CC_MAP[param];
  const [min, max] = range(spec.encoding);
  const val = value ?? Math.round((min + max) / 2);
  const locked = disabled || !onChange;
  const t = (val - min) / (max - min); // 0..1
  const deg = t * 270;
  const rot = t * 270 - 135;
  const drag = useRef<{ y: number; v: number } | null>(null);

  const set = (v: number) =>
    onChange?.(param, Math.max(min, Math.min(max, Math.round(v))));

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, v: val };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = drag.current.y - e.clientY;
    set(drag.current.v + (dy / 150) * (max - min));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (locked) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      set(val + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      set(val - 1);
      e.preventDefault();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="slider"
        aria-label={spec.description}
        aria-valuenow={val}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-disabled={locked}
        tabIndex={locked ? -1 : 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative size-[60px] touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-blue"
        style={{ cursor: locked ? 'default' : 'ns-resize', opacity: locked ? 0.5 : 1 }}
      >
        <div className="absolute inset-0 rounded-full border-[3px] border-black bg-[#0c0c0f]" />
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(${color} ${deg}deg, transparent 0)` }}
        />
        <div
          className="absolute inset-[7px] flex justify-center rounded-full border-2 border-black bg-[#16161b]"
          style={{ transform: `rotate(${rot}deg)` }}
        >
          <div
            className="mt-1 w-[3px] rounded-[2px]"
            style={{ height: '16px', background: color }}
          />
        </div>
      </div>
      <div className="text-center leading-tight">
        <div className="text-[13px] font-semibold text-text">{value ?? '—'}</div>
        <div className="text-[9px] uppercase tracking-[0.14em] text-text-dim">
          {spec.description}
        </div>
      </div>
    </div>
  );
}
