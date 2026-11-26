// npm run qa:motion: записывает драг карты и собирает раскадровку.
// Видео пишет Playwright, кадры и склейку делает ffmpeg — своего скринкаста нет.
import { serveSite } from './serve.mjs';
import { openSite, sleep, waitFor } from './browser.mjs';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = process.env.QA_SHOTS ?? 'qa-shots';
const VIDEO = `${OUT}/video`;
const SHEET = `${OUT}/drag-contact.png`;

rmSync(VIDEO, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const site = await serveSite(undefined, process.env.QA_PREFIX ?? '');
const started = Date.now();
const { browser, page, errors } = await openSite(site.url, { video: true, videoDir: VIDEO });
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

/* запись начинается с открытия страницы: драг ищем по времени */
const dropAt = Math.max(0, (Date.now() - started) / 1000 - 0.2);
await page.mouse.move(spot.x, spot.y);
await page.mouse.down();
for (let i = 1; i <= 30; i++) {
  await page.mouse.move(spot.x - 6 * i, spot.y);
  await sleep(50);
}
await page.mouse.up();
await sleep(600);

/* видео закрывается вместе со страницей — берём путь до закрытия браузера */
const video = page.video();
await page.close();
const film = await video.path();
await browser.close();
site.server?.close();

if (errors.length) console.log('ошибки страницы:', errors.slice(0, 3));

/* 8 кадров из записи и сетка 4 × 2 */
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-ss', dropAt.toFixed(2),
  '-i', film,
  '-vf', 'fps=4,scale=390:-1,tile=4x2',
  '-frames:v', '1', SHEET,
]);

console.log(`видео: ${film}`);
console.log(`раскадровка: ${SHEET}`);
