// Moteur audio du navigateur (ADR-007, « le son dans le navigateur »).
//
// Capture : entrée choisie → AudioWorklet (tranches de 20 ms) → AudioEncoder
// Opus (WebCodecs) → trame binaire datée sur la grille (intervalle + offset) →
// WebSocket de session. Lecture : trame d'un pair → AudioDecoder → PCM écrit à
// (intervalle + 1, même offset) dans l'anneau du worklet lecteur de ce pair.
// Tout le monde entend l'intervalle précédent des autres, calé sur la même
// grille (principe NINJAM), sans rien installer. Chrome / Edge (WebCodecs).
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

/** Id du lecteur « moi » (test solo : se réentendre un intervalle plus tard). */
export const SELF_ID = '__moi';

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

/** Retard estimé entrée → worklet (ms) ; constant, retranché de l'horodatage. */
const CAPTURE_LATENCY_MS = 20;
const RESYNC_MS = 5000;
const OPUS_FRAME_US = 20000;

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
};

class PeerPlayer {
  readonly node: AudioWorkletNode;
  readonly gain: GainNode;
  private decoder: AudioDecoder | null = null;
  private channels = 2;
  /** Position de lecture de chaque tranche envoyée au décodeur, dans l'ordre. */
  private playAt: number[] = [];

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

  private ensureDecoder(stereo: boolean): AudioDecoder {
    const channels = stereo ? 2 : 1;
    if (this.decoder && this.channels === channels) return this.decoder;
    this.decoder?.close();
    this.channels = channels;
    this.decoder = new AudioDecoder({
      output: (data) => this.onDecoded(data),
      error: (e) => {
        // Décodeur cassé : on le recrée à la prochaine tranche.
        diag.decoderError = String(e);
        this.decoder = null;
        this.playAt = [];
      },
    });
    this.decoder.configure({ codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: channels });
    return this.decoder;
  }

  push(payload: Uint8Array, at: number, timestampUs: number): void {
    // Bit « s » du TOC Opus : mono ou stéréo, pour configurer le décodeur.
    const stereo = ((payload[0] ?? 0) >> 2) & 1 ? true : false;
    const dec = this.ensureDecoder(stereo);
    if (dec.state !== 'configured') return;
    const copy = new Uint8Array(payload); // la trame WS peut être réutilisée
    this.playAt.push(at);
    dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: timestampUs, data: copy }));
  }

  private onDecoded(data: AudioData): void {
    const at = this.playAt.shift();
    if (at === undefined) {
      data.close();
      return;
    }
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
    this.playAt = [];
  }

  setGain(g: number): void {
    this.gain.gain.value = g;
  }

  close(): void {
    this.decoder?.close();
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
  private grid: AudioGrid | null = null;
  private players = new Map<string, PeerPlayer>();
  private resyncTimer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private seqInterval = Number.NaN;
  private levelAt = 0;

  isSupported(): boolean {
    return (
      typeof AudioContext !== 'undefined' &&
      typeof AudioEncoder !== 'undefined' &&
      typeof AudioDecoder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    );
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
    if (!this.isSupported()) {
      store.setStatus('error', 'Ce navigateur ne sait pas faire : il faut Chrome ou Edge.');
      return;
    }
    store.setStatus('starting');
    try {
      if (!this.ctx) {
        const ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'playback' });
        await ctx.audioWorklet.addModule('/worklets/capture.js');
        await ctx.audioWorklet.addModule('/worklets/player.js');
        this.master = ctx.createGain();
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.master.connect(this.analyser).connect(ctx.destination);
        this.ctx = ctx;
        this.resyncTimer = setInterval(() => this.resync(), RESYNC_MS);
      }
      await this.ctx.resume();
      this.resync();
      store.setWarning(null);
      if (!opts.capture) {
        this.stopCapture();
        store.setStatus('listening');
        return;
      }
      try {
        await this.startCapture(opts.deviceId ?? null);
        store.setStatus('live');
      } catch (e) {
        // Pas d'entrée : on n'est pas « en erreur », on écoute seulement.
        this.stopCapture();
        store.setStatus('listening');
        store.setWarning(describeCaptureError(e));
      }
    } catch (e) {
      store.setStatus('error', e instanceof Error ? e.message : String(e));
    }
  }

  private async startCapture(deviceId: string | null): Promise<void> {
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
    this.stream = stream;
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
    // Retour direct : la Korg dans le casque du PC sans attendre l'intervalle
    // (~20-30 ms de latence, celle du navigateur).
    const monitor = ctx.createGain();
    monitor.gain.value = useAudioStore.getState().directMonitor ? 1 : 0;
    source.connect(monitor).connect(this.master!);
    this.monitorGain = monitor;
    this.source = source;
    this.captureNode = node;
    const store = useAudioStore.getState();
    store.setCapturing(true);
    const used = stream.getAudioTracks()[0]?.getSettings().deviceId ?? deviceId;
    if (used) store.setInputId(used);
    void this.listInputs(); // libellés maintenant visibles
  }

  private stopCapture(): void {
    this.captureNode?.port.close();
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

  private ensureEncoder(channels: number): AudioEncoder {
    if (this.encoder && this.encoderChannels === channels && this.encoder.state === 'configured') {
      return this.encoder;
    }
    this.encoder?.close();
    this.encoderChannels = channels;
    const enc = new AudioEncoder({
      output: (chunk) => this.onEncoded(chunk),
      error: (e) => {
        diag.encoderError = String(e);
        useAudioStore.getState().setStatus('error', `Encodeur audio : ${String(e)}`);
        this.encoder = null;
      },
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
      diag.encoderError = String(e);
      useAudioStore.getState().setStatus('error', `Encodeur audio : ${String(e)}`);
    }
    this.encoder = enc;
    return enc;
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
    if (useAudioStore.getState().muted || !this.grid) return;
    const ch = m.channels.length;
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
    if (enc.state === 'configured') {
      diag.encodeCalls++;
      enc.encode(data);
    }
    data.close();
  }

  /** Instant performance.now() correspondant à un échantillon de contexte. */
  private perfOfFrame(frame: number): number {
    const ctx = this.ctx!;
    const ts = ctx.getOutputTimestamp?.();
    const contextTime = ts?.contextTime ?? ctx.currentTime;
    const perfTime = ts?.performanceTime ?? performance.now();
    return perfTime + (frame / SAMPLE_RATE - contextTime) * 1000;
  }

  private onEncoded(chunk: EncodedAudioChunk): void {
    const grid = this.grid;
    if (!grid) return;
    const frame = Math.round((chunk.timestamp / 1e6) * SAMPLE_RATE);
    const perf = this.perfOfFrame(frame) - CAPTURE_LATENCY_MS;
    const pos = positionAt(grid, clockSync.serverNow(perf));
    if (pos.interval !== this.seqInterval) {
      this.seqInterval = pos.interval;
      this.seq = 0;
    }
    const payload = new Uint8Array(chunk.byteLength);
    chunk.copyTo(payload);
    sendAudioFrame(
      encodeUpFrame({
        gridId: grid.id,
        interval: pos.interval,
        seq: this.seq++,
        offsetSamples: pos.offsetSamples,
        payload,
      }),
    );
    const store = useAudioStore.getState();
    store.sent();
    // Test solo : je m'entends un intervalle plus tard, comme mes potes m'entendent.
    if (store.selfMonitor) this.play(SELF_ID, payload, pos.interval, pos.offsetSamples);
  }

  /** Trame binaire reçue du relais (un pair a joué). */
  onFrame(bytes: Uint8Array): void {
    const grid = this.grid;
    const ctx = this.ctx;
    const master = this.master;
    if (!grid || !ctx || !master) return;
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
    let player = this.players.get(peerId);
    if (!player) {
      player = new PeerPlayer(ctx, master, peerId);
      this.players.set(peerId, player);
      this.syncPlayer(player);
    }
    const at = playbackSample(grid, { interval, offsetSamples });
    player.push(payload, at, Math.round((at / SAMPLE_RATE) * 1e6));
    useAudioStore.getState().peerChunk(peerId, interval);
  }

  setDirectMonitor(on: boolean): void {
    useAudioStore.getState().setDirectMonitor(on);
    if (this.monitorGain) this.monitorGain.gain.value = on ? 1 : 0;
  }

  setSelfMonitor(on: boolean): void {
    useAudioStore.getState().setSelfMonitor(on);
    if (!on) this.dropPeer(SELF_ID);
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

  private resync(): void {
    for (const p of this.players.values()) this.syncPlayer(p);
  }

  dropPeer(id: string): void {
    this.players.get(id)?.close();
    this.players.delete(id);
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
    this.stopCapture();
    for (const p of this.players.values()) p.close();
    this.players.clear();
    if (this.resyncTimer) clearInterval(this.resyncTimer);
    this.resyncTimer = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    if (ctx) await ctx.close().catch(() => {});
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
    const s = useAudioStore.getState();
    diag.ctxState = this.ctx?.state ?? 'none';
    diag.ctxTime = this.ctx?.currentTime ?? 0;
    const t = this.stream?.getAudioTracks()[0];
    diag.track = t ? `${t.label}|${t.readyState}|muted=${t.muted}|enabled=${t.enabled}|ch=${t.getSettings().channelCount ?? '?'}|sr=${t.getSettings().sampleRate ?? '?'}` : 'none';
    return {
      status: s.status,
      error: s.error,
      diag: { ...diag },
      encoderState: this.encoder?.state ?? 'none',
      capturing: s.capturing,
      framesSent: s.framesSent,
      framesReceived: s.framesReceived,
      peers: Object.fromEntries(
        Object.entries(s.peers).map(([id, p]) => [id, { chunks: p.chunks, level: p.level, lastInterval: p.lastInterval }]),
      ),
      outputLevel: this.outputLevel(),
      clockOffset: clockSync.offset,
      grid: this.grid,
    };
  }
}

export const audioEngine = new AudioEngine();

// Exposé pour les tests Playwright (lecture seule).
if (typeof window !== 'undefined') {
  (window as unknown as { __jamAudio: () => unknown }).__jamAudio = () => audioEngine.stats();
}
