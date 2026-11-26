// Проверки карты: лента суток, дни, точки, пины. Всё — настоящими событиями ввода.
import { sleep } from '../browser.mjs';

const PX_PER_MIN = 52 / 60;

/* Свободное место на самой карте: шапка, пины и панель перехватывают нажатие. */
const freeSpot = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.maplibregl-canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    for (let fy = 0.14; fy <= 0.62; fy += 0.06) {
      for (let fx = 0.18; fx <= 0.9; fx += 0.08) {
        const x = Math.round(r.x + r.width * fx);
        const y = Math.round(r.y + r.height * fy);
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('maplibregl-canvas')) return { x, y };
      }
    }
    return null;
  });

/* Тянем карту от свободной точки. Кнопку отпускаем всегда, иначе следующая
   проверка падает с «left is already pressed» вместо своей ошибки. */
const pan = async (page, spot, dx, dy, steps, onStep) => {
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  try {
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(spot.x + (dx * i) / steps, spot.y + (dy * i) / steps);
      await sleep(70);
      if (onStep) await onStep(i);
    }
  } finally {
    await page.mouse.up();
    await sleep(400);
  }
};

/* Ждём, пока метка перестанет ездить: после загрузки карта ещё доезжает. */
const stable = async (page, sel) => {
  let prev = null;
  for (let i = 0; i < 25; i++) {
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return [Math.round(b.x), Math.round(b.y)];
    }, sel);
    if (r && prev && r[0] === prev[0] && r[1] === prev[1]) return r;
    prev = r;
    await sleep(120);
  }
  throw new Error(`положение ${sel} не стабилизировалось`);
};

export const state = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.railscroll');
    if (!el) return null;
    /* лента с отступом в половину ширины: время = scrollLeft / px-за-минуту */
    const raw = el.scrollLeft / (52 / 60);
    const min = Math.round(raw);
    const t = ((min % 1440) + 1440) % 1440;
    const pad = (x) => String(Math.floor(x)).padStart(2, '0');
    return {
      railMin: min,
      railDay: Math.floor(min / 1440),
      railClock: pad(t / 60) + ':' + pad(t % 60),
      header: document.querySelector('.mhdate')?.textContent ?? '',
      clock: document.querySelector('.mhtime')?.textContent ?? '',
      pins: document.querySelectorAll('.lpin').length,
      empty: !!document.querySelector('.mempty'),
      card: document.querySelector('.pincard .pt')?.textContent ?? null,
      panelCard: !!document.querySelector('.mbottom .mcard'),
    };
  });

const mins = (clock) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};

export default [
  {
    name: 'лента: драг мышью вперёд',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => !!document.querySelector('.raildot'), 15000, 'лента суток');
      const a = await state(h.page);
      h.ok(!a.panelCard, 'над лентой снова висит карточка вечера — по дизайну её там нет');
      const box = await h.boxOf(h.page, '.railscroll');
      await h.dragX(box, -240);
      const b = await state(h.page);
      h.ok(b.railMin - a.railMin >= 150, `лента сдвинулась на ${b.railMin - a.railMin} мин, ждали ≥150`);
      h.near(mins(b.clock), mins(b.railClock), 6, 'время в шапке против времени под стрелкой');
      h.ok(b.header !== a.header || b.clock !== a.clock, 'шапка не изменилась за 240 px драга');
    },
  },
  {
    name: 'лента: драг мышью назад',
    run: async (h) => {
      const a = await state(h.page);
      const box = await h.boxOf(h.page, '.railscroll');
      await h.dragX(box, 180);
      const b = await state(h.page);
      h.ok(a.railMin - b.railMin >= 120, `лента вернулась на ${a.railMin - b.railMin} мин, ждали ≥120`);
      h.near(mins(b.clock), mins(b.railClock), 6, 'время в шапке против времени под стрелкой');
    },
  },
  {
    name: 'день: выбор дня переставляет ленту',
    run: async (h) => {
      await h.click(h.page, '.days button', 2);
      await h.sleep(1000);
      const s = await state(h.page);
      h.ok(s.header.includes('12 июля'), `в шапке «${s.header}», ждали 12 июля`);
      h.ok(s.railDay === 2, `лента на дне ${s.railDay}, ждали день 2`);
      h.near(mins(s.clock), mins(s.railClock), 6, 'шапка и лента после выбора дня');
    },
  },
  {
    name: 'точка вечера: клик перематывает ленту',
    run: async (h) => {
      const dot = await h.page.evaluate(() => {
        const box = document.querySelector('.railscroll').getBoundingClientRect();
        const hits = [...document.querySelectorAll('.raildot')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.x > box.x + 30 && r.x < box.x + box.width - 30);
        const hit = hits[0];
        if (!hit) return null;
        return {
          x: hit.r.x + hit.r.width / 2,
          y: hit.r.y + hit.r.height / 2,
          label: hit.el.getAttribute('aria-label'),
        };
      });
      h.ok(!!dot, 'в поле зрения нет ни одной точки вечера');
      await h.page.mouse.click(dot.x, dot.y);
      await h.sleep(1100);
      const s = await state(h.page);
      h.eq(s.card, dot.label, 'карточка открытого вечера');
      h.near(mins(s.clock), mins(s.railClock), 6, 'шапка и лента после точки');
    },
  },
  {
    name: 'пустое время: «к нему» возвращает на вечер',
    run: async (h) => {
      await h.click(h.page, '.days button', 3);
      await h.sleep(1000);
      const empty = await state(h.page);
      h.ok(empty.empty, 'на пустом дне показана карточка события, а не «пока пусто»');
      h.ok(empty.header.includes('13 июля'), `в шапке «${empty.header}»`);
      await h.click(h.page, '.mempty button');
      await h.sleep(1100);
      const s = await state(h.page);
      h.ok(!s.empty, 'после «к нему» пустое состояние не ушло');
      h.ok(s.pins > 0 || s.card, 'после «к нему» на карте нет ни вечера, ни карточки');
      h.ok(s.railDay >= 4, `лента не переехала на день вечера (день ${s.railDay})`);
      h.near(mins(s.clock), mins(s.railClock), 6, 'шапка и лента после «к нему»');
    },
  },
  {
    name: 'лента: стрелка клавиатуры',
    run: async (h) => {
      const box = await h.boxOf(h.page, '.railscroll');
      await h.page.mouse.click(box.x + 6, box.y + 62);
      const a = await state(h.page);
      await h.page.keyboard.press('ArrowRight');
      await h.sleep(700);
      const b = await state(h.page);
      h.near(b.railMin - a.railMin, 15, 6, 'шаг стрелки клавиатуры');
    },
  },
  {
    name: 'лента: свайп пальцем',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => !!document.querySelector('.raildot'), 15000, 'лента суток');
      const a = await state(h.page);
      const box = await h.boxOf(h.page, '.railscroll');
      await h.touchSwipe(box, -220);
      const b = await state(h.page);
      h.ok(b.railMin - a.railMin >= 150, `палец сдвинул ленту на ${b.railMin - a.railMin} мин, ждали ≥150`);
      h.near(mins(b.clock), mins(b.railClock), 6, 'шапка и лента после свайпа');
    },
  },
  {
    name: 'день: лента встаёт ровно на тот же час',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => !!document.querySelector('.raildot'), 15000, 'лента суток');
      const before = await state(h.page);
      await h.click(h.page, '.days button', 6);
      await h.sleep(1600);
      const after = await state(h.page);
      h.ok(after.header.includes('16 июля'), `в шапке «${after.header}»`);
      h.eq(after.clock, before.clock, 'время при переключении дня');
      h.near(mins(after.clock), mins(after.railClock), 6, 'шапка и лента после дня 16');
    },
  },
  {
    name: 'карта: пины едут вместе с картой',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin:not(.lstack)').length > 0, 45000, 'пины');
      const spots = () =>
        h.page.evaluate(() =>
          [...document.querySelectorAll('.lpin:not(.lstack):not(.hide)')]
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { name: el.querySelector('.nm')?.textContent ?? '', x: Math.round(r.x + r.width / 2), w: r.width };
            })
            /* пин нулевого размера — это уже поломка, её ловит проверка про шапку */
            .filter((p) => p.w > 0)
            .map((p) => [p.name, p.x]),
        );
      const spot = await freeSpot(h.page);
      h.ok(!!spot, 'на карте нет свободного места: всё занято шапкой и панелью');
      const before = Object.fromEntries(await spots());
      const names = Object.keys(before).slice(0, 3);
      h.ok(names.length >= 2, `на карте ${names.length} пинов — не на чем мерить`);
      let prev = before;
      await pan(h.page, spot, -96, 0, 8, async (i) => {
        const now = Object.fromEntries(await spots());
        for (const n of names) {
          h.ok(n in now, `пин «${n}» исчез на шаге ${i}`);
          h.near(now[n] - prev[n], -12, 2, `сдвиг пина «${n}» на шаге ${i} против хода мыши`);
        }
        prev = now;
      });
    },
  },
  {
    name: 'зум: стопка раскрывается на отдельные пины',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => !!document.querySelector('.lstack'), 45000, 'стопка пинов');
      const count = () =>
        h.page.evaluate(() => document.querySelectorAll('.lpin:not(.hide), .lstack:not(.hide)').length);
      const before = await count();
      const box = await h.boxOf(h.page, '.lmap');
      await h.page.mouse.move(box.x + box.w / 2, box.y + box.h * 0.3);
      for (let i = 0; i < 5; i++) {
        await h.page.mouse.wheel(0, -500);
        await h.sleep(250);
      }
      await h.sleep(900);
      const after = await count();
      h.ok(after > before, `зум не раскрыл стопку: было ${before} меток, стало ${after}`);
    },
  },
  {
    name: 'шапка и панель закрывают пины, но не стирают их',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin, .lstack').length > 0, 45000, 'пины');
      const stat = () =>
        h.page.evaluate(() => {
          const head = document.querySelector('.mhead').getBoundingClientRect();
          const foot = document.querySelector('.mbottom').getBoundingClientRect();
          /* кнопки зума и меню тоже закрывают карту — это нормальный слой интерфейса */
          const controls = [...document.querySelectorAll('.maplibregl-ctrl')].map((c) => c.getBoundingClientRect());
          const out = { total: 0, zero: 0, coveredHeader: 0, coveredControls: 0, dead: 0, outside: 0 };
          /* маркер за пределами экрана: он не спрятан, он вне поля зрения */
          const vp = { top: 0, left: 0, right: innerWidth, bottom: innerHeight };
          for (const el of document.querySelectorAll('.lpin:not(.hide), .lstack:not(.hide)')) {
            const r = el.getBoundingClientRect();
            out.total++;
            if (!r.width || !r.height) {
              out.zero++;
              continue;
            }
            const hits = (b) => r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right;
            if (!hits(vp)) {
              out.outside++;
              continue;
            }
            if (hits(head) || hits(foot)) {
              out.coveredHeader++;
              continue;
            }
            if (controls.some(hits)) {
              out.coveredControls++;
              continue;
            }
            /* пин обязан ловить курсор хотя бы где-то: соседний пин может
               закрывать часть, но не весь */
            let hit = false;
            for (let gx = 0.15; gx <= 0.85 && !hit; gx += 0.35) {
              for (let gy = 0.15; gy <= 0.85 && !hit; gy += 0.35) {
                const top = document.elementFromPoint(r.x + r.width * gx, r.y + r.height * gy);
                if (top && el.contains(top)) hit = true;
              }
            }
            if (!hit) out.dead++;
          }
          return out;
        });
      let s = await stat();
      for (let i = 0; i < 3 && s.coveredHeader === 0; i++) {
        const spot = await freeSpot(h.page);
        h.ok(!!spot, 'на карте нет свободного места для драга');
        await pan(h.page, spot, 0, 260, 10);
        s = await stat();
      }
      h.ok(s.total > 0, 'на карте нет ни одного пина');
      h.eq(s.zero, 0, 'пинов нулевого размера (спрятаны стилями, а не закрыты панелью)');
      h.eq(s.dead, 0, 'видимых пинов, по которым не попасть курсором');
      h.ok(s.coveredHeader > 0, 'не удалось завести пин под шапку или панель — проверка ничего не проверила');
    },
  },
  {
    name: 'стопка: пять вечеров в одном адресе',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => !!document.querySelector('.lstack'), 45000, 'стопка пинов');
      await stable(h.page, '.lstack');
      const want = await h.page.$eval('.lstack b', (el) => Number(el.textContent));
      h.ok(want >= 5, `в стопке ${want} вечеров, ждали ≥5`);
      await h.click(h.page, '.lstack');
      await h.waitFor(() => !!document.querySelector('.sheet.clist'), 6000, 'лист стопки');
      const rows = await h.page.$$eval('.sheet.clist .srow', (els) => els.length);
      /* лист показывает первые 15, в заголовке — полное число */
      h.eq(rows, Math.min(want, 15), 'строк в листе стопки');
      const title = await h.page.$eval('.sheet.clist .srow b', (el) => el.textContent);
      await h.click(h.page, '.sheet.clist .srow');
      await h.sleep(900);
      const s = await state(h.page);
      h.eq(s.card, title, 'карточка вечера из стопки');
      h.ok(!(await h.page.$('.sheet.clist')), 'лист стопки не закрылся');
    },
  },
  {
    name: 'дальний зум: герой-пин',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin').length > 0, 45000, 'пины на карте');
      const box = await h.boxOf(h.page, '.lmap');
      await h.page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
      for (let i = 0; i < 6; i++) {
        await h.page.mouse.wheel(0, 400);
        await h.sleep(220);
      }
      await h.waitFor(() => !!document.querySelector('.lhero'), 6000, 'герой-пин на дальнем зуме');
      const shown = await h.page.$$eval('.lpin:not(.hide)', (els) => els.length);
      h.eq(shown, 0, 'обычные пины на дальнем зуме');
      await h.click(h.page, '.lhero');
      await h.waitFor(() => !document.querySelector('.lhero'), 8000, 'возврат к обычным пинам');
    },
  },
  {
    name: 'ссылка: ?pin= раскрывает пин',
    run: async (h) => {
      await h.go('/?pin=vinzavod');
      await h.waitFor(
        () => document.querySelector('.pincard .pt')?.textContent === 'Открытие «Винзавода»',
        45000,
        'карточка по ссылке',
      );
    },
  },
  {
    name: 'пин: клик открывает вечер',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin').length > 0, 45000, 'пины на карте');
      /* берём пин, по которому реально попадает курсор: шапка и панель его не закрывают */
      const pin = await h.page.evaluate(() => {
        const list = [...document.querySelectorAll('.lpin:not(.hide)')];
        for (const el of list) {
          const r = el.getBoundingClientRect();
          const x = r.x + r.width / 2;
          const y = r.y + r.height / 2;
          const top = document.elementFromPoint(x, y);
          if (!top || !el.contains(top)) continue;
          return { x, y, name: el.querySelector('.nm')?.textContent ?? '' };
        }
        return null;
      });
      h.ok(!!pin, 'ни по одному пину нельзя попасть: их закрывают шапка и панель');
      await h.page.mouse.click(pin.x, pin.y);
      await h.sleep(700);
      const s = await state(h.page);
      h.eq(s.card, pin.name, 'вечер, открытый кликом по пину');
    },
  },
];
