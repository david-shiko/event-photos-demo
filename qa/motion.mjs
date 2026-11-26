// npm run qa:motion: записывает драг карты кадрами и собирает раскадровку.
// Нужно, чтобы глазами видеть движение, а не догадываться по одному скриншоту.
import { serveSite } from './serve.mjs';
import { openSite, sleep, waitFor } from './browser.mjs';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = process.env.QA_SHOTS ?? 'qa-shots';
const FRAMES = `${OUT}/frames`;
const SHEET = `${OUT}/drag-contact.png`;

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const site = await serveSite(undefined, process.env.QA_PREFIX ?? '');
const { browser, page } = await openSite(site.url);
await page.goto(site.url + '/', { waitUntil: 'domcontentloaded' });
await waitFor(page, () => document.querySelectorAll('.lpin').length > 0, 45000, 'пины');
await sleep(1200);

/* точка старта — свободное место карты, иначе нажатие съест пин */
const spot = await page.evaluate(() => {
  const c = document.querySelector('.maplibregl-canvas');
  const r = c.getBoundingClientRect();
  for (let fy = 0.2; fy <= 0.6; fy += 0.05) {
    for (let fx = 0.2; fx <= 0.85; fx += 0.06) {
      const x = Math.round(r.x + r.width * fx);
      const y = Math.round(r.y + r.height * fy);
      const el = document.elementFromPoint(x, y);
      if (el && el.classList.contains('maplibregl-canvas')) return { x, y };
    }
  }
  return null;
});
if (!spot) throw new Error('на карте нет свободного места для драга');

const cdp = await page.createCDPSession();
let n = 0;
cdp.on('Page.screencastFrame', async (f) => {
  n++;
  writeFileSync(`${FRAMES}/f${String(n).padStart(3, '0')}.jpg`, Buffer.from(f.data, 'base64'));
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1, maxWidth: 390, maxHeight: 844 });

await page.mouse.move(spot.x, spot.y);
await page.mouse.down();
for (let i = 1; i <= 30; i++) {
  await page.mouse.move(spot.x - 6 * i, spot.y);
  await sleep(50);
}
await page.mouse.up();
await sleep(500);
await cdp.send('Page.stopScreencast');
await cdp.detach();

const all = readdirSync(FRAMES).sort();
if (all.length < 4) throw new Error(`записалось ${all.length} кадров — нечего смотреть`);

/* раскадровка: 8 кадров, 4 в ряд */
const step = Math.max(1, Math.floor(all.length / 8));
const picks = [];
for (let i = 0; i < all.length && picks.length < 8; i += step) picks.push(`${FRAMES}/${all[i]}`);
const args = picks.flatMap((f) => ['-i', f]);
const n2 = picks.length;
const layout = Array.from({ length: n2 }, (_, i) => `${(i % 4) * 390}_${Math.floor(i / 4) * 844}`).join('|');
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', ...args,
  '-filter_complex',
  picks.map((_, i) => `[${i}:v]scale=390:844[s${i}]`).join(';') + ';' + picks.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${n2}:layout=${layout}:fill=white`,
  '-frames:v', '1', SHEET,
]);

await browser.close();
site.server?.close();
console.log(`кадров записано: ${all.length}`);
console.log(`раскадровка: ${SHEET}`);
