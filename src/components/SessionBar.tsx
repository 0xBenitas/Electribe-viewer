import { useState } from 'react';
import { useSessionStore } from '../store/session.ts';
import type { SessionConnectConfig } from '../net/useSessionSync.ts';

interface Props {
  connected: boolean;
  onConnect: (config: SessionConnectConfig) => void;
  onDisconnect: () => void;
}

const DEFAULT_URL =
  (import.meta.env.VITE_SESSION_URL as string | undefined) ??
  'ws://localhost:8787';

export function SessionBar({ connected, onConnect, onDisconnect }: Props) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('jam');
  const self = useSessionStore((s) => s.self);
  const peers = useSessionStore((s) => s.peers);
  const transport = useSessionStore((s) => s.transport);

  if (!connected) {
    return (
      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-bg-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onConnect({
            url: DEFAULT_URL,
            room: room.trim() || 'jam',
            name: name.trim(),
          });
        }}
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-dim">Ton nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bastou"
            className="rounded-md border border-line bg-bg-3 px-3 py-2 text-sm text-text outline-none focus:border-blue"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-dim">Room</span>
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="rounded-md border border-line bg-bg-3 px-3 py-2 text-sm text-text outline-none focus:border-blue"
          />
        </label>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-md border border-blue bg-blue/15 px-4 py-2 text-sm font-medium text-blue disabled:opacity-50"
        >
          Rejoindre la session
        </button>
      </form>
    );
  }

  const peerList = Object.values(peers);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-green/40 bg-green/5 p-4 text-sm">
      <span className="font-bold text-green">Session « {room} »</span>
      {self && <span className="text-text-dim">toi : {self.info.name}</span>}
      {transport && (
        <span className="text-text-dim">
          {transport.bpm.toFixed(0)} BPM · mesure {transport.bar}
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
        onClick={onDisconnect}
        className="ml-auto rounded-md border border-line bg-bg-3 px-3 py-1.5 text-xs text-text-dim hover:text-text"
      >
        Quitter
      </button>
    </div>
  );
}
