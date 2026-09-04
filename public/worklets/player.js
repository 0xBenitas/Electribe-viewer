// Lecture d'un pair (ADR-007) : anneau d'échantillons indexé en temps de grille
// absolu (échantillons depuis l'anchor). Le thread principal écrit les tranches
// décodées à leur position ; ici on lit ce qui tombe sur l'instant courant,
// grâce à la correspondance (échantillon de contexte ↔ échantillon de grille)
// envoyée par 'sync'. Silence tant qu'aucune correspondance n'est connue.
const RING_SECONDS = 32;

class JamPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = RING_SECONDS * sampleRate;
    this.ring = [new Float32Array(this.size), new Float32Array(this.size)];
    this.baseCtx = null; // échantillon de contexte de référence
    this.baseGrid = 0; // échantillon de grille correspondant
    this.meterAcc = 0;
    this.meterN = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'sync') {
        const nb = m.gridSample - m.ctxFrame;
        if (this.baseCtx === null || Math.abs(nb - (this.baseGrid - this.baseCtx)) > 96) {
          this.baseCtx = m.ctxFrame;
          this.baseGrid = m.gridSample;
        }
      } else if (m.type === 'write') {
        this.write(m.at, m.channels);
      } else if (m.type === 'clear') {
        this.ring[0].fill(0);
        this.ring[1].fill(0);
        this.baseCtx = null;
      }
    };
  }

  write(at, channels) {
    const n = channels[0].length;
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
    const out = outputs[0];
    const n = out[0].length;
    if (this.baseCtx === null) return true; // silence
    let abs = this.baseGrid + (currentFrame - this.baseCtx);
    let idx = ((abs % this.size) + this.size) % this.size;
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
