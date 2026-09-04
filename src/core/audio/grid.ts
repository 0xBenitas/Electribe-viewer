// Grille d'intervalles de la jam (ADR-007, « le son dans le navigateur »).
//
// Principe NINJAM : le temps est découpé en intervalles de `bpi` temps à `bpm`.
// Chacun enregistre l'intervalle N ; tout le monde entend l'intervalle N des
// autres pendant l'intervalle N+1, calé sur la même grille. La grille vit en
// temps SERVEUR (ms, domaine Date.now du relais) : `anchor` = début de
// l'intervalle 0. Module pur, partagé client/serveur.

export interface AudioGrid {
  /** Change à chaque modification : les tranches d'une vieille grille sont ignorées. */
  id: number;
  bpm: number;
  /** Temps par intervalle (16 = 4 mesures en 4/4). */
  bpi: number;
  /** Temps serveur (ms) du début de l'intervalle 0. */
  anchor: number;
}

export const SAMPLE_RATE = 48000;
export const MIN_BPM = 40;
export const MAX_BPM = 300;
export const MIN_BPI = 2;
export const MAX_BPI = 64;

/** Un intervalle ne dépasse pas 16 s : c'est ce que le tampon de lecture absorbe. */
export const MAX_INTERVAL_MS = 16000;

export function clampGrid(bpm: number, bpi: number): { bpm: number; bpi: number } {
  const b = Number.isFinite(bpm) ? Math.round(bpm * 10) / 10 : 120;
  const i = Number.isFinite(bpi) ? Math.round(bpi) : 16;
  const out = {
    bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, b)),
    bpi: Math.min(MAX_BPI, Math.max(MIN_BPI, i)),
  };
  while (intervalMs(out) > MAX_INTERVAL_MS && out.bpi > MIN_BPI) out.bpi = Math.max(MIN_BPI, Math.floor(out.bpi / 2));
  return out;
}

/** Durée d'un intervalle en ms. */
export function intervalMs(grid: Pick<AudioGrid, 'bpm' | 'bpi'>): number {
  return (grid.bpi * 60000) / grid.bpm;
}

/** Durée d'un intervalle en échantillons (48 kHz), entière. */
export function intervalSamples(grid: Pick<AudioGrid, 'bpm' | 'bpi'>): number {
  return Math.round((intervalMs(grid) * SAMPLE_RATE) / 1000);
}

export interface GridPosition {
  /** Index d'intervalle (0 = anchor ; négatif avant l'anchor). */
  interval: number;
  /** Position dans l'intervalle, en échantillons 48 kHz. */
  offsetSamples: number;
}

/** Où tombe un instant serveur (ms) sur la grille. */
export function positionAt(grid: AudioGrid, serverMs: number): GridPosition {
  const len = intervalMs(grid);
  const rel = serverMs - grid.anchor;
  const interval = Math.floor(rel / len);
  const offsetMs = rel - interval * len;
  return {
    interval,
    offsetSamples: Math.min(
      intervalSamples(grid) - 1,
      Math.max(0, Math.round((offsetMs * SAMPLE_RATE) / 1000)),
    ),
  };
}

/** Temps serveur (ms) du début de l'intervalle `n`. */
export function intervalStartMs(grid: AudioGrid, n: number): number {
  return grid.anchor + n * intervalMs(grid);
}

/**
 * Échantillon absolu (depuis l'anchor, 48 kHz) auquel jouer une tranche captée
 * dans l'intervalle `interval` à `offsetSamples` : un intervalle plus tard.
 */
export function playbackSample(grid: AudioGrid, pos: GridPosition): number {
  return (pos.interval + 1) * intervalSamples(grid) + pos.offsetSamples;
}

/** Échantillon absolu (depuis l'anchor) correspondant à un instant serveur. */
export function sampleAt(grid: AudioGrid, serverMs: number): number {
  return Math.round(((serverMs - grid.anchor) * SAMPLE_RATE) / 1000);
}
