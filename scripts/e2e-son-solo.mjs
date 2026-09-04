// Test solo du son navigateur (ADR-007) : « M’entendre en décalé » rejoue sa propre
// capture un intervalle plus tard. Requiert `playwright`. Attendu : moi.chunks > 0, maxOut > 0.
import { chromium } from 'playwright';
const room = `e2e-solo-${Math.random().toString(36).slice(2, 8)}`;
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ permissions: ['microphone'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`https://jamboreeeeeeee.duckdns.org/?room=${room}`, { waitUntil: 'networkidle' });
await page.getByLabel('Ton nom').fill('Solo');
await page.getByRole('button', { name: 'Créer / rejoindre' }).click();
await page.waitForSelector('text=Session «');
await page.getByRole('button', { name: /Jouer : activer mon son/ }).click();
await page.waitForSelector('text=EN DIRECT', { timeout: 15000 });
await page.getByLabel('BPM').fill('120');
await page.getByLabel('Temps par intervalle').selectOption('4');
await page.getByRole('button', { name: 'Appliquer' }).click();
await page.getByLabel(/M’entendre en décalé/).check();
await page.waitForTimeout(6500);
let maxOut = 0;
for (let i = 0; i < 10; i++) { const s = await page.evaluate(() => window.__jamAudio()); maxOut = Math.max(maxOut, s.outputLevel); await page.waitForTimeout(200); }
const s = await page.evaluate(() => window.__jamAudio());
await page.screenshot({ path: process.env.SHOT, fullPage: false });
console.log(JSON.stringify({ status: s.status, framesSent: s.framesSent, moi: s.peers['__moi'], maxOut: Number(maxOut.toFixed(3)), errors }));
await browser.close();
