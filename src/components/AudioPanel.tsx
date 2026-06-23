import { useState } from 'react';
import { ninjamTarget } from '../core/transport/ninjam.ts';
import { useSessionStore } from '../store/session.ts';

// ninjamTarget appends the default port when none is given.
const NINJAM_HOST =
  (import.meta.env.VITE_NINJAM_HOST as string | undefined) ?? 'localhost';

export function AudioPanel() {
  const self = useSessionStore((s) => s.self);
  const [copied, setCopied] = useState(false);
  const target = ninjamTarget(NINJAM_HOST);

  const copy = () => {
    void navigator.clipboard?.writeText(target).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-dim">
          Audio · NINJAM
        </h2>
        <span className="text-[10px] text-text-muted">
          le navigateur ne transporte pas l'audio
        </span>
      </div>

      <p className="text-xs text-text-dim">
        Connecte ton client natif (Jamtaba ou Reaper + plugin NINJAM) au serveur
        ci-dessous. JAMBOREE gère le reste : tempo, présence, repères.
      </p>

      <p className="text-[11px] text-text-muted">
        Machine sans MIDI (TB-303 d'origine, modulaire, instrument acoustique) :
        elle ne s'affiche pas dans le cockpit mais jamme quand même — route son
        audio vers ton client NINJAM, et cale-la en DIN sync depuis l'hôte.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-md border border-line bg-bg-3 px-3 py-1.5 font-mono text-sm text-text">
          {target}
        </code>
        <button
          onClick={copy}
          className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-xs text-text-dim hover:text-text"
        >
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
        {self && (
          <span className="text-xs text-text-dim">
            pseudo suggéré : <span className="text-text">{self.info.name}</span>
          </span>
        )}
      </div>
    </div>
  );
}
