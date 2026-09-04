// Test de bout en bout du son dans le navigateur (ADR-007) : deux Chromium headless
// (faux micro côté musicienne, un auditeur) sur la prod. Requiert `playwright`
// (npx playwright install chromium). Lancer : BASE=https://… node scripts/e2e-son.mjs
// Attendu : framesSent > 0 chez Alice, chunks > 0 et maxOutputLevel > 0 chez Bob.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'https://jamboreeeeeeee.duckdns.org';
const room = `e2e-son-${Math.random().toString(36).slice(2, 8)}`;
const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const errors = { a: [], b: [] };
async function open(tag, name) {
  const ctx = await browser.newContext({ permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors[tag].push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors[tag].push('console: ' + m.text()); });
  await page.goto(`${BASE}/?room=${room}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByLabel('Ton nom').fill(name);
  return page;
}
const a = await open('a', 'Alice');
await a.getByRole('button', { name: 'Créer / rejoindre' }).click();
await a.waitForSelector('text=Session «');
// Alice : musicienne, active son son (faux micro Chrome)
await a.getByRole('button', { name: /Jouer : activer mon son/ }).click();
await a.waitForSelector('text=EN DIRECT', { timeout: 15000 });
// Grille courte : 120 BPM × 4 temps = 2 s par intervalle
await a.getByLabel('BPM').fill('120');
await a.getByLabel('Temps par intervalle').selectOption('4');
await a.getByRole('button', { name: 'Appliquer' }).click();

const b = await open('b', 'Bob');
await b.getByRole('button', { name: 'Créer / rejoindre' }).click();
await b.waitForSelector('text=Session «');
await b.getByRole('button', { name: /Seulement écouter/ }).click();
await b.waitForSelector('text=ÉCOUTE', { timeout: 15000 });

// 3 intervalles de 2 s + marge
await b.waitForTimeout(7500);
let maxOut = 0;
for (let i = 0; i < 15; i++) {
  const s = await b.evaluate(() => window.__jamAudio());
  maxOut = Math.max(maxOut, s.outputLevel);
  await b.waitForTimeout(200);
}
const sa = await a.evaluate(() => window.__jamAudio());
const sb = await b.evaluate(() => window.__jamAudio());
await a.screenshot({ path: process.env.SHOT_A, fullPage: false });
await b.screenshot({ path: process.env.SHOT_B, fullPage: false });
const result = {
  room,
  alice: { status: sa.status, error: sa.error, framesSent: sa.framesSent, grid: sa.grid && { bpm: sa.grid.bpm, bpi: sa.grid.bpi }, diag: sa.diag, encoderState: sa.encoderState },
  bob: { status: sb.status, error: sb.error, framesReceived: sb.framesReceived, peers: sb.peers, maxOutputLevel: Number(maxOut.toFixed(4)), diag: sb.diag },
  errors,
};
console.log(JSON.stringify(result, null, 1));
await browser.close();
