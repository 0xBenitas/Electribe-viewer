// Capture (ADR-007) : regroupe l'entrée en tranches de 960 échantillons (20 ms
// à 48 kHz, la taille d'une trame Opus) et les poste au thread principal avec
// le numéro d'échantillon du début (horloge du contexte) et le niveau RMS.
// Chrome livre des blocs de 128 échantillons ; 960 n'en est pas un multiple, on
// accumule donc dans un tampon double et on découpe en glissant.
const FRAME = 960;

class JamCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = null; // Float32Array[] par canal, capacité 2 × FRAME
    this.fill = 0;
    this.startFrame = 0;
    this.frames = 0;
    this.idle = 0;
    this.ticks = 0;
    this.closed = false;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'close') this.closed = true;
    };
  }

  process(inputs, outputs) {
    // Sortie muette : le nœud doit être relié à la destination pour être rendu.
    for (const out of outputs[0] ?? []) out.fill(0);
    const input = inputs[0];
    // Battement de diagnostic (~1 s) même sans entrée : dit si le worklet tourne.
    if (++this.ticks % 375 === 0) {
      this.port.postMessage({ heartbeat: true, frames: this.frames, idle: this.idle, inputs: input ? input.length : -1 });
    }
    if (this.closed) return false;
    if (!input || input.length === 0) {
      this.idle++;
      return true;
    }
    this.frames++;
    // Au plus 2 canaux : une interface 6 entrées ne doit pas casser l'encodeur Opus.
    const ch = Math.min(2, input.length);
    const n = input[0].length; // 128
    if (!this.buffers || this.buffers.length !== ch) {
      this.buffers = Array.from({ length: ch }, () => new Float32Array(FRAME * 2));
      this.fill = 0;
    }
    if (this.fill === 0) this.startFrame = currentFrame;
    for (let c = 0; c < ch; c++) this.buffers[c].set(input[c], this.fill);
    this.fill += n;
    while (this.fill >= FRAME) {
      const channels = this.buffers.map((b) => b.slice(0, FRAME));
      let sum = 0;
      const b0 = channels[0];
      for (let i = 0; i < FRAME; i++) sum += b0[i] * b0[i];
      this.port.postMessage(
        { frame: this.startFrame, channels, rms: Math.sqrt(sum / FRAME), frames: this.frames, idle: this.idle },
        channels.map((b) => b.buffer),
      );
      const rest = this.fill - FRAME;
      for (let c = 0; c < ch; c++) this.buffers[c].copyWithin(0, FRAME, this.fill);
      this.fill = rest;
      this.startFrame += FRAME;
    }
    return true;
  }
}

registerProcessor('jam-capture', JamCapture);
