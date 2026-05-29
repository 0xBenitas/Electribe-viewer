import { useConnectionStore } from '../store/connection.ts';
import { useCurrentPatternStore } from '../store/currentPattern.ts';
import { useSysexStore, type SysexEventKind } from '../store/sysex.ts';
import { sendCurrentPatternDump } from '../midi/bridge.ts';

const EVENT_LABEL: Record<SysexEventKind, { text: string; cls: string }> = {
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

export function SysexLab() {
  const connected = useConnectionStore((s) => s.state.status === 'connected');
  const raw = useCurrentPatternStore((s) => s.raw);
  const lastEvent = useSysexStore((s) => s.lastEvent);
  const fullRecall = useSysexStore((s) => s.fullRecallEnabled);
  const setFullRecall = useSysexStore((s) => s.setFullRecall);

  const ready = connected && raw !== null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-yellow/40 bg-bg-2 p-4">
      <h2 className="text-sm font-bold text-yellow">
        🧪 Écriture SysEx — expérimental (Phase 5b)
      </h2>
      <p className="text-xs text-text-dim">
        Validation guidée de l’écriture vers la machine. On charge l’
        <strong>edit buffer</strong> (volatile, n’écrase aucun slot) — réversible
        en rechargeant le pattern sur l’EMX2.
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
            <span className="text-xs font-bold text-text">
              Étape 1 — No-op
            </span>
            <span className="text-xs text-text-dim">
              Renvoie le dump <em>intact</em>. Attendu : aucun changement sonore
              + ACK <code>0x23</code>. Valide que le 0x40 charge bien l’edit
              buffer.
            </span>
            <button
              onClick={() => raw && sendCurrentPatternDump(raw)}
              className="mt-1 self-start rounded-md border border-line-bright bg-bg px-4 py-2 text-sm text-text hover:border-yellow"
            >
              Renvoyer le pattern intact
            </button>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-line bg-bg-3 p-3 text-xs">
            <input
              type="checkbox"
              checked={fullRecall}
              onChange={(e) => setFullRecall(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-text-dim">
              <strong className="text-text">
                Étape 2 — activer le recall SysEx complet
              </strong>
              <br />
              À cocher seulement <em>après</em> un no-op réussi (ACK 0x23). Le
              bouton « Recall » de la bibliothèque appliquera alors aussi
              l’oscillateur / filtre / IFX via l’edit buffer.
            </span>
          </label>

          {lastEvent && (
            <p className={`text-xs ${EVENT_LABEL[lastEvent.kind].cls}`}>
              {EVENT_LABEL[lastEvent.kind].text}
              {lastEvent.note ? ` — ${lastEvent.note}` : ''}
            </p>
          )}
        </>
      )}
    </div>
  );
}
