// Разбор жестов на карте: чужой палец, пин и кнопка под пальцем, приклеенная
// карточка, закрытие тапом и свайпом, размер стопки.
import { sleep } from '../browser.mjs';

/* Пустое место на карте с запасом в стороны: пинч ставит два пальца на ±95 px. */
const wideSpot = (page, half = 100) =>
  page.evaluate((h) => {
    const c = document.querySelector('.maplibregl-canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const free = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return !!el && el.classList.contains('maplibregl-canvas');
    };
    for (let fy = 0.2; fy <= 0.6; fy += 0.04) {
      for (let fx = 0.34; fx <= 0.78; fx += 0.04) {
        const x = Math.round(r.x + r.width * fx);
        const y = Math.round(r.y + r.height * fy);
        if (free(x - h, y) && free(x, y) && free(x + h, y)) return { x, y };
      }
    }
    return null;
  }, half);

/* Пин, по которому курсор реально попадает: шапка и панель его не закрывают. */
const hitPin = (page) =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('.lpin:not(.hide)')) {
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      const top = document.elementFromPoint(x, y);
      if (top && el.contains(top)) return { x, y, name: el.querySelector('.nm')?.textContent ?? '' };
    }
    return null;
  });

const card = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.pincard');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      text: c.querySelector('.pt')?.textContent ?? '',
      href: c.getAttribute('href'),
      marker: !!c.closest('.maplibregl-marker'),
      /* карточка сама — ссылка: второй тап по ней ведёт в вечер */
      tag: c.tagName,
      buttons: c.querySelectorAll('button').length,
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height),
    };
  });

export default [
  {
    name: 'карта: пинч двумя пальцами не создаёт вечер',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin, .lstack').length > 0, 45000, 'пины');
      await sleep(900);
      const spot = await wideSpot(h.page);
      h.ok(!!spot, 'на карте нет свободного места шириной под два пальца');
      await h.pinch(spot);
      /* второй палец шёл отдельным pointerdown: его таймер не должен дожить */
      await sleep(900);
      const s = await h.page.evaluate(() => ({
        sheet: !!document.querySelector('.sheet'),
        ring: !!document.querySelector('.lring'),
        url: location.pathname,
      }));
      h.ok(!s.sheet, 'пинч открыл лист «Новый вечер здесь»');
      h.ok(!s.ring, 'пинч оставил точку создания на карте');
      h.ok(!/\/new\//.test(s.url), `пинч ушёл в создание вечера: ${s.url}`);
    },
  },
  {
    name: 'карта: удержание на пине и на кнопке зума не создаёт вечер',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin:not(.lstack)').length > 0, 45000, 'пины');
      await sleep(900);
      const pin = await hitPin(h.page);
      h.ok(!!pin, 'ни по одному пину не попасть курсором');
      await h.hold(pin.x, pin.y, 800);
      const afterPin = await h.page.evaluate(() => ({
        sheet: !!document.querySelector('.sheet'),
        card: document.querySelector('.pincard .pt')?.textContent ?? '',
      }));
      h.ok(!afterPin.sheet, 'долгое нажатие на пин открыло лист нового вечера');
      h.eq(afterPin.card, pin.name, 'удержание на пине не открыло его карточку');

      const zoom = await h.boxOf(h.page, '.maplibregl-ctrl-zoom-in');
      h.ok(!!zoom, 'нет кнопки зума');
      await h.hold(zoom.x + zoom.w / 2, zoom.y + zoom.h / 2, 800);
      const afterZoom = await h.page.evaluate(() => !!document.querySelector('.sheet'));
      h.ok(!afterZoom, 'долгое нажатие на кнопку зума открыло лист нового вечера');
    },
  },
  {
    name: 'карточка пина: тап по пустой карте закрывает',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin:not(.lstack)').length > 0, 45000, 'пины');
      await sleep(900);
      const pin = await hitPin(h.page);
      h.ok(!!pin, 'ни по одному пину не попасть курсором');
      await h.page.mouse.click(pin.x, pin.y);
      await h.waitFor(() => !!document.querySelector('.pincard'), 6000, 'карточка вечера');
      const spot = await wideSpot(h.page, 40);
      h.ok(!!spot, 'не нашёл пустого места, чтобы закрыть карточку');
      await h.page.mouse.click(spot.x, spot.y);
      await sleep(500);
      h.ok(!(await h.page.$('.pincard')), 'тап по пустой карте не закрыл карточку');
    },
  },
  {
    name: 'карточка пина: вся карточка — ссылка, кнопок нет',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin:not(.lstack)').length > 0, 45000, 'пины');
      await sleep(900);
      const pin = await hitPin(h.page);
      h.ok(!!pin, 'ни по одному пину не попасть курсором');
      await h.page.mouse.click(pin.x, pin.y);
      await h.waitFor(() => !!document.querySelector('.pincard'), 6000, 'карточка вечера');
      const c = await card(h.page);
      h.ok(!!c, 'карточка не открылась');
      h.eq(c.buttons, 0, 'кнопок в карточке (нужен только тап по самой карточке)');
      h.eq(c.tag, 'A', 'сама карточка — не ссылка');
      h.ok(/\/e\//.test(c.href ?? ''), `карточка ведёт не в вечер: ${c.href}`);
      /* второй тап по самой карточке — переход, как по ссылке */
      await h.page.mouse.click(c.x, c.y - 20);
      await sleep(900);
      const s = await h.page.evaluate(() => ({ url: location.pathname, text: document.body.innerText.slice(0, 400) }));
      h.ok(/\/e\//.test(s.url), `тап по карточке не открыл вечер: ${s.url}`);
    },
  },
  {
    name: 'карточка пина: приклеена к пину и едет вместе с картой',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin:not(.lstack)').length > 0, 45000, 'пины');
      await sleep(900);
      const pin = await hitPin(h.page);
      h.ok(!!pin, 'ни по одному пину не попасть курсором');
      await h.page.mouse.click(pin.x, pin.y);
      await h.waitFor(() => !!document.querySelector('.pincard'), 6000, 'карточка вечера');
      const c = await card(h.page);
      /* карточка живёт в слое маркеров: её двигает та же трансформация, что пин */
      h.ok(c.marker, 'карточка не маркер карты — она неизбежно отстаёт от пина');

      const spot = await wideSpot(h.page, 40);
      h.ok(!!spot, 'негде взяться за карту');
      /* меряем хвостик карточки против пина: он обязан стоять на пине всю панораму */
      const geo = () =>
        h.page.evaluate(() => {
          const p = document.querySelector('.lpin.on')?.getBoundingClientRect();
          const t = document.querySelector('.pincard .tail')?.getBoundingClientRect();
          const c = document.querySelector('.pincard')?.getBoundingClientRect();
          if (!p || !t || !c) return null;
          return {
            pin: p.x + p.width / 2,
            tail: t.x + t.width / 2,
            left: Math.round(c.x),
            right: Math.round(c.right),
            w: innerWidth,
          };
        });
      const before = await geo();
      h.ok(!!before, 'не нашёл открытый пин или хвостик карточки');
      let drift = Math.abs(before.tail - before.pin);
      let edge = 0;
      await h.page.mouse.move(spot.x, spot.y);
      await h.page.mouse.down();
      try {
        for (let i = 1; i <= 8; i++) {
          await h.page.mouse.move(spot.x - (96 * i) / 8, spot.y);
          await sleep(70);
          const now = await geo();
          if (!now) {
            h.ok(false, `карточка исчезла на шаге ${i} панорамы`);
            return;
          }
          drift = Math.max(drift, Math.abs(now.tail - now.pin));
          edge = Math.max(edge, -now.left, now.right - now.w);
        }
      } finally {
        await h.page.mouse.up();
        await sleep(400);
      }
      h.ok(drift <= 2, `хвостик карточки ушёл от пина на ${drift.toFixed(1)} px во время панорамы`);
      h.ok(edge <= 1, `карточка вылезла за край экрана на ${edge} px`);
    },
  },
  {
    name: 'лист создания: без кнопки отмены, закрывается свайпом вниз',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin, .lstack').length > 0, 45000, 'пины');
      await sleep(900);
      const spot = await wideSpot(h.page, 40);
      h.ok(!!spot, 'на карте нет свободного места');
      await h.hold(spot.x, spot.y, 800);
      await h.waitFor(() => !!document.querySelector('.sheet'), 6000, 'лист создания');
      const s = await h.page.evaluate(() => ({
        text: document.querySelector('.sheet')?.innerText ?? '',
        ghost: document.querySelectorAll('.sheet .ghost2').length,
        buttons: document.querySelectorAll('.sheet button').length,
      }));
      h.ok(/Новый вечер здесь/.test(s.text), `лист создания не тот: ${s.text.slice(0, 80)}`);
      h.ok(!/Отмена/.test(s.text), 'в листе осталась кнопка «Отмена»');
      h.eq(s.ghost, 0, 'лишних кнопок в листе создания');
      h.eq(s.buttons, 1, 'кнопок в листе создания (нужна одна — создать)');

      /* закрытие — пальцем вниз по листу */
      const box = await h.boxOf(h.page, '.sheet');
      h.ok(!!box, 'лист не измеряется');
      const x = Math.round(box.x + box.w / 2);
      const y0 = Math.round(box.y + 20);
      await h.page.mouse.move(x, y0);
      await h.page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await h.page.mouse.move(x, y0 + (150 * i) / 10);
        await sleep(16);
      }
      await h.page.mouse.up();
      await sleep(700);
      h.ok(!(await h.page.$('.sheet')), 'свайп вниз не закрыл лист создания');
    },
  },
  {
    name: 'стопка: размер как у пина',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => !!document.querySelector('.lstack'), 45000, 'стопка пинов');
      await h.waitFor(() => !!document.querySelector('.lpin:not(.lstack):not(.hide)'), 45000, 'одиночный пин');
      await sleep(900);
      const s = await h.page.evaluate(() => {
        const box = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return 0;
          const r = el.getBoundingClientRect();
          return Math.round(r.width);
        };
        return { pin: box('.lpin:not(.lstack):not(.hide) .pc'), stack: box('.lstack') };
      });
      h.ok(s.pin > 0 && s.stack > 0, `не измерить: пин ${s.pin}, стопка ${s.stack}`);
      h.near(s.stack, s.pin, 1, 'стопка и пин разного размера');
    },
  },
  {
    name: 'карта: короткий тап не рисует кольцо удержания',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin, .lstack').length > 0, 45000, 'пины');
      await sleep(900);
      const spot = await wideSpot(h.page, 40);
      h.ok(!!spot, 'на карте нет свободного места');
      await h.page.mouse.move(spot.x, spot.y);
      await h.page.mouse.down();
      await sleep(120);
      const during = await h.page.evaluate(() => !!document.querySelector('.lpress'));
      await h.page.mouse.up();
      await sleep(800);
      const after = await h.page.evaluate(() => ({
        ring: !!document.querySelector('.lpress'),
        point: !!document.querySelector('.lring'),
        sheet: !!document.querySelector('.sheet'),
      }));
      h.ok(!during, 'кольцо вспыхнуло на коротком нажатии');
      h.ok(!after.ring && !after.point, 'после тапа осталось кольцо или точка');
      h.ok(!after.sheet, 'короткий тап открыл лист создания');
    },
  },
  {
    name: 'карта: выбор пина не меняет его размер',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin:not(.lstack)').length > 1, 45000, 'пины');
      await sleep(900);
      const pin = await hitPin(h.page);
      h.ok(!!pin, 'ни по одному пину не попасть курсором');
      const before = await h.page.$$eval('.lpin:not(.hide) .pc', (els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
      await h.page.mouse.click(pin.x, pin.y);
      await h.waitFor(() => !!document.querySelector('.pincard'), 6000, 'карточка');
      await sleep(500);
      const after = await h.page.$$eval('.lpin:not(.hide) .pc', (els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
      h.ok(after.length === before.length, 'при открытии карточки пины пересобрались');
      const grew = after.filter((w, i) => w !== before[i]);
      h.ok(grew.length === 0, `размер пина изменился при выборе: ${before.join(',')} → ${after.join(',')}`);
    },
  },
  {
    name: 'пины: целый размер без анимации размеров',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin, .lstack').length > 0, 45000, 'пины');
      await sleep(1200);
      const s = await h.page.evaluate(() => {
        const box = (el) => Math.round(el.getBoundingClientRect().width);
        const pins = [...document.querySelectorAll('.lpin:not(.hide), .lstack:not(.hide)')];
        const circles = [...document.querySelectorAll('.lpin:not(.hide) .pc')];
        const odd = [...pins, ...circles].filter((el) => box(el) % 2 !== 0).length;
        const tr = pins[0] ? getComputedStyle(pins[0]).transitionProperty : '';
        return { odd, tr, total: pins.length };
      });
      h.ok(s.total > 0, 'на карте нет пинов');
      h.eq(s.odd, 0, 'пинов с нечётной шириной (полпикселя сдвига при панораме)');
      h.ok(!/width|height/.test(s.tr), `пин анимирует размер: ${s.tr}`);
    },
  },
  {
    name: 'лист создания: адрес и координаты, под кнопкой пусто',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin, .lstack').length > 0, 45000, 'пины');
      await sleep(900);
      const spot = await wideSpot(h.page, 40);
      h.ok(!!spot, 'на карте нет свободного места');
      await h.hold(spot.x, spot.y, 800);
      await h.waitFor(() => !!document.querySelector('.sheet'), 6000, 'лист создания');
      const s = await h.page.evaluate(() => {
        const sh = document.querySelector('.sheet');
        return {
          addr: sh?.querySelector('.addr')?.textContent?.trim() ?? '',
          coord: sh?.querySelector('.coord')?.textContent?.trim() ?? '',
          hints: sh?.querySelectorAll('.hint3').length ?? 0,
          last: sh?.innerText.trim().split('\n').filter(Boolean).pop() ?? '',
        };
      });
      h.ok(s.addr.length > 2, 'в листе нет адреса точки');
      h.ok(/^\d{2}\.\d{4,6}, \d{2}\.\d{4,6}$/.test(s.coord), `координаты не в том виде: ${s.coord}`);
      h.eq(s.hints, 0, 'под кнопкой осталась подпись');
      h.ok(/Создать вечер здесь/.test(s.last), `под кнопкой есть текст: ${s.last}`);
    },
  },
  {
    name: 'форма вечера: назад ведёт на карту',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin, .lstack').length > 0, 45000, 'пины');
      await sleep(900);
      const spot = await wideSpot(h.page, 40);
      await h.hold(spot.x, spot.y, 800);
      await h.waitFor(() => !!document.querySelector('.sheet'), 6000, 'лист создания');
      await h.click(h.page, '.sheet .solo');
      await h.waitFor(() => /\/new\//.test(location.pathname), 8000, 'форма вечера');
      await h.click(h.page, '.top .rb');
      await sleep(900);
      const s = await h.page.evaluate(() => ({ path: location.pathname, pins: document.querySelectorAll('.lpin, .lstack').length }));
      h.ok(!/\/new\/|\/photographer\//.test(s.path), `назад увели не туда: ${s.path}`);
      h.ok(s.pins > 0, 'назад привёл не на карту: пинов нет');
    },
  },
  {
    name: 'форма вечера: настройки — радиокнопки и тумблеры',
    run: async (h) => {
      await h.go('/new/');
      await h.waitFor(() => !!document.querySelector('.segm'), 15000, 'настройки');
      const s = await h.page.evaluate(() => ({
        radios: document.querySelectorAll('.segm button[role="radio"]').length,
        switches: document.querySelectorAll('.sw[aria-pressed]').length,
        vis: document.querySelector('.segm button[aria-checked="true"]')?.textContent?.trim() ?? '',
        store: [...document.querySelectorAll('.segm')]
          .map((g) => g.querySelector('button[aria-checked="true"]')?.textContent?.trim() ?? '')[1] ?? '',
        pressed: [...document.querySelectorAll('.sw[aria-pressed="true"]')].map((b) => b.querySelector('b')?.textContent ?? ''),
      }));
      h.ok(s.radios >= 5, `радиокнопок ${s.radios}, ждали два выбора по два-три варианта`);
      h.ok(s.switches >= 4, `тумблеров ${s.switches}, ждали четыре`);
      h.eq(s.vis, 'Только по ссылке', 'видимость вечера по умолчанию');
      h.eq(s.store, '90 дней', 'хранение по умолчанию');
      h.ok(/Вход по коду/.test(s.pressed.join('|')) === false, 'вход по коду включён по умолчанию');

      /* выбор доезжает до оплаты: цифры на шаге 2 те же */
      await h.click(h.page, '.segm button', 1);
      await h.click(h.page, '.segm button', 3);
      await sleep(300);
      await h.click(h.page, '.cta');
      await h.waitFor(() => /Оплатить/.test(document.body.innerText), 8000, 'шаг 2');
      const pay = await h.page.evaluate(() => document.querySelector('.sheet, .nv')?.innerText ?? document.body.innerText);
      h.ok(/1 год/.test(pay), 'выбранное хранение не доехало до оплаты');
      h.ok(/на карте города/.test(pay), 'выбранная видимость не доехала до оплаты');
    },
  },
];
