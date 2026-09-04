// Attente du prochain Current Pattern Dump (0x40) après une demande 0x10.
// Module pur : la plomberie MIDI (bridge) appelle `deliver` à la réception.
//
// Règle née de l'incident du 2026-09-04 (docs/DECISIONS.md ADR-006) : on ne
// renvoie JAMAIS un dump périmé à la machine. Tout envoi commence par une
// demande fraîche ; sans réponse dans le délai, on n'envoie rien.

export class DumpAwaiter {
  private resolver: ((raw: Uint8Array | null) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private promise: Promise<Uint8Array | null> | null = null;

  /** Une attente est-elle en cours ? */
  get pending(): boolean {
    return this.promise !== null;
  }

  /**
   * Attend le prochain dump. Résout `null` si rien n'arrive dans `timeoutMs`.
   * Les appels concurrents partagent la même attente.
   */
  wait(timeoutMs: number): Promise<Uint8Array | null> {
    if (this.promise) return this.promise;
    this.promise = new Promise((resolve) => {
      this.resolver = resolve;
      this.timer = setTimeout(() => this.settle(null), timeoutMs);
    });
    return this.promise;
  }

  /** Dump reçu : résout l'attente en cours. Retourne false si personne n'attendait. */
  deliver(raw: Uint8Array): boolean {
    if (!this.promise) return false;
    this.settle(raw);
    return true;
  }

  private settle(value: Uint8Array | null): void {
    if (this.timer) clearTimeout(this.timer);
    const resolve = this.resolver;
    this.timer = null;
    this.resolver = null;
    this.promise = null;
    resolve?.(value);
  }
}
