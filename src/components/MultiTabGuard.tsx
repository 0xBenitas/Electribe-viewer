import { useEffect, useState } from 'react';
import { createTabGuard } from '../lib/broadcast.ts';

export function MultiTabGuard() {
  const [conflict, setConflict] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const guard = createTabGuard();
    guard.onConflict(() => setConflict(true));
    // Keep "Continuer ici" sticky: once the user accepted to coexist, don't
    // re-arm the modal every time another tab closes (matters with 3+ tabs).
    guard.onResolved(() => setConflict(false));
    return () => guard.release();
  }, []);

  if (!conflict || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-8">
      <div className="max-w-md rounded-lg border border-orange bg-bg-2 p-6 text-center">
        <h2 className="mb-2 text-xl font-bold text-orange">
          JAMBOREE est déjà ouvert ailleurs
        </h2>
        <p className="mb-4 text-text-dim">
          Un autre onglet est ouvert. Pour éviter les conflits, ne pilote ta
          machine MIDI que depuis <b>un seul</b> onglet. Tu peux quand même rester
          ici pour regarder ou écouter la session.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="btn-acid bg-green px-4 py-2 text-sm font-bold text-[#0a1404]"
        >
          Continuer ici
        </button>
      </div>
    </div>
  );
}
