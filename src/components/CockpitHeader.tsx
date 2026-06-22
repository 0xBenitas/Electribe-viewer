import { useSessionStore } from '../store/session.ts';

/** Wordmark + live session identity. The lighthouse/eye logo nods to the
 *  acid/psyché direction (DESIGN.md); the pills surface real session state. */
export function CockpitHeader({ room }: { room: string | null }) {
  const linkStatus = useSessionStore((s) => s.linkStatus);
  const synced = linkStatus === 'open';
  const status = !room
    ? null
    : synced
      ? { color: 'var(--color-acid)', label: 'SYNCED', glow: true }
      : linkStatus === 'connecting'
        ? { color: 'var(--color-yellow)', label: 'CONNEXION', glow: false }
        : { color: 'var(--color-red)', label: 'HORS LIGNE', glow: false };

  const code =
    room && (room.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'JAM');

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div
          className="relative flex size-[46px] items-center justify-center rounded-full border-[3px] border-black bg-yellow"
          style={{ boxShadow: '4px 4px 0 #000' }}
        >
          <div className="relative size-[15px] rounded-full bg-black">
            <div className="absolute left-[2px] top-[2px] size-[5px] rounded-full bg-white" />
          </div>
        </div>
        <div className="leading-[0.92]">
          <div className="font-display text-3xl font-extrabold tracking-[-0.02em] text-text">
            JAMBOREE
          </div>
          <div className="mt-0.5 text-[10px] tracking-[0.34em] text-text-dim">
            ELECTRIBE · LIVE COCKPIT
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {status && (
          <span
            className="pill-acid flex items-center gap-2 bg-bg-2 px-3.5 py-2 text-[11px] font-bold tracking-[0.16em]"
            style={{ color: status.color }}
          >
            <span
              className="size-2 rounded-full"
              style={{
                background: status.color,
                boxShadow: status.glow ? `0 0 10px ${status.color}` : 'none',
              }}
            />
            {status.label}
          </span>
        )}
        {room && (
          <span className="pill-acid bg-bg-2 px-3.5 py-2 text-[11px] tracking-[0.12em] text-text-dim">
            SESSION&nbsp; <b className="text-text">{room}</b>
          </span>
        )}
        {code && (
          <span className="pill-acid bg-magenta px-3.5 py-2 text-[11px] font-bold tracking-[0.14em] text-[#180a1d]">
            #{code}
          </span>
        )}
      </div>
    </header>
  );
}
