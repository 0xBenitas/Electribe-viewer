import { useConnectionStore } from '../store/connection.ts';
import { formatFirmware } from '../midi/deviceInquiry.ts';

const DOT: Record<string, string> = {
  connected: 'bg-green',
  inquiring: 'bg-yellow',
  connecting: 'bg-yellow',
  scanning: 'bg-yellow',
  'requesting-permission': 'bg-yellow',
  stale: 'bg-orange',
  'no-device': 'bg-text-muted',
  error: 'bg-red',
  idle: 'bg-text-muted',
};

export function ConnectionStatus() {
  const state = useConnectionStore((s) => s.state);
  const connect = useConnectionStore((s) => s.connect);
  const selectPort = useConnectionStore((s) => s.selectPort);

  const dot = DOT[state.status] ?? 'bg-text-muted';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-bg-2 p-4">
      <div className="flex items-center gap-2">
        <span className={`inline-block size-2.5 rounded-full ${dot}`} />
        <span className="text-sm text-text-dim">{label(state.status)}</span>
      </div>

      {state.status === 'connected' && (
        <div className="text-sm">
          <div className="font-bold text-blue">{state.port.name}</div>
          <div className="text-text-dim">
            Korg electribe · firmware {formatFirmware(state.identity)} · canal{' '}
            {state.identity.globalChannel + 1}
          </div>
        </div>
      )}

      {(state.status === 'idle' ||
        state.status === 'no-device' ||
        state.status === 'error') && (
        <div>
          {state.status === 'error' && (
            <p className="mb-2 text-sm text-red">{state.message}</p>
          )}
          {state.status === 'no-device' && (
            <p className="mb-2 text-sm text-text-dim">
              Aucun Electribe détecté. Branche-le et réessaie.
            </p>
          )}
          <button
            onClick={() => void connect()}
            className="rounded-md border border-line-bright bg-bg-3 px-4 py-2 text-text hover:border-blue"
          >
            Connecter
          </button>
        </div>
      )}

      {state.status === 'manual-select' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-dim">Plusieurs appareils détectés :</p>
          {state.candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => void selectPort(c.name)}
              className="rounded-md border border-line bg-bg-3 px-3 py-2 text-left text-sm hover:border-blue"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function label(status: string): string {
  switch (status) {
    case 'idle':
      return 'Prêt';
    case 'requesting-permission':
      return 'Demande d’autorisation…';
    case 'scanning':
      return 'Recherche d’appareils…';
    case 'connecting':
      return 'Connexion…';
    case 'inquiring':
      return 'Identification…';
    case 'connected':
      return 'Connecté';
    case 'stale':
      return 'Connexion perdue ?';
    case 'no-device':
      return 'Aucun appareil';
    case 'manual-select':
      return 'Choix de l’appareil';
    case 'error':
      return 'Erreur';
    default:
      return status;
  }
}
