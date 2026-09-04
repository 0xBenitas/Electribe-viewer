// Test « aucune entrée audio » (ADR-007) : sans faux micro, Chrome headless n’a
// pas d’entrée → attendu : status listening, pastille ÉCOUTE, avertissement FR.
import { chromium } from 'playwright';
// Sans faux périphérique : headless n'a aucune entrée audio → NotFoundError attendu.
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ permissions: ['microphone'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`https://jamboreeeeeeee.duckdns.org/?room=e2e-nodev-${Date.now()}`, { waitUntil: 'networkidle' });
await page.getByLabel('Ton nom').fill('SansEntree');
await page.getByRole('button', { name: 'Créer / rejoindre' }).click();
await page.waitForSelector('text=Session «');
await page.getByRole('button', { name: /Jouer : activer mon son/ }).click();
await page.waitForTimeout(3000);
const s = await page.evaluate(() => window.__jamAudio());
const warning = await page.locator('section:has-text("SON") p.text-yellow').first().textContent().catch(() => null);
const pill = await page.locator('section:has-text("SON") .pill-acid').first().textContent();
console.log(JSON.stringify({ status: s.status, error: s.error, pill, warning, errors }));
await browser.close();
