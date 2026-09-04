import { create } from 'zustand';
import type { AudioGrid } from '../core/audio/grid.ts';

export type AudioStatus = 'off' | 'starting' | 'listening' | 'live' | 'error';

export interface AudioInput {
  id: string;
  label: string;
}

export interface PeerAudio {
  /** Niveau RMS 0..1 de ce qu'on joue de ce pair. */
  level: number;
  /** Dernier intervalle reçu. */
  lastInterval: number | null;
  chunks: number;
  muted: boolean;
  gain: number;
}

interface AudioStore {
  supported: boolean;
  status: AudioStatus;
  error: string | null;
  grid: AudioGrid | null;
  inputs: AudioInput[];
  inputId: string | null;
  capturing: boolean;
  muted: boolean;
  inputLevel: number;
  peers: Record<string, PeerAudio>;
  framesSent: number;
  framesReceived: number;
  /** Test solo : se réentendre un intervalle plus tard. */
  selfMonitor: boolean;
  /** Avertissement non bloquant (ex. pas d'entrée : on écoute seulement). */
  warning: string | null;

  setSupported: (v: boolean) => void;
  setSelfMonitor: (v: boolean) => void;
  setWarning: (w: string | null) => void;
  setStatus: (status: AudioStatus, error?: string | null) => void;
  setGrid: (grid: AudioGrid | null) => void;
  setInputs: (inputs: AudioInput[]) => void;
  setInputId: (id: string | null) => void;
  setCapturing: (v: boolean) => void;
  setMuted: (v: boolean) => void;
  setInputLevel: (v: number) => void;
  peerLevel: (id: string, level: number) => void;
  peerChunk: (id: string, interval: number) => void;
  peerGain: (id: string, gain: number) => void;
  peerMuted: (id: string, muted: boolean) => void;
  dropPeer: (id: string) => void;
  sent: () => void;
  reset: () => void;
}

const peerDefaults: PeerAudio = { level: 0, lastInterval: null, chunks: 0, muted: false, gain: 1 };

export const useAudioStore = create<AudioStore>((set) => ({
  supported: false,
  status: 'off',
  error: null,
  grid: null,
  inputs: [],
  inputId: null,
  capturing: false,
  muted: false,
  inputLevel: 0,
  peers: {},
  framesSent: 0,
  framesReceived: 0,
  selfMonitor: false,
  warning: null,

  setSupported: (supported) => set({ supported }),
  setSelfMonitor: (selfMonitor) => set({ selfMonitor }),
  setWarning: (warning) => set({ warning }),
  setStatus: (status, error = null) => set({ status, error }),
  setGrid: (grid) => set({ grid }),
  setInputs: (inputs) => set({ inputs }),
  setInputId: (inputId) => set({ inputId }),
  setCapturing: (capturing) => set({ capturing }),
  setMuted: (muted) => set({ muted }),
  setInputLevel: (inputLevel) => set({ inputLevel }),
  peerLevel: (id, level) =>
    set((s) => ({ peers: { ...s.peers, [id]: { ...peerDefaults, ...s.peers[id], level } } })),
  peerChunk: (id, interval) =>
    set((s) => {
      const p = { ...peerDefaults, ...s.peers[id] };
      return {
        framesReceived: s.framesReceived + 1,
        peers: { ...s.peers, [id]: { ...p, chunks: p.chunks + 1, lastInterval: interval } },
      };
    }),
  peerGain: (id, gain) =>
    set((s) => ({ peers: { ...s.peers, [id]: { ...peerDefaults, ...s.peers[id], gain } } })),
  peerMuted: (id, muted) =>
    set((s) => ({ peers: { ...s.peers, [id]: { ...peerDefaults, ...s.peers[id], muted } } })),
  dropPeer: (id) =>
    set((s) => {
      if (!(id in s.peers)) return {};
      const peers = { ...s.peers };
      delete peers[id];
      return { peers };
    }),
  sent: () => set((s) => ({ framesSent: s.framesSent + 1 })),
  reset: () =>
    set({ status: 'off', error: null, warning: null, grid: null, capturing: false, inputLevel: 0, peers: {}, framesSent: 0, framesReceived: 0 }),
}));
