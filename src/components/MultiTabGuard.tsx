import { useEffect, useState } from 'react';
import { createTabGuard } from '../lib/broadcast.ts';

export function MultiTabGuard() {
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    const guard = createTabGuard();
    guard.onConflict(() => setConflict(true));
    guard.onResolved(() => setConflict(false));
    return () => guard.release();
  }, []);

  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-8">
      <div className="max-w-md rounded-lg border border-orange bg-bg-2 p-6 text-center">
        <h2 className="mb-2 text-xl font-bold text-orange">
          JAMBOREE est déjà ouvert
        </h2>
        <p className="text-text-dim">
          Un autre onglet contrôle déjà l'Electribe. Ferme cet onglet pour
          éviter les conflits MIDI.
        </p>
      </div>
    </div>
  );
}
