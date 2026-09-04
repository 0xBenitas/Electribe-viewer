// Moteur audio du navigateur (ADR-007, « le son dans le navigateur »).
//
// Capture : entrée choisie → AudioWorklet (tranches de 20 ms) → AudioEncoder
// Opus (WebCodecs) → trame binaire datée sur la grille (intervalle + offset) →
// WebSocket de session. Lecture : trame d'un pair → AudioDecoder → PCM écrit à
// (intervalle + 1, même offset) dans l'anneau du worklet lecteur de ce pair.
// Tout le monde entend l'intervalle précédent des autres, calé sur la même
// grille (principe NINJAM), sans rien installer. Chrome / Edge (WebCodecs).
//
// Durci après l'audit du 2026-09-04 : horodatage de capture corrigé des
// latences réelles, encodeur jamais privé d'entrée (le mute coupe l'envoi, pas
// l'encodage), position de lecture portée par le timestamp du chunk (plus de
// file parallèle), lecteurs fermés pour de bon et réconciliés avec la room,
// plafond de lecteurs, fenêtre de validité des tranches, garde de génération
// sur start/stop, stats poussées par lot.
//
// Singleton module, comme `bridge` pour le MIDI. L'UI passe par `useAudioStore`.

import { clockSync } from './clock.ts';
import { useAudioStore } from '../store/audio.ts';
import { sendAudioFrame } from '../net/sessionLink.ts';
import {
  SAMPLE_RATE,
  playbackSample,
  positionAt,
  sampleAt,
  type AudioGrid,
} from '../core/audio/grid.ts';
import { decodeDownFrame, encodeUpFrame } from '../core/session/audioFrame.ts';
import type { OpusDecoder } from 'opus-decoder';

/** Chargé à la demande (≈100 Ko de WASM) : Chrome, qui a WebCodecs, ne le télécharge jamais. */
const loadOpusDecoder = () => import('opus-decoder').then((m) => m.OpusDecoder);

/** Décodeur : natif (WebCodecs) si le navigateur l'a, sinon Opus en WebAssembly
 *  (Safari / iPhone). `?wasmopus=1` force le WASM pour le tester dans Chrome. */
const FORCE_WASM =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('wasmopus');
const hasWebCodecsDecoder = (): boolean => typeof AudioDecoder !== 'undefined' && !FORCE_WASM;

/** Id du lecteur « moi » (test solo : se réentendre un intervalle plus tard). */
export const SELF_ID = '__moi';
/** Lecteurs simultanés max (chacun ≈ 12 Mo d'anneau + un décodeur). */
export const MAX_PLAYERS = 16;

/** Message français pour une erreur getUserMedia. */
export function describeCaptureError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Accès à l’entrée audio refusé : autorise le « micro » pour ce site (cadenas dans la barre d’adresse), puis réessaie.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Aucune entrée audio trouvée sur cet ordinateur : branche ta carte son (ou l’entrée ligne), vérifie Windows → Son → Entrée, puis « activer mon son ». En attendant, tu écoutes seulement.';
    case 'NotReadableError':
    case 'AbortError':
      return 'L’entrée audio est occupée par un autre logiciel (Jamtaba ? un DAW en ASIO ?) : ferme-le, puis « activer mon son ».';
    default:
      return `Entrée audio impossible : ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Latence d'entrée supposée quand la piste ne la déclare pas (ms). */
const DEFAULT_INPUT_LATENCY_MS = 20;
const RESYNC_MS = 5000;
const STATS_FLUSH_MS = 250;
const OPUS_FRAME_US = 20000;
/** Une tranche plus vieille que ça à l'arrivée est jetée (déjà passée). */
const LATE_WINDOW_SAMPLES = SAMPLE_RATE; // 1 s
/** … et plus en avance que ça aussi (horloge de l'émetteur fausse). */
const EARLY_WINDOW_SAMPLES = 20 * SAMPLE_RATE;
/** Bascule mono/stéréo du décodeur seulement après N tranches cohérentes. */
const CHANNEL_FLIP_HYSTERESIS = 5;

interface CaptureMessage {
  heartbeat?: boolean;
  inputs?: number;
  frame: number;
  channels: Float32Array[];
  rms: number;
  frames: number;
  idle: number;
}

/** Compteurs de diagnostic (tests de bout en bout, dépannage). */
const diag = {
  captured: 0,
  encodeCalls: 0,
  encoderError: '' as string,
  encoderSupported: null as boolean | null,
  decoderError: '' as string,
  ctxState: '' as string,
  workletFrames: 0,
  workletIdle: 0,
  workletHeartbeats: 0,
  processorError: '' as string,
  workletInputs: -2,
  ctxTime: 0,
  track: '' as string,
  droppedLate: 0,
  droppedEarly: 0,
  inputLatencyMs: 0,
};

class PeerPlayer {
  readonly node: AudioWorkletNode;
  readonly gain: GainNode;
  private decoder: AudioDecoder | null = null;
  /** Décodeur Opus WebAssembly (navigateurs sans WebCodecs : Safari, iPhone). */
  private wasm: OpusDecoder<48000> | null = null;
  private wasmReady = false;
  private wasmLoading = false;
  private wasmGen = 0;
  private wasmQueue: { payload: Uint8Array; at: number }[] = [];
  private channels = 0;
  private flipRun = 0;
  private closed = false;

  constructor(ctx: AudioContext, master: AudioNode, readonly id: string) {
    this.node = new AudioWorkletNode(ctx, 'jam-player', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.gain = ctx.createGain();
    this.node.connect(this.gain).connect(master);
    this.node.port.onmessage = (e: MessageEvent<{ type: string; rms: number }>) => {
      if (e.data.type === 'level') useAudioStore.getState().peerLevel(id, e.data.rms);
    };
  }

  /** Décodeur configuré pour `channels` ; ne bascule qu'après une série cohérente. */
  private ensureDecoder(wantChannels: number): AudioDecoder | null {
    if (this.decoder && this.channels === wantChannels) {
      this.flipRun = 0;
      return this.decoder;
    }
    if (this.decoder) {
      // Bit stéréo du TOC contrôlé par l'émetteur : pas de churn de décodeurs.
      if (++this.flipRun < CHANNEL_FLIP_HYSTERESIS) return this.decoder.state === 'configured' ? this.decoder : null;
      this.decoder.close();
    }
    this.flipRun = 0;
    this.channels = wantChannels;
    const dec = new AudioDecoder({
      output: (data) => this.onDecoded(data),
      error: (e) => {
        diag.decoderError = String(e);
        this.decoder = null; // recréé à la prochaine tranche
      },
    });
    dec.configure({ codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: wantChannels });
    this.decoder = dec;
    return dec;
  }

  /** `at` = échantillon de grille où jouer la tranche ; porté par le timestamp. */
  push(payload: Uint8Array, at: number): void {
    if (this.closed) return;
    const stereo = ((payload[0] ?? 0) >> 2) & 1 ? 2 : 1;
    if (!hasWebCodecsDecoder()) {
      this.pushWasm(payload, at, stereo);
      return;
    }
    const dec = this.ensureDecoder(stereo);
    if (!dec || dec.state !== 'configured') return;
    const copy = new Uint8Array(payload); // la trame WS peut être réutilisée
    dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round((at / SAMPLE_RATE) * 1e6), data: copy }));
  }

  /** Chemin WebAssembly : même hystérésis mono/stéréo, file d'attente le temps du chargement. */
  private pushWasm(payload: Uint8Array, at: number, wantChannels: number): void {
    if (this.wasm && this.channels !== wantChannels) {
      if (++this.flipRun < CHANNEL_FLIP_HYSTERESIS) wantChannels = this.channels;
      else {
        this.wasm.free();
        this.wasm = null;
        this.wasmReady = false;
        this.wasmQueue = [];
        this.wasmGen++;
      }
    } else {
      this.flipRun = 0;
    }
    if (!this.wasm && !this.wasmLoading) {
      this.channels = wantChannels;
      this.wasmLoading = true;
      const gen = ++this.wasmGen;
      void loadOpusDecoder()
        .then((Decoder) => {
          const dec = new Decoder({ channels: wantChannels, sampleRate: SAMPLE_RATE });
          return dec.ready.then(() => dec);
        })
        .then((dec) => {
          this.wasmLoading = false;
          if (this.closed || gen !== this.wasmGen) {
            dec.free();
            return;
          }
          this.wasm = dec;
          this.wasmReady = true;
          const q = this.wasmQueue;
          this.wasmQueue = [];
          for (const f of q) this.decodeWasm(f.payload, f.at);
        })
        .catch((e) => {
          this.wasmLoading = false;
          diag.decoderError = String(e);
        });
    }
    const copy = new Uint8Array(payload);
    if (!this.wasmReady) {
      if (this.wasmQueue.length < 400) this.wasmQueue.push({ payload: copy, at }); // ≤ 8 s
      return;
    }
    this.decodeWasm(copy, at);
  }

  private decodeWasm(payload: Uint8Array, at: number): void {
    const dec = this.wasm;
    if (!dec || this.closed) return;
    try {
      const out = dec.decodeFrame(payload);
      if (out.samplesDecoded <= 0) return;
      const channels = out.channelData.map((c) => c.slice(0, out.samplesDecoded));
      this.node.port.postMessage({ type: 'write', at, channels }, channels.map((b) => b.buffer));
    } catch (e) {
      diag.decoderError = String(e);
    }
  }

  private onDecoded(data: AudioData): void {
    if (this.closed) {
      data.close();
      return;
    }
    const at = Math.round((data.timestamp / 1e6) * SAMPLE_RATE);
    const frames = data.numberOfFrames;
    const ch = data.numberOfChannels;
    const channels: Float32Array[] = [];
    for (let c = 0; c < ch; c++) {
      const buf = new Float32Array(frames);
      data.copyTo(buf, { planeIndex: c, format: 'f32-planar' });
      channels.push(buf);
    }
    data.close();
    this.node.port.postMessage({ type: 'write', at, channels }, channels.map((b) => b.buffer));
  }

  sync(ctxFrame: number, gridSample: number): void {
    this.node.port.postMessage({ type: 'sync', ctxFrame, gridSample });
  }

  clear(): void {
    this.node.port.postMessage({ type: 'clear' });
  }

  setGain(g: number): void {
    this.gain.gain.value = g;
  }

  /** Arrêt définitif : le processeur rend false, le port est fermé, tout est libéré. */
  close(): void {
    this.closed = true;
    try {
      this.node.port.postMessage({ type: 'close' });
      this.node.port.close();
    } catch {
      // port déjà fermé
    }
    this.decoder?.close();
    this.decoder = null;
    this.wasm?.free();
    this.wasm = null;
    this.wasmGen++;
    this.wasmQueue = [];
    this.node.disconnect();
    this.gain.disconnect();
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private captureNode: AudioWorkletNode | null = null;
  /** Retour direct entrée → sortie (gain 0 ou 1), pour s'entendre via le PC. */
  private monitorGain: GainNode | null = null;
  private encoder: AudioEncoder | null = null;
  private encoderChannels = 0;
  private encoderFailed = false;
  private inputLatencyMs = DEFAULT_INPUT_LATENCY_MS;
  private grid: AudioGrid | null = null;
  private players = new Map<string, PeerPlayer>();
  private resyncTimer: ReturnType<typeof setInterval> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private seqInterval = Number.NaN;
  private levelAt = 0;
  /** Garde de génération : un start/stop pendant un await périme la suite. */
  private gen = 0;
  /** Stats par lot (250 ms) : le store ne churne pas à 50 Hz par pair. */
  private sentPending = 0;
  private chunkPending = new Map<string, { count: number; lastInterval: number }>();

  /** Sait jouer la jam : Web Audio + worklets + un décodeur (natif ou WASM). */
  supportsPlayback(): boolean {
    return (
      typeof AudioContext !== 'undefined' &&
      typeof AudioWorkletNode !== 'undefined' &&
      (typeof AudioDecoder !== 'undefined' || typeof WebAssembly !== 'undefined')
    );
  }

  /** Sait aussi envoyer son propre son : encodeur WebCodecs + entrée audio. */
  supportsCapture(): boolean {
    return (
      this.supportsPlayback() &&
      typeof AudioEncoder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }

  /** Rétro-compatible : « ça peut jouer ». */
  isSupported(): boolean {
    return this.supportsPlayback();
  }

  get running(): boolean {
    return this.ctx !== null;
  }

  /** Entrées audio disponibles (libellés complets seulement après une permission). */
  async listInputs(): Promise<{ id: string; label: string }[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, i) => ({ id: d.deviceId, label: d.label || `Entrée ${i + 1}` }));
    useAudioStore.getState().setInputs(inputs);
    return inputs;
  }

  /** À appeler depuis un geste utilisateur (politique autoplay). */
  async start(opts: { capture: boolean; deviceId?: string | null }): Promise<void> {
    const store = useAudioStore.getState();
    if (!this.supportsPlayback()) {
      store.setStatus('error', 'Ce navigateur ne sait pas jouer le son de la jam.');
      return;
    }
    if (opts.capture && !this.supportsCapture()) {
      opts = { ...opts, capture: false };
      store.setWarning('Ce navigateur ne sait pas envoyer ton son (il faut Chrome ou Edge sur ordinateur) : tu écoutes seulement.');
    }
    const myGen = ++this.gen;
    store.setStatus('starting');
    try {
      if (!this.ctx) {
        // iPhone : jouer même avec l'interrupteur « silencieux » (iOS 17+).
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) {
          try {
            nav.audioSession.type = 'playback';
          } catch {
            // ancien iOS
          }
        }
        // 'interactive' = petits tampons : l'horodatage de capture reste précis.
        // Créé ET repris DANS le geste utilisateur (avant tout await) : Safari
        // perd le geste après une promesse et laisserait le contexte suspendu.
        const ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' });
        void ctx.resume().catch(() => {});
        await ctx.audioWorklet.addModule('/worklets/capture.js');
        await ctx.audioWorklet.addModule('/worklets/player.js');
        if (myGen !== this.gen) {
          await ctx.close().catch(() => {});
          return;
        }
        this.master = ctx.createGain();
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.master.connect(this.analyser).connect(ctx.destination);
        this.ctx = ctx;
        ctx.onstatechange = () => {
          useAudioStore.getState().setCtxState(ctx.state);
          // Retour d'une suspension (appel, onglet en arrière-plan) : realigner.
          if (ctx.state === 'running') this.resync();
        };
        useAudioStore.getState().setCtxState(ctx.state);
        useAudioStore.getState().setDecoder(hasWebCodecsDecoder() ? 'webcodecs' : 'wasm');
        this.resyncTimer = setInterval(() => this.resync(), RESYNC_MS);
        this.statsTimer = setInterval(() => this.flushStats(), STATS_FLUSH_MS);
      }
      await this.ctx.resume();
      if (myGen !== this.gen) return;
      useAudioStore.getState().setCtxState(this.ctx.state);
      this.resync();
      store.setWarning(null);
      if (!opts.capture) {
        this.stopCapture();
        store.setStatus('listening');
        return;
      }
      try {
        await this.startCapture(opts.deviceId ?? null, myGen);
        if (myGen !== this.gen) return;
        store.setStatus('live');
      } catch (e) {
        if (myGen !== this.gen) return;
        // Pas d'entrée : on n'est pas « en erreur », on écoute seulement.
        this.stopCapture();
        store.setStatus('listening');
        store.setWarning(describeCaptureError(e));
      }
    } catch (e) {
      if (myGen !== this.gen) return;
      store.setStatus('error', e instanceof Error ? e.message : String(e));
    }
  }

  private async startCapture(deviceId: string | null, myGen: number): Promise<void> {
    const ctx = this.ctx!;
    this.stopCapture();
    const constraints = (id: string | null): MediaStreamConstraints => ({
      audio: {
        deviceId: id ? { exact: id } : undefined,
        // Musique, pas voix : aucun traitement.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
      },
      video: false,
    });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints(deviceId));
    } catch (e) {
      // L'entrée mémorisée n'existe plus (carte débranchée) : l'entrée par défaut.
      const name = e instanceof DOMException ? e.name : '';
      if (deviceId && (name === 'NotFoundError' || name === 'OverconstrainedError')) {
        stream = await navigator.mediaDevices.getUserMedia(constraints(null));
      } else {
        throw e;
      }
    }
    if (myGen !== this.gen || this.ctx !== ctx) {
      stream.getTracks().forEach((t) => t.stop()); // périmé pendant la permission
      return;
    }
    this.stream = stream;
    const track = stream.getAudioTracks()[0];
    const settings = track?.getSettings() as (MediaTrackSettings & { latency?: number }) | undefined;
    this.inputLatencyMs = settings?.latency ? settings.latency * 1000 : DEFAULT_INPUT_LATENCY_MS;
    diag.inputLatencyMs = this.inputLatencyMs;
    const source = ctx.createMediaStreamSource(stream);
    // Une sortie (muette) reliée à la destination : sans ça, un nœud sans route
    // vers la sortie n'est pas rendu et le worklet ne tourne jamais.
    const node = new AudioWorkletNode(ctx, 'jam-capture', { numberOfInputs: 1, numberOfOutputs: 1 });
    node.port.onmessage = (e: MessageEvent<CaptureMessage>) => this.onCaptured(e.data);
    node.onprocessorerror = (e) => {
      diag.processorError = String(e);
    };
    const sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(node).connect(sink).connect(ctx.destination);
    // Retour direct : la Korg dans le casque du PC sans attendre l'intervalle.
    const monitor = ctx.createGain();
    monitor.gain.value = useAudioStore.getState().directMonitor ? 1 : 0;
    source.connect(monitor).connect(this.master!);
    this.monitorGain = monitor;
    this.source = source;
    this.captureNode = node;
    this.encoderFailed = false;
    const store = useAudioStore.getState();
    store.setCapturing(true);
    const used = settings?.deviceId ?? deviceId;
    if (used) store.setInputId(used);
    void this.listInputs(); // libellés maintenant visibles
  }

  private stopCapture(): void {
    try {
      this.captureNode?.port.postMessage({ type: 'close' });
      this.captureNode?.port.close();
    } catch {
      // port déjà fermé
    }
    this.captureNode?.disconnect();
    this.monitorGain?.disconnect();
    this.monitorGain = null;
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.encoder?.close();
    this.encoder = null;
    this.encoderChannels = 0;
    this.captureNode = null;
    this.source = null;
    this.stream = null;
    useAudioStore.getState().setCapturing(false);
  }

  private ensureEncoder(channels: number): AudioEncoder | null {
    if (this.encoderFailed) return null;
    if (this.encoder && this.encoderChannels === channels && this.encoder.state === 'configured') {
      return this.encoder;
    }
    this.encoder?.close();
    this.encoderChannels = channels;
    const enc = new AudioEncoder({
      output: (chunk) => this.onEncoded(chunk),
      error: (e) => this.onEncoderError(e),
    });
    const config: AudioEncoderConfig = {
      codec: 'opus',
      sampleRate: SAMPLE_RATE,
      numberOfChannels: channels,
      bitrate: channels === 2 ? 96000 : 64000,
      opus: { frameDuration: OPUS_FRAME_US },
    };
    void AudioEncoder.isConfigSupported(config)
      .then((r) => {
        diag.encoderSupported = r.supported ?? null;
      })
      .catch(() => {
        diag.encoderSupported = false;
      });
    try {
      enc.configure(config);
    } catch (e) {
      this.onEncoderError(e);
      return null;
    }
    this.encoder = enc;
    return enc;
  }

  /** Encodeur cassé : on arrête la capture (pas 50 encodeurs par seconde). */
  private onEncoderError(e: unknown): void {
    diag.encoderError = String(e);
    this.encoderFailed = true;
    this.stopCapture();
    useAudioStore.getState().setStatus('error', `Encodeur audio : ${String(e)}`);
  }

  private onCaptured(m: CaptureMessage): void {
    diag.workletFrames = m.frames;
    diag.workletIdle = m.idle;
    if (m.heartbeat) {
      diag.workletHeartbeats++;
      diag.workletInputs = m.inputs ?? -1;
      return;
    }
    diag.captured++;
    const now = performance.now();
    if (now - this.levelAt > 100) {
      this.levelAt = now;
      useAudioStore.getState().setInputLevel(m.rms);
    }
    if (!this.grid) return;
    // Toujours encoder (mute compris) : l'encodeur date ses sorties en comptant
    // les échantillons reçus, un trou d'entrée le décalerait pour de bon.
    const ch = Math.min(2, m.channels.length);
    const frames = m.channels[0]!.length;
    const planar = new Float32Array(frames * ch);
    for (let c = 0; c < ch; c++) planar.set(m.channels[c]!, c * frames);
    const data = new AudioData({
      format: 'f32-planar',
      sampleRate: SAMPLE_RATE,
      numberOfFrames: frames,
      numberOfChannels: ch,
      timestamp: Math.round((m.frame / SAMPLE_RATE) * 1e6),
      data: planar,
    });
    const enc = this.ensureEncoder(ch);
    if (enc && enc.state === 'configured') {
      diag.encodeCalls++;
      enc.encode(data);
    }
    data.close();
  }

  /** Instant performance.now() où un échantillon de contexte SORT des enceintes. */
  private perfOfFrame(frame: number): number {
    const ctx = this.ctx!;
    const ts = ctx.getOutputTimestamp?.();
    const contextTime = ts?.contextTime ?? ctx.currentTime;
    const perfTime = ts?.performanceTime ?? performance.now();
    return perfTime + (frame / SAMPLE_RATE - contextTime) * 1000;
  }

  /** Instant de CAPTURE réel d'un échantillon : sortie − latences de sortie − latence d'entrée. */
  private captureInstant(frame: number): number {
    const ctx = this.ctx!;
    const outLatencyMs = (ctx.baseLatency + (ctx.outputLatency ?? 0)) * 1000;
    return this.perfOfFrame(frame) - outLatencyMs - this.inputLatencyMs;
  }

  private onEncoded(chunk: EncodedAudioChunk): void {
    const grid = this.grid;
    if (!grid || !clockSync.ready) return; // sans horloge serveur, une date serait fausse
    const frame = Math.round((chunk.timestamp / 1e6) * SAMPLE_RATE);
    const pos = positionAt(grid, clockSync.serverNow(this.captureInstant(frame)));
    if (pos.interval !== this.seqInterval) {
      this.seqInterval = pos.interval;
      this.seq = 0;
    }
    const seq = this.seq++;
    const store = useAudioStore.getState();
    if (store.muted) return; // couper = ne pas envoyer ; l'encodeur, lui, continue
    const payload = new Uint8Array(chunk.byteLength);
    chunk.copyTo(payload);
    sendAudioFrame(
      encodeUpFrame({ gridId: grid.id, interval: pos.interval, seq, offsetSamples: pos.offsetSamples, payload }),
    );
    this.sentPending++;
    // Test solo : je m'entends un intervalle plus tard, comme mes potes m'entendent.
    if (store.selfMonitor) this.play(SELF_ID, payload, pos.interval, pos.offsetSamples);
  }

  /** Trame binaire reçue du relais (un pair a joué). */
  onFrame(bytes: Uint8Array): void {
    const grid = this.grid;
    if (!grid || !this.ctx) return;
    const f = decodeDownFrame(bytes);
    if (!f || f.gridId !== grid.id) return;
    this.play(f.peerId, f.payload, f.interval, f.offsetSamples);
  }

  /** Programme une tranche d'un pair (ou de moi en test) un intervalle plus tard. */
  private play(peerId: string, payload: Uint8Array, interval: number, offsetSamples: number): void {
    const grid = this.grid;
    const ctx = this.ctx;
    const master = this.master;
    if (!grid || !ctx || !master) return;
    const at = playbackSample(grid, { interval, offsetSamples });
    if (clockSync.ready) {
      // Fenêtre de validité : le passé est perdu, un futur lointain est une horloge fausse.
      const nowSample = sampleAt(grid, clockSync.serverNow(performance.now()));
      if (at + 960 < nowSample - LATE_WINDOW_SAMPLES) {
        diag.droppedLate++;
        return;
      }
      if (at > nowSample + EARLY_WINDOW_SAMPLES) {
        diag.droppedEarly++;
        return;
      }
    }
    let player = this.players.get(peerId);
    if (!player) {
      if (this.players.size >= MAX_PLAYERS) return;
      player = new PeerPlayer(ctx, master, peerId);
      this.players.set(peerId, player);
      this.syncPlayer(player);
    }
    player.push(payload, at);
    const pending = this.chunkPending.get(peerId);
    if (pending) {
      pending.count++;
      pending.lastInterval = interval;
    } else {
      this.chunkPending.set(peerId, { count: 1, lastInterval: interval });
    }
  }

  private flushStats(): void {
    const store = useAudioStore.getState();
    if (this.sentPending) {
      store.sent(this.sentPending);
      this.sentPending = 0;
    }
    for (const [id, p] of this.chunkPending) store.peerChunk(id, p.lastInterval, p.count);
    this.chunkPending.clear();
  }

  setGrid(grid: AudioGrid): void {
    const changed = !this.grid || this.grid.id !== grid.id || this.grid.anchor !== grid.anchor;
    this.grid = grid;
    useAudioStore.getState().setGrid(grid);
    if (changed) {
      for (const p of this.players.values()) p.clear();
      this.seqInterval = Number.NaN;
      this.resync();
    }
  }

  private syncPlayer(p: PeerPlayer): void {
    const ctx = this.ctx;
    const grid = this.grid;
    if (!ctx || !grid || !clockSync.ready) return;
    const ts = ctx.getOutputTimestamp?.();
    const contextTime = ts?.contextTime ?? ctx.currentTime;
    const perfTime = ts?.performanceTime ?? performance.now();
    const ctxFrame = Math.round(contextTime * SAMPLE_RATE);
    const gridSample = sampleAt(grid, clockSync.serverNow(perfTime));
    p.sync(ctxFrame, gridSample);
  }

  /** iOS peut laisser le contexte suspendu : à rappeler depuis un tap. */
  async resume(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      await ctx.resume();
    } catch (e) {
      diag.decoderError = `resume: ${String(e)}`;
    }
    useAudioStore.getState().setCtxState(ctx.state);
    this.resync();
  }

  /** Réaligne tous les lecteurs sur l'horloge serveur (timer, 1er pong, reprise). */
  resync(): void {
    for (const p of this.players.values()) this.syncPlayer(p);
  }

  /** La liste réelle des pairs de la room (welcome) : les autres lecteurs meurent. */
  reconcile(peerIds: string[]): void {
    const keep = new Set(peerIds);
    for (const id of [...this.players.keys()]) {
      if (id !== SELF_ID && !keep.has(id)) this.dropPeer(id);
    }
  }

  dropPeer(id: string): void {
    this.players.get(id)?.close();
    this.players.delete(id);
    this.chunkPending.delete(id);
    useAudioStore.getState().dropPeer(id);
  }

  setMuted(muted: boolean): void {
    useAudioStore.getState().setMuted(muted);
  }

  setPeerGain(id: string, gain: number): void {
    this.players.get(id)?.setGain(gain);
    useAudioStore.getState().peerGain(id, gain);
  }

  setPeerMuted(id: string, muted: boolean): void {
    const g = useAudioStore.getState().peers[id]?.gain ?? 1;
    this.players.get(id)?.setGain(muted ? 0 : g);
    useAudioStore.getState().peerMuted(id, muted);
  }

  setDirectMonitor(on: boolean): void {
    useAudioStore.getState().setDirectMonitor(on);
    if (this.monitorGain) this.monitorGain.gain.value = on ? 1 : 0;
  }

  setSelfMonitor(on: boolean): void {
    useAudioStore.getState().setSelfMonitor(on);
    if (!on) this.dropPeer(SELF_ID);
  }

  /** Niveau RMS de la sortie (ce qu'on entend), 0..1. */
  outputLevel(): number {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
    return Math.sqrt(sum / buf.length);
  }

  async stop(): Promise<void> {
    this.gen++;
    this.stopCapture();
    for (const p of this.players.values()) p.close();
    this.players.clear();
    this.chunkPending.clear();
    if (this.resyncTimer) clearInterval(this.resyncTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.resyncTimer = null;
    this.statsTimer = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    if (ctx) {
      ctx.onstatechange = null;
      await ctx.close().catch(() => {});
    }
    useAudioStore.getState().setStatus('off');
  }

  /** Fin de session : tout couper, oublier la grille et les pairs. */
  leaveSession(): void {
    void this.stop();
    this.grid = null;
    useAudioStore.getState().reset();
  }

  /** Compteurs pour les tests de bout en bout. */
  stats(): Record<string, unknown> {
    this.flushStats();
    const s = useAudioStore.getState();
    diag.ctxState = this.ctx?.state ?? 'none';
    diag.ctxTime = this.ctx?.currentTime ?? 0;
    const t = this.stream?.getAudioTracks()[0];
    diag.track = t
      ? `${t.label}|${t.readyState}|muted=${t.muted}|enabled=${t.enabled}|ch=${t.getSettings().channelCount ?? '?'}|sr=${t.getSettings().sampleRate ?? '?'}`
      : 'none';
    return {
      status: s.status,
      error: s.error,
      diag: { ...diag },
      encoderState: this.encoder?.state ?? 'none',
      capturing: s.capturing,
      framesSent: s.framesSent,
      framesReceived: s.framesReceived,
      players: this.players.size,
      peers: Object.fromEntries(
        Object.entries(s.peers).map(([id, p]) => [id, { chunks: p.chunks, level: p.level, lastInterval: p.lastInterval }]),
      ),
      outputLevel: this.outputLevel(),
      clockOffset: clockSync.offset,
      grid: this.grid,
      decoder: hasWebCodecsDecoder() ? 'webcodecs' : 'wasm',
      canCapture: this.supportsCapture(),
    };
  }
}

export const audioEngine = new AudioEngine();

// Exposé pour les tests Playwright (lecture seule).
if (typeof window !== 'undefined') {
  (window as unknown as { __jamAudio: () => unknown }).__jamAudio = () => audioEngine.stats();
}
