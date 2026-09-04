import { useEffect, useState } from 'react';
import { useConnectionStore } from '../store/connection.ts';
import { useCurrentPatternStore } from '../store/currentPattern.ts';
import { useSysexStore, type SysexEventKind } from '../store/sysex.ts';
import { requestCurrentPattern, resendCurrentPattern } from '../midi/bridge.ts';
import {
  dumpFileName,
  listDumps,
  syxBytes,
  type DumpRow,
} from '../midi/dumpVault.ts';
import { downloadBytes } from '../lib/download.ts';

const EVENT_LABEL: Record<SysexEventKind, { text: string; cls: string }> = {
  refresh: { text: 'Pattern redemandé à la machine…', cls: 'text-yellow' },
  'refresh-error': {
    text: '⛔ La machine n’a pas renvoyé son pattern : rien n’a été envoyé.',
    cls: 'text-red',
  },
  sent: { text: 'Dump envoyé — en attente de l’ACK machine…', cls: 'text-yellow' },
  'load-ok': {
    text: '✅ Edit buffer chargé (ACK DATA_LOAD_COMPLETED 0x23)',
    cls: 'text-green',
  },
  'load-error': { text: '❌ Erreur de chargement (0x24)', cls: 'text-red' },
  'write-ok': { text: '✅ Écriture slot OK (0x21)', cls: 'text-green' },
  'write-error': { text: '❌ Erreur d’écriture (0x22)', cls: 'text-red' },
  'format-error': {
    text: '❌ SysEx refusé — format invalide (0x26)',
    cls: 'text-red',
  },
};

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 2) return 'à l’instant';
  if (s < 90) return `il y a ${s} s`;
  return `il y a ${Math.round(s / 60)} min`;
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString('fr-FR');
}

export function SysexLab() {
  const connected = useConnectionStore((s) => s.state.status === 'connected');
  const globalChannel = useConnectionStore((s) =>
    s.state.status === 'connected' && s.state.identity
      ? s.state.identity.globalChannel
      : null,
  );
  const pattern = useCurrentPatternStore((s) => s.pattern);
  const raw = useCurrentPatternStore((s) => s.raw);
  const hydratedAt = useCurrentPatternStore((s) => s.hydratedAt);
  const lastEvent = useSysexStore((s) => s.lastEvent);
  const loadOkSeen = useSysexStore((s) => s.loadOkSeen);
  const fullRecall = useSysexStore((s) => s.fullRecallEnabled);
  const setFullRecall = useSysexStore((s) => s.setFullRecall);

  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [vault, setVault] = useState<DumpRow[]>([]);
  const [vaultOpen, setVaultOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Le coffre change à chaque dump reçu (hydratedAt bouge).
  useEffect(() => {
    let alive = true;
    listDumps()
      .then((rows) => {
        if (alive) setVault(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [hydratedAt]);

  const ready = connected && raw !== null && globalChannel !== null;

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const download = (name: string, at: number, bytes: Uint8Array) => {
    if (globalChannel === null) return;
    downloadBytes(dumpFileName(name, at), syxBytes(globalChannel, bytes));
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-yellow/40 bg-bg-2 p-4">
      <h2 className="text-sm font-bold text-yellow">
        🧪 Écriture SysEx — expérimental (Phase 5b)
      </h2>
      <p className="text-xs text-text-dim">
        Tout envoi <strong>remplace le contenu de travail du pattern sélectionné
        sur la machine</strong> (l’edit buffer). Le pattern en mémoire n’est
        modifié que si tu presses <strong>Write</strong> ensuite. Pour annuler :
        change de pattern sur l’EMX2, puis reviens dessus. Avant chaque envoi,
        Jamboree redemande le pattern à la machine et le garde dans le coffre
        ci-dessous : aucun dump périmé n’est jamais renvoyé.
      </p>

      {!ready && (
        <p className="text-xs text-text-muted">
          Connecte la machine ; le pattern courant doit être hydraté (un dump
          reçu) pour activer le test.
        </p>
      )}

      {ready && (
        <>
          <div className="flex flex-col gap-1 rounded-md border border-line bg-bg-3 p-3">
            <span className="text-xs font-bold text-text">Dump en mémoire</span>
            <span className="text-xs text-text-dim">
              Pattern <strong className="text-text">{pattern?.name || '(sans nom)'}</strong>
              {pattern ? ` · ${pattern.tempo} BPM` : ''}
              {hydratedAt !== null ? ` · reçu ${ago(hydratedAt, now)}` : ''}
            </span>
            <span className="text-xs text-text-muted">
              Vérifie que c’est bien le pattern affiché sur la machine. Si tu as
              changé de pattern, redemande.
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                onClick={() => void run(requestCurrentPattern)}
                disabled={busy}
                className="rounded-md border border-line-bright bg-bg px-3 py-1.5 text-xs text-text hover:border-yellow disabled:opacity-50"
              >
                Redemander à la machine
              </button>
              <button
                onClick={() => hydratedAt !== null && download(pattern?.name ?? '', hydratedAt, raw)}
                disabled={hydratedAt === null}
                className="rounded-md border border-line-bright bg-bg px-3 py-1.5 text-xs text-text hover:border-yellow disabled:opacity-50"
              >
                Télécharger (.syx)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-md border border-line bg-bg-3 p-3">
            <span className="text-xs font-bold text-text">Étape 1 — Renvoyer tel quel</span>
            <span className="text-xs text-text-dim">
              Redemande le pattern à la machine, le garde dans le coffre, puis
              le renvoie <em>intact</em> dans l’edit buffer. Attendu : aucun
              changement sonore + ACK <code>0x23</code>.
            </span>
            <button
              onClick={() => void run(() => resendCurrentPattern())}
              disabled={busy}
              className="mt-1 self-start rounded-md border border-line-bright bg-bg px-4 py-2 text-sm text-text hover:border-yellow disabled:opacity-50"
            >
              {busy ? 'En cours…' : 'Renvoyer le pattern intact'}
            </button>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-line bg-bg-3 p-3 text-xs">
            <input
              type="checkbox"
              checked={fullRecall}
              disabled={!loadOkSeen}
              onChange={(e) => setFullRecall(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-text-dim">
              <strong className="text-text">
                Étape 2 — activer le recall SysEx complet
              </strong>
              <br />
              {loadOkSeen
                ? 'Le bouton « Recall » de la bibliothèque appliquera aussi l’oscillateur / filtre / IFX via l’edit buffer (avec redemande du pattern juste avant).'
                : 'Verrouillé tant qu’un « Renvoyer tel quel » n’a pas reçu l’ACK 0x23 dans cette session.'}
            </span>
          </label>

          {lastEvent && (
            <p className={`text-xs ${EVENT_LABEL[lastEvent.kind].cls}`}>
              {EVENT_LABEL[lastEvent.kind].text}
              {lastEvent.note ? ` — ${lastEvent.note}` : ''}
            </p>
          )}

          <div className="flex flex-col gap-1 rounded-md border border-line bg-bg-3 p-3">
            <button
              onClick={() => setVaultOpen((o) => !o)}
              className="self-start text-xs font-bold text-text"
            >
              {vaultOpen ? '▾' : '▸'} Coffre — {vault.length} dump{vault.length > 1 ? 's' : ''} gardé{vault.length > 1 ? 's' : ''} dans ce navigateur
            </button>
            {vaultOpen && vault.length === 0 && (
              <span className="text-xs text-text-muted">Aucun dump gardé pour l’instant.</span>
            )}
            {vaultOpen && vault.length > 0 && (
              <ul className="flex flex-col gap-1">
                {vault.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-xs text-text-dim">
                    <span>
                      <strong className="text-text">{d.name || '(sans nom)'}</strong>
                      {` · ${d.tempo} BPM · ${clock(d.receivedAt)}`}
                    </span>
                    <button
                      onClick={() => download(d.name, d.receivedAt, d.raw)}
                      className="rounded-md border border-line-bright bg-bg px-2 py-1 text-xs text-text hover:border-yellow"
                    >
                      .syx
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
