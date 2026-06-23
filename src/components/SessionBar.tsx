import { useState } from 'react';
import { useSessionStore } from '../store/session.ts';
import { useSharedTransport } from '../model/useClock.ts';
import { buildShareLink } from '../lib/sessionPrefs.ts';

interface Props {
  /** Room currently joined (drives the title + share link). */
  room: string;
  /** Relay server URL currently in use (for the share link). */
  server: string;
  onDisconnect: () => void;
}

/**
 * The compact strip shown once you're in a session: who you are, link health,
 * latency, shared tempo, copy-link and leave. The join flow lives in
 * {@link LobbyBrowser} (the landing screen).
 */
export function SessionBar({ room, server, onDisconnect }: Props) {
  const [copied, setCopied] = useState(false);

  const self = useSessionStore((s) => s.self);
  const linkStatus = useSessionStore((s) => s.linkStatus);
  const latencyMs = useSessionStore((s) => s.latencyMs);
  const transport = useSharedTransport();

  const copyLink = () => {
    void navigator.clipboard?.writeText(buildShareLink(room, server)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="card-acid flex flex-wrap items-center gap-x-5 gap-y-2 bg-bg-2 p-4 text-sm"
      style={{ borderColor: 'var(--color-green)' }}
    >
      <span className="font-bold text-green">Session « {room} »</span>
      {self?.info.listener && (
        <span className="text-[10px] uppercase tracking-wide text-text-dim">
          écoute
        </span>
      )}
      {linkStatus !== 'open' && (
        <span className="text-yellow">
          {linkStatus === 'connecting' ? 'connexion…' : 'connexion perdue'}
        </span>
      )}
      {self && <span className="text-text-dim">toi : {self.info.name}</span>}
      {latencyMs !== null && (
        <span className="text-text-dim">{latencyMs} ms</span>
      )}
      {transport && transport.running && (
        <span className="text-text-dim">
          {transport.bpm !== null ? transport.bpm.toFixed(0) : '—'} BPM · mesure{' '}
          {transport.bar}
        </span>
      )}
      <button
        onClick={copyLink}
        className="btn-acid bg-bg-3 px-3 py-1.5 text-xs text-text-dim"
        style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
      >
        {copied ? 'Lien copié ✓' : 'Copier le lien'}
      </button>
      <button
        onClick={onDisconnect}
        className="btn-acid ml-auto bg-bg-3 px-3 py-1.5 text-xs text-text-dim"
        style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
      >
        Quitter
      </button>
    </div>
  );
}
