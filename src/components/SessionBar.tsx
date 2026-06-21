import { useState } from 'react';
import { useSessionStore } from '../store/session.ts';
import { useSharedTransport } from '../model/useClock.ts';
import {
  buildShareLink,
  loadPrefs,
  savePrefs,
} from '../lib/sessionPrefs.ts';
import type { SessionConnectConfig } from '../net/useSessionSync.ts';

interface Props {
  connected: boolean;
  onConnect: (config: SessionConnectConfig) => void;
  onDisconnect: () => void;
}

const inputCls =
  'rounded-md border border-line bg-bg-3 px-3 py-2 text-sm text-text outline-none focus:border-blue';

export function SessionBar({ connected, onConnect, onDisconnect }: Props) {
  const initial = loadPrefs();
  const [name, setName] = useState(initial.name);
  const [room, setRoom] = useState(initial.room);
  const [server, setServer] = useState(initial.server);
  const [copied, setCopied] = useState(false);

  const self = useSessionStore((s) => s.self);
  const peers = useSessionStore((s) => s.peers);
  const linkStatus = useSessionStore((s) => s.linkStatus);
  const latencyMs = useSessionStore((s) => s.latencyMs);
  const transport = useSharedTransport();

  const join = (listenOnly: boolean) => {
    const trimmed = { name: name.trim(), room: room.trim() || 'jam', server: server.trim() };
    if (!trimmed.name) return;
    savePrefs(trimmed);
    onConnect({ url: trimmed.server, room: trimmed.room, name: trimmed.name, listenOnly });
  };

  if (!connected) {
    return (
      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-bg-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          join(false);
        }}
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-dim">Ton nom</span>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bastou"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-dim">Room</span>
          <input className={inputCls} value={room} onChange={(e) => setRoom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-dim">Serveur</span>
          <input
            className={`${inputCls} w-56`}
            value={server}
            onChange={(e) => setServer(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-md border border-blue bg-blue/15 px-4 py-2 text-sm font-medium text-blue disabled:opacity-50"
        >
          Rejoindre
        </button>
        <button
          type="button"
          onClick={() => join(true)}
          disabled={!name.trim()}
          title="Rejoindre sans machine, juste pour écouter et suivre"
          className="rounded-md border border-line bg-bg-3 px-4 py-2 text-sm text-text-dim hover:text-text disabled:opacity-50"
        >
          Écouter seulement
        </button>
      </form>
    );
  }

  const peerList = Object.values(peers);
  const copyLink = () => {
    void navigator.clipboard?.writeText(buildShareLink(room, server)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-green/40 bg-green/5 p-4 text-sm">
      <span className="font-bold text-green">Session « {room} »</span>
      {self?.info.listener && (
        <span className="text-[10px] uppercase tracking-wide text-text-dim">écoute</span>
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
      <span className="text-text-dim">
        {peerList.length === 0
          ? 'personne d’autre pour l’instant'
          : peerList
              .map((p) => p.info.name + (p.isHost ? ' (hôte)' : ''))
              .join(', ')}
      </span>
      <button
        onClick={copyLink}
        className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-xs text-text-dim hover:text-text"
      >
        {copied ? 'Lien copié ✓' : 'Copier le lien'}
      </button>
      <button
        onClick={onDisconnect}
        className="ml-auto rounded-md border border-line bg-bg-3 px-3 py-1.5 text-xs text-text-dim hover:text-text"
      >
        Quitter
      </button>
    </div>
  );
}
