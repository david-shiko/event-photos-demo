// Проверки карты: лента суток, дни, точки, пины. Всё — настоящими событиями ввода.
const PX_PER_MIN = 52 / 60;

export const state = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.railscroll');
    if (!el) return null;
    const raw = (el.scrollLeft + el.clientWidth / 2) / (52 / 60);
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
      await h.page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      await h.go('/');
      await h.waitFor(() => !!document.querySelector('.raildot'), 15000, 'лента суток');
      const a = await state(h.page);
      const box = await h.boxOf(h.page, '.railscroll');
      await h.touchSwipe(box, -220);
      const b = await state(h.page);
      await h.page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      h.ok(b.railMin - a.railMin >= 150, `палец сдвинул ленту на ${b.railMin - a.railMin} мин, ждали ≥150`);
      h.near(mins(b.clock), mins(b.railClock), 6, 'шапка и лента после свайпа');
    },
  },
  {
    name: 'стопка: пять вечеров в одном адресе',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => !!document.querySelector('.lstack'), 45000, 'стопка пинов');
      const want = await h.page.$eval('.lstack b', (el) => Number(el.textContent));
      h.ok(want >= 5, `в стопке ${want} вечеров, ждали ≥5`);
      await h.click(h.page, '.lstack');
      await h.waitFor(() => !!document.querySelector('.sheet.clist'), 6000, 'лист стопки');
      const rows = await h.page.$$eval('.sheet.clist .srow', (els) => els.length);
      h.eq(rows, want, 'строк в листе стопки');
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
        await h.page.mouse.wheel({ deltaY: 400 });
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
