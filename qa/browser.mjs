import { stubMap } from './mapstub.mjs';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function chromePath() {
  const hit = CANDIDATES.find((p) => existsSync(p));
  if (!hit) throw new Error('Chrome не найден: задайте CHROME_PATH');
  return hit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Движок — Playwright, браузер — системный Chrome: свои скриншоты, видео и CDP
   не пишем, всё есть в движке. */
export async function openSite(url, opts = {}) {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--hide-scrollbars',
      '--enable-unsafe-swiftshader',
      '--proxy-bypass-list=127.0.0.1;localhost',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
    /* видео пишет движок: свой скринкаст не нужен */
    ...(opts.video ? { recordVideo: { dir: opts.videoDir ?? 'qa-shots/video', size: { width: 390, height: 844 } } } : {}),
  });
  const page = await context.newPage();
  /* QA_MAP=stub — прогнать механику без чужого тайл-сервера (см. mapstub.mjs) */
  if (process.env.QA_MAP) await stubMap(page);
  /* GitHub Pages через прокси отдаёт документ по 10–20 секунд */
  page.setDefaultNavigationTimeout(75000);
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 200)));
  page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url().slice(0, 120)}`));
  return { browser, context, page, errors, url };
}

// Настоящий клик мышью по центру элемента. Только он считается проверкой:
// element.click() из кода проходит мимо pointer- и touch-обработчиков.
export async function click(page, selector, index = 0, label = selector) {
  const box = await page.evaluate(
    ([sel, i]) => {
      const el = document.querySelectorAll(sel)[i];
      if (!el) return null;
      /* пины живут в карте: scrollIntoView сдвигает их, а карта возвращает обратно,
         и клик уходит в пустоту */
      if (!el.closest('.lmap')) el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    [selector, index],
  );
  if (!box) throw new Error(`не найден элемент: ${label}`);
  await page.mouse.click(box.x, box.y);
  return box;
}

export async function boxOf(page, selector, index = 0) {
  return page.evaluate(
    ([sel, i]) => {
      const el = document.querySelectorAll(sel)[i];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    },
    [selector, index],
  );
}

// Тянем мышью, как человек: палец вниз, шаги, отпустить.
export async function dragX(page, box, dx, yInSet = 40, steps = 14) {
  const y = Math.round(box.y + yInSet);
  const from = Math.round(dx > 0 ? box.x + 30 : box.x + box.w - 30);
  await page.mouse.move(from, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from + (dx * i) / steps, y);
    await sleep(16);
  }
  await page.mouse.up();
  await sleep(700);
}

// Свайп пальцем: лента должна ехать на телефоне так же, как мышью.
export async function touchSwipe(page, box, dx, yInSet = 45, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  const y = Math.round(box.y + yInSet);
  const x0 = Math.round(dx > 0 ? box.x + 60 : box.x + box.w - 60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (dx * i) / steps, y }],
    });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await sleep(800);
}

// Пинч двумя пальцами. Второй палец — главный подозреваемый в ложном удержании:
// он приходит отдельным pointerdown и может пережить жест.
export async function pinch(page, spot, from = 70, to = 190, steps = 10) {
  const cdp = await page.context().newCDPSession(page);
  const pts = (d) => [
    { x: Math.round(spot.x - d / 2), y: Math.round(spot.y), id: 1 },
    { x: Math.round(spot.x + d / 2), y: Math.round(spot.y), id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pts(from + ((to - from) * i) / steps),
    });
    await sleep(60);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await sleep(900);
}

// Удержание мышью в точке: палец вниз, ждём, отпускаем.
export async function hold(page, x, y, ms = 800) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
  await sleep(600);
}

export async function waitFor(page, fn, timeout = 20000, label = 'условие', arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(250);
  }
  throw new Error(`не дождались за ${timeout} мс: ${label}`);
}

export { sleep };
