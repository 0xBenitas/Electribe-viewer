// Estimation du temps serveur depuis l'horloge locale (performance.now), à
// partir des ping/pong du relais. Méthode NTP simplifiée : on garde l'échantillon
// au plus petit aller-retour parmi les derniers, son offset est le plus fiable.
// Module pur (pas d'I/O), testé.

export interface SyncSample {
  /** performance.now() à l'envoi du ping. */
  sentPerf: number;
  /** performance.now() à la réception du pong. */
  recvPerf: number;
  /** Date.now() du serveur au moment du pong. */
  serverTs: number;
}

export const SYNC_WINDOW = 8;

export class ClockSync {
  private samples: SyncSample[] = [];

  addSample(s: SyncSample): void {
    if (s.recvPerf < s.sentPerf) return; // horloge incohérente : ignoré
    this.samples.push(s);
    if (this.samples.length > SYNC_WINDOW) this.samples.shift();
  }

  get ready(): boolean {
    return this.samples.length > 0;
  }

  /** Meilleur échantillon = plus petit RTT. */
  private best(): SyncSample | null {
    let b: SyncSample | null = null;
    for (const s of this.samples) {
      if (!b || s.recvPerf - s.sentPerf < b.recvPerf - b.sentPerf) b = s;
    }
    return b;
  }

  /** Offset (ms) tel que serveur ≈ performance.now() + offset ; 0 si inconnu. */
  get offset(): number {
    const b = this.best();
    if (!b) return 0;
    const rtt = b.recvPerf - b.sentPerf;
    return b.serverTs - (b.sentPerf + rtt / 2);
  }

  /** RTT (ms) du meilleur échantillon, ou null. */
  get rtt(): number | null {
    const b = this.best();
    return b ? b.recvPerf - b.sentPerf : null;
  }

  serverNow(perfNow: number): number {
    return perfNow + this.offset;
  }

  reset(): void {
    this.samples = [];
  }
}
