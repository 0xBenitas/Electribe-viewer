import { useEffect, useRef, useState } from 'react';
import { audioEngine, SELF_ID } from '../audio/engine.ts';
import { useAudioStore } from '../store/audio.ts';
import { useSessionStore } from '../store/session.ts';
import { useClockStore } from '../store/clock.ts';
import { sendGrid } from '../net/sessionLink.ts';
import { intervalMs } from '../core/audio/grid.ts';

// Le panneau « Son » de la session (ADR-007) : un bouton pour activer le son
// dans le navigateur, l'entrée à choisir une fois, les niveaux, la grille
// d'intervalles (réglée par l'hôte) et un fader par pair. Rien à installer.

const BPI_CHOICES = [4, 8, 16, 32];

function Meter({ level, color = 'var(--color-green)' }: { level: number; color?: string }) {
  const pct = Math.min(100, Math.round(Math.sqrt(level) * 130));
  return (
    <div className="h-[6px] w-full overflow-hidden rounded-[3px] border border-black bg-black">
      <div className="h-full transition-[width] duration-100" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  off: { text: 'SON COUPÉ', color: 'var(--color-text-dim)' },
  starting: { text: 'DÉMARRAGE', color: 'var(--color-yellow)' },
  live: { text: 'EN DIRECT', color: 'var(--color-green)' },
  listening: { text: 'ÉCOUTE', color: 'var(--color-cyan)' },
  error: { text: 'ERREUR', color: 'var(--color-red)' },
};

export function JamAudio() {
  const self = useSessionStore((s) => s.self);
  const hostId = useSessionStore((s) => s.hostId);
  const peers = useSessionStore((s) => s.peers);
  const isHost = self !== null && self.id === hostId;
  const listener = self?.info.listener ?? false;

  const supported = useAudioStore((s) => s.supported);
  const status = useAudioStore((s) => s.status);
  const error = useAudioStore((s) => s.error);
  const grid = useAudioStore((s) => s.grid);
  const inputs = useAudioStore((s) => s.inputs);
  const inputsListed = useAudioStore((s) => s.inputsListed);
  const inputId = useAudioStore((s) => s.inputId);
  const capturing = useAudioStore((s) => s.capturing);
  const muted = useAudioStore((s) => s.muted);
  const inputLevel = useAudioStore((s) => s.inputLevel);
  const peerAudio = useAudioStore((s) => s.peers);
  const framesSent = useAudioStore((s) => s.framesSent);
  const warning = useAudioStore((s) => s.warning);
  const selfMonitor = useAudioStore((s) => s.selfMonitor);
  const directMonitor = useAudioStore((s) => s.directMonitor);

  const machineBpm = useClockStore((s) => s.bpm);

  const [chosenInput, setChosenInput] = useState<string>('');
  const [bpm, setBpm] = useState<string>('');
  const [bpi, setBpi] = useState<number>(16);
  const [outLevel, setOutLevel] = useState(0);
  // « Aucun signal » seulement après 3 s de silence continu (pas sur un creux).
  const [silentSince, setSilentSince] = useState<number | null>(null);
  useEffect(() => {
    if (!capturing || muted) {
      setSilentSince(null);
      return;
    }
    if (inputLevel >= 0.002) setSilentSince(null);
    else setSilentSince((t) => t ?? Date.now());
  }, [inputLevel, capturing, muted]);
  const noSignal = silentSince !== null && Date.now() - silentSince > 3000;

  useEffect(() => {
    useAudioStore.getState().setSupported(audioEngine.isSupported());
    if (audioEngine.isSupported()) void audioEngine.listInputs().catch(() => {});
  }, []);

  const lastGridId = useRef<number | null>(null);
  useEffect(() => {
    if (grid && grid.id !== lastGridId.current) {
      lastGridId.current = grid.id;
      setBpm(String(grid.bpm));
      setBpi(grid.bpi);
    }
  }, [grid]);

  useEffect(() => {
    if (inputId && !chosenInput) setChosenInput(inputId);
  }, [inputId, chosenInput]);

  const running = status === 'live' || status === 'listening';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setOutLevel(audioEngine.outputLevel()), 100);
    return () => clearInterval(t);
  }, [running]);

  const start = (capture: boolean) =>
    void audioEngine.start({ capture, deviceId: chosenInput || null });

  const changeInput = (id: string) => {
    setChosenInput(id);
    if (capturing) start(true);
  };

  const applyGrid = () => {
    const b = Number(bpm.replace(',', '.'));
    if (!Number.isFinite(b)) return;
    sendGrid(b, bpi);
  };

  const label = STATUS_LABEL[status] ?? STATUS_LABEL.off!;
  const peerList = Object.values(peers);

  return (
    <section className="card-acid flex flex-col gap-3 bg-bg-2 p-4" style={{ borderColor: running ? 'var(--color-green)' : undefined }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-base font-bold text-text">SON</span>
        <span className="pill-acid bg-bg-3 px-3 py-1 text-[10px] font-bold tracking-[0.16em]" style={{ color: label.color }}>
          {label.text}
        </span>
        <span className="text-[11px] text-text-dim">
          dans le navigateur · rien à installer · tu entends les autres avec un intervalle de retard, eux aussi
        </span>
        {running && (
          <button
            onClick={() => void audioEngine.stop()}
            className="btn-acid ml-auto bg-bg-3 px-3 py-1.5 text-xs text-text-dim"
            style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
          >
            Couper le son
          </button>
        )}
      </div>

      {!supported && (
        <p className="text-xs text-red">
          Ce navigateur ne sait pas jouer le son de la jam. Sur ordinateur : Chrome ou Edge. Sur téléphone : Chrome
          sur Android ; iPhone, pas encore. Tu peux quand même suivre le tempo et les cues.
        </p>
      )}
      {error && <p className="text-xs text-red">{error}</p>}
      {warning && <p className="text-xs text-yellow">{warning}</p>}
      {supported && !listener && inputsListed && inputs.length === 0 && (
        <p className="text-xs text-yellow">
          Chrome ne voit <b>aucune entrée audio</b> sur cet ordinateur. Windows → Paramètres → Son → Entrée doit lister
          une prise ligne / micro ou une carte son, activée. Branche, puis ↻.
        </p>
      )}

      {supported && !running && status !== 'starting' && (
        <div className="flex flex-wrap items-center gap-2">
          {!listener && (
            <>
              <select
                value={chosenInput}
                onChange={(e) => changeInput(e.target.value)}
                className="rounded-md border-2 border-black bg-bg-3 px-3 py-2 text-sm text-text outline-none focus:border-blue"
                title="L’entrée de ta carte son où la machine est branchée"
              >
                <option value="">Entrée par défaut</option>
                {inputs.filter((i) => i.id).map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </select>
              <button
                onClick={() => void audioEngine.listInputs().catch(() => {})}
                title="Rafraîchir la liste des entrées (après avoir branché la carte son)"
                className="btn-acid bg-bg-3 px-2.5 py-2 text-sm text-text-dim"
                style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
              >
                ↻
              </button>
              <button
                onClick={() => start(true)}
                className="btn-acid bg-green px-4 py-2 text-sm font-bold text-[#0a1404]"
              >
                🔊 Jouer : activer mon son
              </button>
            </>
          )}
          <button
            onClick={() => start(false)}
            className={listener ? 'btn-acid bg-green px-5 py-2.5 text-base font-bold text-[#0a1404]' : 'btn-acid bg-bg-3 px-4 py-2 text-sm text-text-dim'}
            style={listener ? undefined : { borderWidth: '2px', boxShadow: '3px 3px 0 #000' }}
          >
            {listener ? '🔊 Écouter la jam' : 'Seulement écouter'}
          </button>
          <span className="text-[11px] text-text-muted">
            {listener
              ? 'Un tap et tu entends la jam (Chrome ou Edge ; iPhone pas encore).'
              : 'Chrome demandera l’accès au micro : c’est l’entrée audio, pas un micro.'}
          </span>
        </div>
      )}

      {running && (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          {/* Mon envoi */}
          <div className="flex flex-col gap-2 rounded-[13px] border-2 border-black bg-bg-3 p-3" style={{ boxShadow: '2px 2px 0 #000' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.16em] text-text-dim">Mon envoi</span>
              {capturing ? (
                <button
                  onClick={() => audioEngine.setMuted(!muted)}
                  className={`btn-acid px-2.5 py-1 text-[11px] ${muted ? 'bg-red text-black' : 'bg-bg-2 text-text-dim'}`}
                  style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
                >
                  {muted ? 'COUPÉ · rétablir' : 'couper'}
                </button>
              ) : (
                !listener && (
                  <button
                    onClick={() => start(true)}
                    className="btn-acid bg-green px-2.5 py-1 text-[11px] font-bold text-[#0a1404]"
                    style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
                  >
                    activer mon son
                  </button>
                )
              )}
            </div>
            {capturing ? (
              <>
                <Meter level={muted ? 0 : inputLevel} />
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-dim">
                  <select
                    value={chosenInput}
                    onChange={(e) => changeInput(e.target.value)}
                    className="max-w-full rounded-md border border-line bg-bg-2 px-2 py-1 text-[11px] text-text outline-none"
                  >
                    <option value="">Entrée par défaut</option>
                    {inputs.filter((i) => i.id).map((i) => (
                      <option key={i.id} value={i.id}>{i.label}</option>
                    ))}
                  </select>
                  <span>{framesSent > 0 ? `${framesSent} tranches envoyées` : 'rien envoyé encore'}</span>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-text-dim">
                  <input
                    type="checkbox"
                    checked={directMonitor}
                    onChange={(e) => audioEngine.setDirectMonitor(e.target.checked)}
                  />
                  M’entendre en direct (ma machine tout de suite dans le casque du PC, avec les autres)
                </label>
                <label className="flex items-center gap-2 text-[11px] text-text-dim">
                  <input
                    type="checkbox"
                    checked={selfMonitor}
                    onChange={(e) => audioEngine.setSelfMonitor(e.target.checked)}
                  />
                  M’entendre en décalé (test solo : ma machine me revient un intervalle plus tard, comme pour les autres)
                </label>
                {noSignal && (
                  <span className="text-[11px] text-yellow">
                    Aucun signal : vérifie le câble machine → carte son et l’entrée choisie.
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-text-muted">Tu écoutes seulement.</span>
            )}
          </div>

          {/* Grille */}
          <div className="flex flex-col gap-2 rounded-[13px] border-2 border-black bg-bg-3 p-3" style={{ boxShadow: '2px 2px 0 #000' }}>
            <span className="text-[10px] uppercase tracking-[0.16em] text-text-dim">Grille de la jam</span>
            {grid ? (
              <span className="text-sm text-text">
                <b>{grid.bpm} BPM</b> × {grid.bpi} temps = {grid.bpi / 4} mesure{grid.bpi > 4 ? 's' : ''} ({(intervalMs(grid) / 1000).toFixed(1)} s)
              </span>
            ) : (
              <span className="text-[11px] text-text-muted">grille inconnue</span>
            )}
            {isHost ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <input
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  inputMode="decimal"
                  className="w-16 rounded-md border border-line bg-bg-2 px-2 py-1 text-[11px] text-text outline-none"
                  aria-label="BPM"
                />
                <select
                  value={bpi}
                  onChange={(e) => setBpi(Number(e.target.value))}
                  className="rounded-md border border-line bg-bg-2 px-2 py-1 text-[11px] text-text outline-none"
                  aria-label="Temps par intervalle"
                >
                  {BPI_CHOICES.map((n) => (
                    <option key={n} value={n}>{n} temps · {n / 4} mes.</option>
                  ))}
                </select>
                <button
                  onClick={applyGrid}
                  className="btn-acid bg-bg-2 px-2.5 py-1 text-[11px] text-text"
                  style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
                >
                  Appliquer
                </button>
                {machineBpm !== null && (
                  <button
                    onClick={() => { setBpm(String(Math.round(machineBpm * 10) / 10)); sendGrid(machineBpm, bpi); }}
                    className="btn-acid bg-bg-2 px-2.5 py-1 text-[11px] text-text-dim"
                    style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
                    title="Prend le tempo lu sur ta machine"
                  >
                    = ma machine ({Math.round(machineBpm)})
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-text-muted">L’hôte règle la grille. Mets ta machine au même BPM.</span>
            )}
          </div>

          {/* Les autres */}
          <div className="flex flex-col gap-2 rounded-[13px] border-2 border-black bg-bg-3 p-3 md:col-span-2" style={{ boxShadow: '2px 2px 0 #000' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.16em] text-text-dim">Ce que j’entends</span>
              <div className="w-40"><Meter level={outLevel} color="var(--color-cyan)" /></div>
            </div>
            {selfMonitor && (
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="w-28 truncate font-bold text-yellow">moi (test)</span>
                <div className="min-w-[120px] flex-1"><Meter level={peerAudio[SELF_ID]?.level ?? 0} color="var(--color-yellow)" /></div>
                <span className="text-text-muted">
                  {peerAudio[SELF_ID]?.chunks ? `intervalle ${peerAudio[SELF_ID]?.lastInterval}` : 'en attente du prochain intervalle'}
                </span>
              </div>
            )}
            {peerList.length === 0 && !selfMonitor && (
              <span className="text-[11px] text-text-muted">Personne d’autre pour l’instant. Envoie le lien, ou coche « M’entendre en décalé » pour tester seul.</span>
            )}
            {peerList.map((p) => {
              const a = peerAudio[p.id];
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="w-28 truncate font-bold text-text">{p.info.name}{p.isHost ? ' · hôte' : ''}</span>
                  <div className="min-w-[120px] flex-1"><Meter level={a?.muted ? 0 : (a?.level ?? 0)} color={p.info.color ?? 'var(--color-green)'} /></div>
                  <input
                    type="range" min={0} max={1.5} step={0.05}
                    value={a?.gain ?? 1}
                    onChange={(e) => audioEngine.setPeerGain(p.id, Number(e.target.value))}
                    className="w-24"
                    aria-label={`Volume de ${p.info.name}`}
                  />
                  <button
                    onClick={() => audioEngine.setPeerMuted(p.id, !(a?.muted ?? false))}
                    className={`btn-acid px-2 py-0.5 text-[10px] ${a?.muted ? 'bg-red text-black' : 'bg-bg-2 text-text-dim'}`}
                    style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
                  >
                    {a?.muted ? 'coupé' : 'couper'}
                  </button>
                  <span className="text-text-muted">
                    {a && a.chunks > 0 ? `intervalle ${a.lastInterval}` : p.info.listener ? 'écoute' : 'son pas encore activé'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
