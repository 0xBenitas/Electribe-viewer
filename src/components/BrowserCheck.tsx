// Navigateur sans Web MIDI (téléphones, Safari…) : on ne pilote pas de machine,
// mais TOUT le reste marche — le salon, l'écoute en un tap (ADR-007), le tempo,
// les cues. Donc un simple encart à la place de l'état MIDI, jamais un mur.
export function BrowserCheck() {
  return (
    <div className="card-acid flex flex-col gap-1 bg-bg-2 p-4 text-sm">
      <span className="text-text-dim">
        <b className="text-text">Pas de pilotage de machine sur ce navigateur</b> (il n’a pas le
        Web MIDI : téléphones, Safari, Firefox). Tu peux <b>écouter</b> les jams, suivre le tempo et
        les cues.
      </span>
      <span className="text-[11px] text-text-muted">
        Pour brancher ta machine et voir le cockpit : Chrome, Edge, Brave ou Opera sur un ordinateur.
      </span>
    </div>
  );
}
