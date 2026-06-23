import { useEffect, useRef, useState } from 'react';
import { useLobbies } from '../net/useLobbies.ts';
import { loadPrefs, savePrefs } from '../lib/sessionPrefs.ts';
import type { SessionConnectConfig } from '../net/useSessionSync.ts';
import type { LobbyInfo } from '../core/session/protocol.ts';

const inputCls =
  'rounded-md border-2 border-black bg-bg-3 px-3 py-2 text-sm text-text outline-none focus:border-blue';

interface Props {
  onConnect: (config: SessionConnectConfig) => void;
}

/**
 * The landing screen: who's jamming right now, joinable in one click. Replaces
 * the blind "type a room name" form — you see the live sessions and pick one.
 */
export function LobbyBrowser({ onConnect }: Props) {
  const initial = loadPrefs();
  const [name, setName] = useState(initial.name);
  // Prefill the room from a shared `?room=` link (resolved into prefs); leave it
  // blank when it's just the default so the field reads as "create a session".
  const [room, setRoom] = useState(initial.room === 'jam' ? '' : initial.room);
  const [server, setServer] = useState(initial.server);
  const [showServer, setShowServer] = useState(false);
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Debounce the server URL so editing it (advanced) doesn't reopen a socket on
  // every keystroke. The list still refreshes a beat after you stop typing.
  const [appliedServer, setAppliedServer] = useState(server.trim());
  useEffect(() => {
    const id = setTimeout(() => setAppliedServer(server.trim()), 400);
    return () => clearTimeout(id);
  }, [server]);

  const { lobbies, status } = useLobbies(appliedServer, true);
  const loading = status !== 'open' && status !== 'closed';

  const go = (targetRoom: string, listenOnly: boolean) => {
    const n = name.trim();
    if (!n) {
      setNeedName(true);
      nameRef.current?.focus();
      return;
    }
    const r = targetRoom.trim() || 'jam';
    const s = server.trim();
    savePrefs({ name: n, room: r, server: s });
    onConnect({ url: s, room: r, name: n, listenOnly });
  };

  return (
    <section className="card-acid flex flex-col gap-4 bg-bg-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-text">
          Sessions en cours
        </h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
          {status === 'open'
            ? 'mise à jour automatique'
            : status === 'closed'
              ? 'serveur injoignable'
              : 'connexion…'}
        </span>
      </div>

      {/* Your name — required once, then remembered. */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-dim">Ton nom</span>
        <input
          ref={nameRef}
          className={`${inputCls} max-w-xs ${needName ? 'border-red' : ''}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (needName) setNeedName(false);
          }}
          placeholder="Bastou"
        />
        {needName && (
          <span className="text-[11px] text-red">
            Entre ton nom pour rejoindre une session.
          </span>
        )}
      </label>

      {/* Live sessions. */}
      <div className="flex flex-col gap-2">
        {lobbies.length === 0 ? (
          <p className="rounded-md border-2 border-dashed border-line bg-bg-3/40 px-3 py-4 text-sm text-text-dim">
            {status === 'closed'
              ? 'Impossible de joindre le serveur. Vérifie l’adresse (serveur avancé) ou réessaie.'
              : loading
                ? 'Recherche des sessions en cours…'
                : 'Aucune session en cours — crée la tienne juste en dessous.'}
          </p>
        ) : (
          lobbies.map((l) => (
            <LobbyRow
              key={l.room}
              lobby={l}
              onJoin={() => go(l.room, false)}
              onListen={() => go(l.room, true)}
            />
          ))
        )}
      </div>

      {/* Create / join a session by name (private rooms, or your own). */}
      <div className="flex flex-col gap-1.5 border-t-2 border-black/30 pt-3">
        <span className="text-[11px] uppercase tracking-[0.14em] text-text-dim">
          ou — créer / rejoindre par nom
        </span>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(room, false);
          }}
        >
          <input
            className={inputCls}
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="nom de la session (ex. cave)"
          />
          <button
            type="submit"
            className="btn-acid bg-green px-4 py-2 text-sm font-bold text-[#0a1404]"
          >
            Créer / rejoindre
          </button>
        </form>
      </div>

      {/* Audio reminder — the single biggest point of confusion. */}
      <p className="text-[11px] text-text-muted">
        🔊 Le son passe par ton client NINJAM (Jamtaba ou Reaper), <b>pas</b> par
        cet onglet — ouvrir un 2ᵉ onglet ne te fera rien entendre.
      </p>

      {/* Advanced: the relay server URL (prefilled, rarely touched). */}
      <div className="text-[11px]">
        <button
          type="button"
          onClick={() => setShowServer((v) => !v)}
          className="text-text-dim underline-offset-2 hover:underline"
        >
          {showServer ? '▾' : '▸'} Serveur avancé
        </button>
        {showServer && (
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-text-dim">Serveur (WebSocket)</span>
            <input
              className={`${inputCls} w-full max-w-md`}
              value={server}
              onChange={(e) => setServer(e.target.value)}
            />
          </label>
        )}
      </div>
    </section>
  );
}

function LobbyRow({
  lobby,
  onJoin,
  onListen,
}: {
  lobby: LobbyInfo;
  onJoin: () => void;
  onListen: () => void;
}) {
  const listeners = lobby.count - lobby.players;
  const people =
    `${lobby.players} ${lobby.players > 1 ? 'musiciens' : 'musicien'}` +
    (listeners > 0 ? ` · ${listeners} à l’écoute` : '');
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[13px] border-2 border-black bg-bg-3 px-4 py-3"
      style={{ boxShadow: '2px 2px 0 #000' }}
    >
      <span
        className="size-2.5 flex-none rounded-full"
        style={{
          background: 'var(--color-green)',
          boxShadow: '0 0 10px var(--color-green)',
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-base font-bold text-text">
            {lobby.room}
          </span>
          {lobby.hasHostWithMachine && (
            <span className="text-[11px]" title="Une machine est branchée">
              🎹
            </span>
          )}
        </div>
        <div className="truncate text-[11px] uppercase tracking-[0.1em] text-text-dim">
          {people}
          {lobby.host ? ` · hôte ${lobby.host}` : ''}
        </div>
      </div>
      <div className="flex flex-none gap-2">
        <button
          onClick={onJoin}
          className="btn-acid bg-green px-3.5 py-1.5 text-sm font-bold text-[#0a1404]"
        >
          Rejoindre
        </button>
        <button
          onClick={onListen}
          title="Rejoindre sans machine, juste pour écouter et suivre"
          className="btn-acid bg-bg-2 px-3.5 py-1.5 text-sm text-text-dim"
          style={{ borderWidth: '2px', boxShadow: '3px 3px 0 #000' }}
        >
          Écouter
        </button>
      </div>
    </div>
  );
}
