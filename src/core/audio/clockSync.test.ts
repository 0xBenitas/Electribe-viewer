import { describe, it, expect } from 'vitest';
import { ClockSync } from './clockSync.ts';

describe('ClockSync', () => {
  it('estime l’offset depuis un aller-retour symétrique', () => {
    const c = new ClockSync();
    // envoyé à 100, reçu à 140 (RTT 40) ; serveur à 5000 au milieu (120)
    c.addSample({ sentPerf: 100, recvPerf: 140, serverTs: 5000 });
    expect(c.offset).toBe(4880);
    expect(c.serverNow(200)).toBe(5080);
    expect(c.rtt).toBe(40);
  });

  it('préfère l’échantillon au plus petit RTT (saut si l’écart est grand)', () => {
    const c = new ClockSync();
    c.addSample({ sentPerf: 0, recvPerf: 400, serverTs: 9000 }); // RTT 400, bruité → 8800
    c.addSample({ sentPerf: 1000, recvPerf: 1020, serverTs: 6010 }); // RTT 20 → 5000, écart > 30 ms
    expect(c.rtt).toBe(20);
    expect(c.offset).toBe(5000);
  });

  it('glisse de 2 ms max par échantillon quand l’écart est petit', () => {
    const c = new ClockSync();
    c.addSample({ sentPerf: 0, recvPerf: 20, serverTs: 5010 }); // offset 5000
    c.addSample({ sentPerf: 100, recvPerf: 110, serverTs: 5115 }); // RTT 10 (meilleur) → brut 5010
    expect(c.offset).toBe(5002);
    c.addSample({ sentPerf: 200, recvPerf: 212, serverTs: 5216 }); // RTT 12, meilleur reste 5010
    expect(c.offset).toBe(5004);
  });

  it('ignore un échantillon incohérent et vaut 0 sans données', () => {
    const c = new ClockSync();
    expect(c.ready).toBe(false);
    expect(c.offset).toBe(0);
    c.addSample({ sentPerf: 50, recvPerf: 10, serverTs: 1 });
    expect(c.ready).toBe(false);
  });
});
