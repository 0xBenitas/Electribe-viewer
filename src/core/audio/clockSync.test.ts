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

  it('préfère l’échantillon au plus petit RTT', () => {
    const c = new ClockSync();
    c.addSample({ sentPerf: 0, recvPerf: 400, serverTs: 9000 }); // RTT 400, bruité
    c.addSample({ sentPerf: 1000, recvPerf: 1020, serverTs: 6010 }); // RTT 20
    expect(c.rtt).toBe(20);
    expect(c.offset).toBe(5000);
  });

  it('ignore un échantillon incohérent et vaut 0 sans données', () => {
    const c = new ClockSync();
    expect(c.ready).toBe(false);
    expect(c.offset).toBe(0);
    c.addSample({ sentPerf: 50, recvPerf: 10, serverTs: 1 });
    expect(c.ready).toBe(false);
  });
});
