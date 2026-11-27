// npm run qa:shots: кадры для отчёта. QA_MAP=file QA_STYLE=/tmp/style.json — подложка
// из локального файла: нужна, когда чужой тайл-сервер не отвечает.
import { serveSite } from './serve.mjs';
import { openSite, sleep, waitFor } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { stubMap } from './mapstub.mjs';

const OUT = process.env.QA_STYLE_OUT ?? '../design/redesign-2026-11-27/touch';
mkdirSync(OUT, { recursive: true });

/* QA_BASE — кадры с живого сайта, иначе со свежей сборки в out/ */
const remote = process.env.QA_BASE?.replace(/\/$/, '');
const site = remote
  ? { server: null, url: remote }
  : await serveSite(undefined, process.env.QA_PREFIX ?? '');
const { browser, page, errors } = await openSite(site.url);
const wide = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await stubMap(wide);

const pins = (p) => waitFor(p, () => document.querySelectorAll('.lpin, .lstack').length > 0, 180000, 'пины');

/* пин, по которому попадает курсор */
const hitPin = (p) =>
  p.evaluate(() => {
    for (const el of document.querySelectorAll('.lpin:not(.hide)')) {
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      const top = document.elementFromPoint(x, y);
      if (top && el.contains(top)) return { x, y, name: el.querySelector('.nm')?.textContent ?? '' };
    }
    return null;
  });

/* пустое место карты для удержания и панорамы */
const freeSpot = (p) =>
  p.evaluate(() => {
    const c = document.querySelector('.maplibregl-canvas');
    const r = c.getBoundingClientRect();
    for (let fy = 0.2; fy <= 0.62; fy += 0.05) {
      for (let fx = 0.2; fx <= 0.85; fx += 0.06) {
        const x = Math.round(r.x + r.width * fx);
        const y = Math.round(r.y + r.height * fy);
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('maplibregl-canvas')) return { x, y };
      }
    }
    return null;
  });

await page.goto(site.url + '/', { waitUntil: 'domcontentloaded' });
await pins(page);
await sleep(1400);
await page.screenshot({ path: `${OUT}/01-map-390.png` });

/* карточка пина: без кнопок, со стрелкой */
const pin = await hitPin(page);
if (!pin) throw new Error('нет пина под курсором');
await page.mouse.click(pin.x, pin.y);
await waitFor(page, () => !!document.querySelector('.pincard'), 8000, 'карточка');
await sleep(900);
await page.screenshot({ path: `${OUT}/02-card-390.png` });

/* карточка после панорамы: должна остаться под своим пином */
const spot = await freeSpot(page);
if (!spot) throw new Error('нет места для панорамы');
await page.mouse.move(spot.x, spot.y);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(spot.x + 9 * i, spot.y + 4 * i);
  await sleep(40);
}
await page.mouse.up();
await sleep(800);
await page.screenshot({ path: `${OUT}/03-card-after-pan-390.png` });

/* лист создания: кнопка одна, «Отмены» нет */
const spot2 = await freeSpot(page);
await page.mouse.click(spot2.x, spot2.y);
await sleep(400);
await page.mouse.move(spot2.x, spot2.y);
await page.mouse.down();
await sleep(800);
await page.mouse.up();
await waitFor(page, () => !!document.querySelector('.sheet'), 8000, 'лист создания');
await sleep(500);
await page.screenshot({ path: `${OUT}/04-create-sheet-390.png` });

/* десктоп: карточка и карта */
await wide.goto(site.url + '/', { waitUntil: 'domcontentloaded' });
await pins(wide);
await sleep(1600);
const widePin = await hitPin(wide);
if (widePin) {
  await wide.mouse.click(widePin.x, widePin.y);
  await waitFor(wide, () => !!document.querySelector('.pincard'), 8000, 'карточка на десктопе');
  await sleep(900);
}
await wide.screenshot({ path: `${OUT}/05-map-1440.png` });

if (errors.length) console.log('ошибки страницы:', errors.slice(0, 3));
await browser.close();
site.server?.close();
console.log('кадры:', OUT);
