import { ClockSync } from '../core/audio/clockSync.ts';

/** Horloge serveur estimée depuis les ping/pong du relais (singleton app). */
export const clockSync = new ClockSync();
