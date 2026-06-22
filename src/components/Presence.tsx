import { useSessionStore } from '../store/session.ts';

const PALETTE = [
  '#ff6b35',
  '#63e6be',
  '#da77f2',
  '#a9e34b',
  '#74c0fc',
  '#ff8787',
  '#ffd43b',
  '#d8f5a2',
];

/** Stable per-player colour when none was advertised in PeerInfo. */
function playerColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

interface Row {
  id: string;
  name: string;
  instrument: string;
  color: string;
  playing: boolean;
  host: boolean;
  you: boolean;
}

/** Who's in the jam: avatar, what they play, host, and a live "playing" dot. */
export function Presence() {
  const self = useSessionStore((s) => s.self);
  const peers = useSessionStore((s) => s.peers);
  const hostId = useSessionStore((s) => s.hostId);

  const rows: Row[] = [];
  if (self) {
    rows.push({
      id: self.id,
      name: self.info.name,
      you: true,
      host: self.id === hostId,
      playing: !self.info.listener,
      color: self.info.color ?? playerColor(self.id),
      instrument: self.info.listener ? 'ÉCOUTE' : 'MA MACHINE',
    });
  }
  for (const p of Object.values(peers)) {
    rows.push({
      id: p.id,
      name: p.info.name,
      you: false,
      host: p.isHost || p.id === hostId,
      playing: !p.info.listener,
      color: p.info.color ?? playerColor(p.id),
      instrument: p.device?.model ?? (p.info.listener ? 'ÉCOUTE' : '—'),
    });
  }

  const playing = rows.filter((r) => r.playing).length;

  return (
    <section className="card-acid flex flex-col gap-3 bg-bg-2 p-[18px]">
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold text-text">EN JEU</span>
        <span className="text-[10px] tracking-[0.16em] text-text-dim">
          {rows.length === 0 ? 'SOLO' : `${playing}/${rows.length} JAMMERS`}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-text-muted">
          Rejoins une session pour voir qui joue.
        </p>
      ) : (
        rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-[13px] border-2 border-black bg-bg-3 px-3 py-2.5"
            style={{ boxShadow: '2px 2px 0 #000' }}
          >
            <div
              className="flex size-9 flex-none items-center justify-center rounded-full border-2 border-black font-display text-[15px] font-extrabold text-[#0a0a0b]"
              style={{ background: r.color }}
            >
              {r.name.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                <span className="truncate">{r.name}</span>
                {r.you && <span className="text-[9px] text-text-muted">TOI</span>}
                {r.host && (
                  <span className="text-[9px] tracking-wide text-yellow">HÔTE</span>
                )}
              </div>
              <div className="truncate text-[10px] uppercase tracking-[0.1em] text-text-dim">
                {r.instrument}
              </div>
            </div>
            <span
              className="size-2.5 flex-none rounded-full"
              style={{
                background: r.playing ? 'var(--color-green)' : '#3a3a40',
                boxShadow: r.playing ? '0 0 10px var(--color-green)' : 'none',
              }}
            />
          </div>
        ))
      )}
    </section>
  );
}
