// Lecture d'un pair (ADR-007) : anneau d'échantillons indexé en temps de grille
// absolu (échantillons depuis l'anchor). Le thread principal écrit les tranches
// décodées à leur position ; ici on lit ce qui tombe sur l'instant courant,
// grâce à la correspondance (échantillon de contexte ↔ échantillon de grille)
// envoyée par 'sync'. Silence tant qu'aucune correspondance n'est connue.
//
// Durci (audit 2026-09-04) : une tranche en retard (derrière la tête) ou trop
// en avance (plus d'un demi-anneau) est ignorée au lieu de rejouer un tour
// plus tard ; une resynchronisation < 30 ms glisse d'un échantillon par bloc
// (pas de clic), au-delà elle saute ; 'close' arrête le processeur pour de bon
// (sinon un pair parti garde ses 12 Mo dans le thread audio).
const RING_SECONDS = 32;
const JUMP_SAMPLES = 1440; // 30 ms à 48 kHz

class JamPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = RING_SECONDS * sampleRate;
    this.ring = [new Float32Array(this.size), new Float32Array(this.size)];
    /** delta = échantillon de grille − échantillon de contexte ; null = inconnu. */
    this.delta = null;
    this.targetDelta = null;
    this.closed = false;
    this.meterAcc = 0;
    this.meterN = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'sync') {
        const nd = m.gridSample - m.ctxFrame;
        if (this.delta === null || Math.abs(nd - this.delta) > JUMP_SAMPLES) this.delta = nd;
        this.targetDelta = nd;
      } else if (m.type === 'write') {
        this.write(m.at, m.channels);
      } else if (m.type === 'clear') {
        this.ring[0].fill(0);
        this.ring[1].fill(0);
        this.delta = null;
        this.targetDelta = null;
      } else if (m.type === 'close') {
        this.closed = true;
      }
    };
  }

  /** Position de grille du prochain échantillon rendu (null si non synchronisé). */
  head() {
    return this.delta === null ? null : currentFrame + this.delta;
  }

  write(at, channels) {
    const n = channels[0].length;
    const head = this.head();
    if (head !== null) {
      if (at + n <= head) return; // en retard : déjà passé, ne pas rejouer plus tard
      if (at > head + this.size / 2) return; // trop en avance : horloge fausse
    }
    const left = channels[0];
    const right = channels[1] ?? channels[0];
    let idx = ((at % this.size) + this.size) % this.size;
    for (let i = 0; i < n; i++) {
      this.ring[0][idx] = left[i];
      this.ring[1][idx] = right[i];
      idx++;
      if (idx === this.size) idx = 0;
    }
  }

  process(_inputs, outputs) {
    if (this.closed) return false;
    const out = outputs[0];
    const n = out[0].length;
    if (this.delta === null) return true; // silence
    // Glissement doux vers la nouvelle correspondance : 1 échantillon par bloc.
    if (this.targetDelta !== null && this.targetDelta !== this.delta) {
      this.delta += Math.sign(this.targetDelta - this.delta);
    }
    let idx = (((currentFrame + this.delta) % this.size) + this.size) % this.size;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const l = this.ring[0][idx];
      const r = this.ring[1][idx];
      out[0][i] = l;
      if (out[1]) out[1][i] = r;
      sum += l * l;
      // On efface après lecture : rien de périmé ne rejoue au tour suivant.
      this.ring[0][idx] = 0;
      this.ring[1][idx] = 0;
      idx++;
      if (idx === this.size) idx = 0;
    }
    this.meterAcc += sum;
    this.meterN += n;
    if (this.meterN >= sampleRate / 10) {
      this.port.postMessage({ type: 'level', rms: Math.sqrt(this.meterAcc / this.meterN) });
      this.meterAcc = 0;
      this.meterN = 0;
    }
    return true;
  }
}

registerProcessor('jam-player', JamPlayer);
