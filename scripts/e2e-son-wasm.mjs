// Écoute avec le décodeur Opus WebAssembly forcé (?wasmopus=1) : le chemin iPhone/Safari,
// testé dans Chromium. Requiert `playwright`. Attendu : framesReceived > 0, maxOut > 0.
import { chromium } from 'playwright';
const BASE = 'https://jamboreeeeeeee.duckdns.org';
const room = `e2e-ecoute-${Math.random().toString(36).slice(2, 8)}`;
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const mk = async () => { const c = await browser.newContext({ permissions: ['microphone'] }); const p = await c.newPage(); p.on('pageerror', (e) => errors.push(e.message)); return p; };
const a = await mk();
await a.goto(`${BASE}/?room=${room}`, { waitUntil: 'networkidle' });
await a.getByLabel('Ton nom').fill('Alice');
await a.getByRole('button', { name: 'Créer / rejoindre' }).click();
await a.waitForSelector('text=Session «');
await a.getByRole('button', { name: /Jouer : activer mon son/ }).click();
await a.waitForSelector('text=EN DIRECT', { timeout: 15000 });
await a.getByLabel('BPM').fill('120'); await a.getByLabel('Temps par intervalle').selectOption('4'); await a.getByRole('button', { name: 'Appliquer' }).click();
// Le lien d'écoute tel que copié par le bouton
const listenLink = await a.locator('a[href*="listen=1"]').first().getAttribute('href');
const b = await mk();
await b.goto(listenLink + '&wasmopus=1', { waitUntil: 'networkidle' });
const joined = await b.waitForSelector('text=Session «', { timeout: 10000 }).then(() => true).catch(() => false);
const listenerBadge = await b.locator('text=écoute').count();
await b.getByRole('button', { name: /Écouter la jam/ }).click();
await b.waitForSelector('text=ÉCOUTE', { timeout: 15000 });
await b.waitForTimeout(6500);
let maxOut = 0;
for (let i = 0; i < 10; i++) { const s = await b.evaluate(() => window.__jamAudio()); maxOut = Math.max(maxOut, s.outputLevel); await b.waitForTimeout(200); }
const sb = await b.evaluate(() => window.__jamAudio());
await b.screenshot({ path: process.env.SHOT });
console.log(JSON.stringify({ listenLink, joined, listenerBadge, status: sb.status, framesReceived: sb.framesReceived, maxOut: Number(maxOut.toFixed(3)), errors }));
await browser.close();
