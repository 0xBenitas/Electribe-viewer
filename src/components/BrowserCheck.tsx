export function BrowserCheck() {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="mb-3 text-2xl font-bold text-orange">
        Navigateur non supporté
      </h1>
      <p className="text-text-dim">
        ENSEMBLE a besoin de la Web MIDI API, disponible sur Chrome, Edge,
        Brave ou Opera. Safari et Firefox ne sont pas supportés.
      </p>
    </div>
  );
}
