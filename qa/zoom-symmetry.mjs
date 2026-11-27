// Разовая проверка: одинаково ли раскладываются кластеры при отдалении и приближении.
import { serveSite } from './serve.mjs';
import { openSite, sleep, waitFor, click } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const remote = process.env.QA_BASE?.replace(/\/$/, '');
const site = remote ? { server: null, url: remote } : await serveSite(undefined, process.env.QA_PREFIX ?? '');
const { browser, page, errors } = await openSite(site.url);
await page.goto(site.url + '/', { waitUntil: 'domcontentloaded' });
try {
  await waitFor(page, () => document.querySelectorAll('.lpin, .lstack').length > 0, 60000, 'пины');
} catch (e) {
  console.log('ошибки страницы:', errors.slice(0, 5));
  throw e;
}
await sleep(1200);
mkdirSync('qa-shots/zoom', { recursive: true });

const marks = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.lstack:not(.hide), .lpin:not(.hide)')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.classList.contains('lstack') ? 'S' + (el.querySelector('b')?.textContent ?? '') : 'P:' + (el.querySelector('.nm')?.textContent ?? '').slice(0, 12)}@${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`;
      })
      .sort()
      .join(' | '),
  );

const out = [];
for (let i = 0; i <= 5; i++) {
  if (i) {
    await click(page, '.maplibregl-ctrl-zoom-out');
    await sleep(700);
  }
  await page.screenshot({ path: `qa-shots/zoom/out-${i}.png` });
  out.push({ i, m: await marks() });
}
const back = [];
for (let i = 0; i <= 5; i++) {
  if (i) {
    await click(page, '.maplibregl-ctrl-zoom-in');
    await sleep(700);
  }
  await page.screenshot({ path: `qa-shots/zoom/in-${i}.png` });
  back.push({ i, m: await marks() });
}

const norm = (s) =>
  s
    .split(' | ')
    .map((x) => x.replace(/@\d+,\d+$/, ''))
    .sort()
    .join(' | ');

for (let i = 0; i <= 5; i++) {
  const a = norm(out[i].m);
  const b = norm(back[5 - i].m);
  console.log(`шаг ${i}: ${a === b ? 'совпало' : 'РАСХОДИТСЯ'}`);
  if (a !== b) {
    console.log('  отдаление:', a);
    console.log('  приближение:', b);
  }
}
await browser.close();
site.server?.close();
