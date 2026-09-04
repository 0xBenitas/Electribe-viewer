const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Nom d'une note MIDI (60 = C4). */
export function noteName(midi: number): string {
  const n = Math.max(0, Math.min(127, Math.round(midi)));
  return `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
}
