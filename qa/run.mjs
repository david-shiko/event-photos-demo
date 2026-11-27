// npm run qa: играет собранный сайт настоящей мышью и падает, если что-то не реагирует.
import { serveSite } from './serve.mjs';
import { openSite, click, boxOf, dragX, touchSwipe, waitFor, sleep } from './browser.mjs';
import map from './checks/map.mjs';
import pages from './checks/pages.mjs';
import fixes from './checks/fixes.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

// QA_BASE=https://... — прогон по живому сайту вместо локальной сборки.
const remote = process.env.QA_BASE?.replace(/\/$/, '');
/* по живому адресу префикс берём из пути: /event-photos-demo */
const prefix = process.env.QA_PREFIX ?? (remote ? new URL(remote).pathname.replace(/\/$/, '') : '');
const SHOTS = process.env.QA_SHOTS ?? 'qa-shots';
const site = remote ? { server: null, url: remote } : await serveSite(undefined, prefix);
const { server, url } = site;
const { browser, page, errors } = await openSite(url);

const ctx = {
  page,
  prefix,
  base: url,
  click,
  boxOf,
  dragX: (box, dx, yInSet) => dragX(page, box, dx, yInSet),
  touchSwipe: (box, dx) => touchSwipe(page, box, dx),
  waitFor: (fn, timeout, label) => waitFor(page, fn, timeout, label),
  sleep,
  errors,
  ok: (cond, msg) => {
    if (!cond) throw new Error(msg);
  },
  eq: (got, want, msg) => {
    if (got !== want) throw new Error(`${msg}: получили ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`);
  },
  near: (got, want, tol, msg) => {
    if (Math.abs(got - want) > tol) throw new Error(`${msg}: ${got} против ${want} (допуск ${tol})`);
  },
  go: async (path) => {
    errors.length = 0;
    await page.goto(url + path, { waitUntil: 'domcontentloaded' });
    await sleep(400);
  },
};

const results = [];
mkdirSync(SHOTS, { recursive: true });
for (const check of [...map, ...pages, ...fixes]) {
  const t0 = Date.now();
  try {
    await check.run(ctx);
    if (errors.length) throw new Error('ошибки в консоли: ' + errors.slice(0, 3).join(' | '));
    results.push({ name: check.name, ok: true, ms: Date.now() - t0 });
  } catch (e) {
    /* провал надо увидеть: кадр и текст ошибки рядом, иначе чинишь вслепую */
    const slug = check.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
    const shot = `${SHOTS}/${String(results.length + 1).padStart(2, '0')}-${slug}.png`;
    try {
      await page.screenshot({ path: shot });
    } catch {
      /* страница могла умереть — тогда остаётся только текст */
    }
    results.push({
      name: check.name,
      ok: false,
      ms: Date.now() - t0,
      detail: String(e.message ?? e).split('\n')[0],
      shot,
    });
  }
}

await browser.close();
server?.close();

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  const line = `${r.ok ? '✓' : '✗'} ${r.name} — ${(r.ms / 1000).toFixed(1)} с`;
  console.log(r.ok ? line : `${line}\n    ${r.detail}${r.shot ? `\n    кадр: ${r.shot}` : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} прошло`);
process.exit(failed.length ? 1 : 0);
