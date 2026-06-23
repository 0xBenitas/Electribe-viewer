// Shown when the browser has no Web MIDI (notably any phone / iOS Safari).
// You can't PILOT a machine here, but you can still LISTEN to the live — so we
// offer that instead of a dead-end (the common case: a shared session link
// opened on a phone).
export function BrowserCheck() {
  const room =
    typeof location !== 'undefined'
      ? (new URLSearchParams(location.search).get('room') ?? '')
      : '';
  const listenHref = `/ecouter.html${room ? `?room=${encodeURIComponent(room)}` : ''}`;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 p-8 text-center">
      <div>
        <div className="font-display text-3xl font-extrabold text-text">
          JAMBOREE 🍇
        </div>
        <div className="mt-1 text-[11px] tracking-[0.34em] text-text-dim">
          ÉCOUTE EN DIRECT
        </div>
      </div>

      <p className="text-text-dim">
        Sur ce navigateur (téléphone, Safari…) tu ne peux pas piloter de machine,
        mais tu peux <b>écouter la jam en direct</b>.
      </p>

      <a
        href={listenHref}
        className="btn-acid bg-green px-6 py-3 text-base font-bold text-[#0a1404] no-underline"
      >
        🔊 Écouter le live
      </a>

      <p className="text-[11px] text-text-muted">
        Pour <b>piloter</b> ta machine et voir le cockpit, ouvre JAMBOREE sur
        Chrome, Edge, Brave ou Opera (ordinateur).
      </p>
    </div>
  );
}
