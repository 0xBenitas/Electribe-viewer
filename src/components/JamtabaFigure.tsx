import { NINJAM_TARGET } from '../lib/ninjamHost.ts';

// Schéma de la fenêtre Jamtaba avec les 5 repères du mode d'emploi. Redessiné
// (pas une capture) pour rester lisible sur fond sombre et se mettre à jour
// avec l'adresse du serveur inlinée au build.

function Callout({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="#fcc419" stroke="#000" strokeWidth={2.5} />
      <text
        x={x}
        y={y + 4.5}
        textAnchor="middle"
        fontSize={13}
        fontWeight={800}
        fill="#0a0a0b"
        fontFamily="IBM Plex Mono, ui-monospace, monospace"
      >
        {n}
      </text>
    </g>
  );
}

export function JamtabaFigure() {
  const mono = 'IBM Plex Mono, ui-monospace, monospace';
  return (
    <svg
      viewBox="0 0 560 330"
      role="img"
      aria-label="Fenêtre Jamtaba : nom en haut à gauche, menu Ninjam, fenêtre de connexion privée, entrée audio en bas à gauche, bouton Transmit"
      className="w-full max-w-2xl rounded-md border-2 border-black bg-[#2b2b2b]"
      style={{ boxShadow: '3px 3px 0 #000' }}
      fontFamily={mono}
    >
      {/* barre de titre + menus */}
      <rect x={0} y={0} width={560} height={22} fill="#f2f2f2" />
      <text x={10} y={15} fontSize={11} fill="#222">JamTaba</text>
      <rect x={0} y={22} width={560} height={18} fill="#3a3a3a" />
      {['Preferences', 'View', 'Ninjam', 'Language', 'Theme', 'Help'].map((m, i) => (
        <text key={m} x={10 + i * 62} y={35} fontSize={10} fill={m === 'Ninjam' ? '#fcc419' : '#cfcfcf'} fontWeight={m === 'Ninjam' ? 700 : 400}>
          {m}
        </text>
      ))}
      <rect x={128} y={24} width={44} height={14} fill="none" stroke="#fcc419" strokeWidth={1.5} rx={2} />

      {/* panneau gauche : nom, fader, entrée, transmit */}
      <rect x={6} y={46} width={120} height={276} fill="#333" stroke="#1f1f1f" />
      <text x={14} y={62} fontSize={9} fill="#9a9a9a">Your Controls</text>
      <rect x={12} y={68} width={108} height={16} fill="#444" stroke="#555" />
      <text x={18} y={80} fontSize={9} fill="#bdbdbd">user name here</text>
      <rect x={30} y={100} width={22} height={150} fill="#2a2a2a" stroke="#555" />
      <rect x={26} y={160} width={30} height={8} fill="#777" />
      <rect x={12} y={262} width={108} height={16} fill="#444" stroke="#555" />
      <text x={18} y={274} fontSize={9} fill="#bdbdbd">no input ▾</text>
      <rect x={12} y={288} width={108} height={22} rx={3} fill="#2ea043" stroke="#1b5e20" />
      <text x={66} y={303} fontSize={10} textAnchor="middle" fill="#fff" fontWeight={700}>▲ Transmit</text>

      {/* liste publique (à ignorer) */}
      <rect x={136} y={46} width={270} height={276} fill="#3a3a3a" stroke="#1f1f1f" />
      <text x={146} y={62} fontSize={9} fill="#9a9a9a">Rooms to play</text>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} opacity={0.35}>
          <rect x={146} y={72 + i * 40} width={250} height={32} fill="#444" />
          <rect x={352} y={80 + i * 40} width={38} height={16} fill="#555" />
        </g>
      ))}
      <text x={271} y={310} fontSize={9} textAnchor="middle" fill="#fcc419">serveurs publics : ignore cette liste</text>

      {/* chat (à ignorer) */}
      <rect x={416} y={46} width={138} height={276} fill="#3a3a3a" stroke="#1f1f1f" opacity={0.5} />
      <text x={426} y={62} fontSize={9} fill="#9a9a9a">Chat</text>

      {/* dialogue serveur privé */}
      <g>
        <rect x={190} y={118} width={230} height={124} rx={3} fill="#f2f2f2" stroke="#000" strokeWidth={2} />
        <rect x={190} y={118} width={230} height={18} fill="#e0e0e0" />
        <text x={200} y={131} fontSize={9.5} fill="#222" fontWeight={700}>Connect in private server</text>
        {[
          ['Server', NINJAM_TARGET.replace(/:\d+$/, '')],
          ['Port', '2049'],
          ['User name', 'ton nom'],
          ['Password', '(vide)'],
        ].map(([k, v], i) => (
          <g key={k}>
            <text x={200} y={154 + i * 20} fontSize={9} fill="#333">{k}</text>
            <rect x={262} y={144 + i * 20} width={150} height={14} fill="#fff" stroke="#999" />
            <text x={266} y={154.5 + i * 20} fontSize={8.5} fill="#111">{v}</text>
          </g>
        ))}
        <rect x={362} y={224} width={50} height={14} rx={2} fill="#2ea043" />
        <text x={387} y={234} fontSize={8.5} textAnchor="middle" fill="#fff" fontWeight={700}>Connect</text>
      </g>

      {/* repères */}
      <Callout x={128} y={76} n={1} />
      <Callout x={178} y={31} n={2} />
      <Callout x={190} y={118} n={3} />
      <Callout x={128} y={270} n={4} />
      <Callout x={128} y={299} n={5} />
    </svg>
  );
}
