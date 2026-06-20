export function KnobModeBadge({ knobMode }: { knobMode: number | null }) {
  if (knobMode !== 1) return null; // only warn on "Catch"

  return (
    <div className="rounded-md border border-yellow/40 bg-yellow/10 px-3 py-2 text-xs text-yellow">
      Knob Mode = <strong>Catch</strong> sur la machine : un recall de preset
      peut créer des décalages de knobs jusqu'à ce que tu rattrapes la valeur.
    </div>
  );
}
