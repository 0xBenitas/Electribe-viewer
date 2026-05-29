import { useCurrentPatternStore } from '../store/currentPattern.ts';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEATS = ['16', '32', '8 Tri', '16 Tri'];

export function PatternInfo() {
  const pattern = useCurrentPatternStore((s) => s.pattern);
  if (!pattern) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-line bg-bg-2 px-4 py-3 text-sm">
      <span className="text-lg font-bold text-blue">
        {pattern.name || '(sans nom)'}
      </span>
      <span className="text-text-dim">
        {pattern.tempo.toFixed(1)} BPM
      </span>
      <span className="text-text-dim">
        Beat {BEATS[pattern.beat] ?? pattern.beat} · {pattern.length} bar
        {pattern.length > 1 ? 's' : ''}
      </span>
      <span className="text-text-dim">
        Key {KEYS[pattern.key] ?? pattern.key}
      </span>
    </div>
  );
}
