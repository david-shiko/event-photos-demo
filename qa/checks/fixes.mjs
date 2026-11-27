// Проверки правок 27 ноября: пустой вечер, 404, шапка вечера, счётчики категорий,
// выбор длинным нажатием, «найти себя» только после загрузки, пины и точка создания.
export default [
  {
    name: '404: по-русски и с выходом',
    run: async (h) => {
      await h.go('/e/does-not-exist/');
      await h.sleep(600);
      /* страница законно отдаёт код 404 — запись об этом в консоли не дефект */
      h.errors.length = 0;
      const s = await h.page.evaluate(() => ({
        text: document.body.innerText,
        links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
      }));
      h.ok(/не найден/i.test(s.text), `нет русского «не найден»: ${s.text.slice(0, 80)}`);
      h.ok(!/\bnot found\b/i.test(s.text), 'осталось английское «not found»');
      h.ok(s.links.length >= 2, `выходов со страницы: ${s.links.length}`);
      h.ok(s.links.includes(`${h.prefix}/`), 'нет ссылки на карту');
    },
  },
  {
    name: 'черновик: пустой вечер не рисует сетку',
    run: async (h) => {
      await h.go('/e/ny-tochki/');
      await h.sleep(700);
      const s = await h.page.evaluate(() => ({
        tiles: document.querySelectorAll('.th').length,
        tabs: document.querySelectorAll('.tab').length,
        text: document.body.innerText.replace(/\s+/g, ' '),
      }));
      h.eq(s.tiles, 0, 'кадров в черновике');
      h.eq(s.tabs, 0, 'вкладок в черновике');
      h.ok(/не (залиты|отдал|опублик)/i.test(s.text), `нет объяснения, почему пусто: ${s.text.slice(0, 90)}`);
      h.ok(!/168|96/.test(s.text), 'в черновике остались числа из воздуха');
    },
  },
  {
    name: 'вечер: шапка держит загрузку, внизу ничего не висит',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.feed .th').length > 0, 15000, 'лента');
      const s = await h.page.evaluate(() => {
        const up = document.querySelector('.ehead .up');
        const box = up?.getBoundingClientRect();
        return {
          up: (up?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          href: up?.getAttribute('href') ?? '',
          top: box?.y ?? -1,
          tall: box?.height ?? 0,
          foot: !!document.querySelector('.foot'),
          select: [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Выбрать'),
        };
      });
      h.ok(/Загрузить/.test(s.up), `в шапке не «Загрузить»: «${s.up}»`);
      h.ok(/\/u\/?$/.test(s.href), `загрузка ведёт не туда: ${s.href}`);
      h.ok(s.top >= 0 && s.top < 70, `загрузка не вверху экрана: y=${s.top.toFixed(0)}`);
      h.ok(s.tall >= 44, `кнопка загрузки ${s.tall.toFixed(0)} px, ждали ≥44`);
      h.ok(!s.foot, 'внизу снова висит панель');
      h.ok(!s.select, 'кнопка «Выбрать» вернулась');
    },
  },
  {
    name: 'счётчики: чипсы считают выбранную категорию',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.chip2').length > 0, 15000, 'чипсы');
      const read = () =>
        h.page.evaluate(() => {
          const tabs = [...document.querySelectorAll('.tab')].map((t) => t.textContent?.replace(/\D+/g, ''));
          const chips = [...document.querySelectorAll('.chip2')].map((c) => Number(c.querySelector('b')?.textContent ?? -1));
          return { tabs: tabs.map(Number), chips, sum: chips.reduce((a, b) => a + b, 0) };
        });
      const all = await read();
      h.eq(all.sum, all.tabs[0], 'сумма чипсов против «всё»');

      await h.click(h.page, '.tab', 1);
      await h.sleep(300);
      const photo = await read();
      h.eq(photo.sum, photo.tabs[1], `под «фотограф» чипсы дают ${photo.sum}, а вкладка ${photo.tabs[1]}`);
      h.ok(photo.sum < all.sum, 'чипсы не изменились после выбора категории');

      await h.click(h.page, '.tab', 2);
      await h.sleep(300);
      const guest = await read();
      h.eq(guest.sum, guest.tabs[2], `под «гости» чипсы дают ${guest.sum}, а вкладка ${guest.tabs[2]}`);
      h.eq(photo.sum + guest.sum, all.sum, 'фотограф + гости не дают «всё»');
    },
  },
  {
    name: 'выбор кадров: длинное нажатие вместо кнопки',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.feed .th').length > 3, 15000, 'лента');
      const at = async (i) => {
        const b = await h.boxOf(h.page, '.feed .th', i);
        return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      };
      const first = await at(0);
      await h.page.mouse.move(first.x, first.y);
      await h.page.mouse.down();
      await h.sleep(700);
      await h.page.mouse.up();
      await h.sleep(350);
      const s = await h.page.evaluate(() => ({
        selbar: !!document.querySelector('.selbar'),
        lb: !!document.querySelector('.lb'),
        picked: document.querySelectorAll('.th.picked').length,
        text: document.querySelector('.selbar')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      }));
      h.ok(!s.lb, 'длинное нажатие открыло лайтбокс вместо выбора');
      h.ok(s.selbar, 'панель выбора не появилась');
      h.eq(s.picked, 1, 'выбранных кадров после удержания');
      h.ok(/1 выбрано/.test(s.text), `в панели нет счёта: «${s.text}»`);

      const second = await at(1);
      await h.page.mouse.click(second.x, second.y);
      await h.sleep(250);
      h.eq(await h.page.$$eval('.th.picked', (els) => els.length), 2, 'кадров после обычного тапа');
      h.ok(!(await h.page.$('.lb')), 'обычный тап в режиме выбора открыл лайтбокс');

      await h.click(h.page, '.selbar .ghost2');
      await h.sleep(300);
      h.ok(!(await h.page.$('.selbar')), '«Готово» не закрыло выбор');
      h.eq(await h.page.$$eval('.th.picked', (els) => els.length), 0, 'выбор не сбросился');
    },
  },
  {
    name: 'найти себя: только после своей загрузки',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.page.evaluate(() => window.localStorage.clear());
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.tab').length > 0, 15000, 'вкладки');
      h.ok(!(await h.page.$('.hint2 .find')), '«найти себя» висит у гостя, который ничего не заливал');

      await h.go('/u/');
      await h.waitFor(() => !!document.querySelector('.drop .pick'), 15000, 'экран загрузки');
      await h.click(h.page, '.drop .pick');
      await h.click(h.page, '.pickline .go');
      await h.waitFor(() => /Спасибо/.test(document.body.innerText), 30000, 'загрузка гостя');

      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => !!document.querySelector('.hint2 .find'), 15000, 'кнопка «найти себя»');
      const all = await h.page.$$eval('.feed .th', (els) => els.length);
      await h.click(h.page, '.hint2 .find');
      await h.waitFor(() => /Найти себя/.test(document.body.innerText), 4000, 'лист «Найти себя»');
      await h.click(h.page, '.sheet .row2 .primary');
      await h.sleep(700);
      const s = await h.page.evaluate(() => ({
        sheet: !!document.querySelector('.sheet'),
        on: document.querySelector('.chip2.on')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        tiles: document.querySelectorAll('.feed .th').length,
        scrolled: document.querySelector('.feed')?.scrollTop ?? 0,
      }));
      h.ok(!s.sheet, 'лист «Найти себя» не закрылся после выбора');
      h.ok(/21:00–23:00/.test(s.on), `период вокруг 21:40 не выбран: ${s.on}`);
      h.ok(s.tiles > 0 && s.tiles < all, `лента не сузилась: было ${all}, стало ${s.tiles}`);
      h.ok(s.scrolled > 0, 'лента не прокрутилась к своим часам');
    },
  },
  {
    name: 'пины: размер под палец',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin:not(.lstack)').length > 0, 45000, 'пины');
      /* пин въезжает с анимацией scale(0.4 -> 1): мерить надо после неё */
      await h.sleep(900);
      const s = await h.page.evaluate(() => {
        const pin = document.querySelector('.lpin:not(.lstack):not(.hide)');
        const circle = pin?.querySelector('.pc');
        const stack = document.querySelector('.lstack');
        const box = (el) => (el ? el.getBoundingClientRect() : null);
        return {
          pin: box(pin)?.width ?? 0,
          circle: box(circle)?.width ?? 0,
          stack: stack ? box(stack)?.width ?? 0 : -1,
        };
      });
      /* было 38 внутри и 42 под палец; на общем плане города 48, на близком 78 */
      h.ok(s.pin >= 56, `зона пина ${s.pin} px, ждали ≥56`);
      h.ok(s.circle >= 48, `круг пина ${s.circle} px, ждали ≥48`);
      /* стопка теперь того же размера, что круг пина: разный размер читался как разный предмет */
      h.ok(s.stack === -1 || s.stack >= 48, `стопка ${s.stack} px, ждали ≥48`);

      /* на близком плане пин ещё крупнее: жмём «плюс», колесо в headless даёт ползума */
      for (let i = 0; i < 5; i++) {
        await h.click(h.page, '.maplibregl-ctrl-zoom-in');
        await h.sleep(420);
      }
      await h.sleep(900);
      const near = await h.page.evaluate(() => {
        const zoom = Number(document.querySelector('.lmap')?.dataset.zoom ?? 0);
        const el = document.querySelector('.lpin, .lstack');
        return { zoom, w: el ? el.getBoundingClientRect().width : 0 };
      });
      h.ok(near.zoom >= 14.2, `зум не доехал: ${near.zoom}`);
      h.ok(near.w >= 74, `на близком плане пин ${near.w} px, ждали ≥74`);
    },
  },
  {
    name: 'карта: удержание создаёт вечер ровно в этой точке',
    run: async (h) => {
      await h.go('/');
      await h.waitFor(() => document.querySelectorAll('.lpin, .lstack').length > 0, 45000, 'пины');
      /* держим пустое место карты: не пин, не шапка, не панель */
      const spot = await h.page.evaluate(() => {
        const c = document.querySelector('.maplibregl-canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        for (let fy = 0.2; fy <= 0.55; fy += 0.05) {
          for (let fx = 0.2; fx <= 0.85; fx += 0.06) {
            const x = Math.round(r.x + r.width * fx);
            const y = Math.round(r.y + r.height * fy);
            const el = document.elementFromPoint(x, y);
            if (el && el.classList.contains('maplibregl-canvas')) return { x, y };
          }
        }
        return null;
      });
      h.ok(!!spot, 'не нашёл пустого места на карте');
      await h.page.mouse.move(spot.x, spot.y);
      await h.page.mouse.down();
      /* кольцо появляется через 160 мс после нажатия: на медленном раннере ждём с запасом */
      await h.sleep(450);
      const hold = await h.page.evaluate(() => !!document.querySelector('.lpress'));
      await h.sleep(400);
      await h.page.mouse.up();
      await h.sleep(500);
      h.ok(hold, 'кольцо удержания не появилось — жест не видно');
      const text = await h.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      h.ok(/Новый вечер здесь/.test(text), `лист точки не открылся: ${text.slice(0, 120)}`);
      h.ok(!(await h.page.$('.pincard')), 'удержание открыло чужой вечер');

      await h.click(h.page, '.sheet .solo');
      await h.sleep(900);
      const s = await h.page.evaluate(() => ({ url: location.pathname + location.search, text: document.body.innerText }));
      h.ok(/\/new\//.test(s.url), `создание не открылось: ${s.url}`);
      h.ok(/at=/.test(s.url), `точка не передалась в создание: ${s.url}`);
      h.ok(/точка с карты/.test(s.text), 'в форме нет отметки, откуда точка');

      /* по умолчанию вечер живёт по ссылке: чтобы он встал на карту, выбираем это руками */
      await h.click(h.page, '.segm button', 1);
      await h.sleep(300);
      await h.click(h.page, '.cta');
      await h.waitFor(() => /Оплатить/.test(document.body.innerText), 8000, 'шаг 2');
      await h.click(h.page, '.cta');
      await h.waitFor(() => !!document.querySelector('.okc'), 12000, 'экран «Готово»');
      await h.click(h.page, '.ufoot a.ghost2', 0);
      await h.waitFor(() => !!document.querySelector('.pincard'), 45000, 'пин созданного вечера');
      const card = await h.page.$eval('.pincard .pt', (el) => el.textContent ?? '');
      h.ok(/Свадьба Маши и Кости/.test(card), `на карте не тот вечер: ${card}`);
    },
  },
  {
    name: 'кабинет: созданный вечер открывает себя',
    run: async (h) => {
      await h.go('/photographer/');
      await h.waitFor(() => document.querySelectorAll('.cab .ev').length > 0, 15000, 'карточки');
      const href = await h.page.$eval('.cab .ev', (el) => el.getAttribute('href'));
      h.ok(href.includes('/e/demo/?id='), `карточка созданного вечера ведёт не туда: ${href}`);
      await h.click(h.page, '.cab .ev');
      await h.sleep(900);
      const s = await h.page.evaluate(() => ({
        url: location.pathname + location.search,
        text: document.body.innerText.replace(/\s+/g, ' '),
        tiles: document.querySelectorAll('.th').length,
      }));
      h.ok(s.url.includes('/e/demo/'), `адрес созданного вечера: ${s.url}`);
      h.eq(s.tiles, 0, 'в новом вечере сразу 168 кадров');
      h.ok(/Свадьба Маши и Кости/.test(s.text), 'созданный вечер открылся без своего названия');
      h.ok(!/Свадьба Ани/.test(s.text), 'созданный вечер открылся как чужой');
      h.ok(/как только|кадров пока нет|кадры ещё не залиты/i.test(s.text), 'нет честного «кадров ещё нет»');
    },
  },
  {
    name: 'Esc закрывает лайтбокс и лист',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.feed .th').length > 0, 15000, 'лента');
      await h.click(h.page, '.feed .th', 0);
      await h.waitFor(() => !!document.querySelector('.lb'), 6000, 'лайтбокс');
      await h.page.keyboard.press('Escape');
      await h.sleep(400);
      h.ok(!(await h.page.$('.lb')), 'Esc не закрыл лайтбокс');
      await h.click(h.page, '.ehead .qr');
      await h.waitFor(() => !!document.querySelector('.sheet'), 5000, 'лист «Ссылка и QR»');
      await h.page.keyboard.press('Escape');
      await h.sleep(400);
      h.ok(!(await h.page.$('.sheet')), 'Esc не закрыл лист «Ссылка и QR»');
    },
  },
  {
    name: 'цифры: гостевые кадры кабинета и вечера согласны',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.tab').length > 0, 15000, 'вкладки');
      const eventGuests = await h.page.evaluate(() => {
        const tab = [...document.querySelectorAll('.tab')].find((t) => t.textContent.includes('гости'));
        return Number(tab?.textContent?.replace(/\D+/g, '') ?? -1);
      });
      await h.go('/photographer/');
      await h.waitFor(() => document.querySelectorAll('.cab .ev').length > 0, 15000, 'карточки');
      const cards = await h.page.$$eval('.cab .ev', (els) =>
        els.map((el) => el.innerText.replace(/\s+/g, ' ')).filter((t) => /кадр/.test(t)),
      );
      const sum = cards.reduce((acc, t) => {
        const n = Number((t.match(/(\d+) кадр/) ?? [])[1] ?? 0);
        return acc + n - Math.round((n * 4) / 7);
      }, 0);
      await h.click(h.page, '.cab .pay .s');
      await h.waitFor(() => !!document.querySelector('.sheet .rep'), 5000, 'отчёт');
      const report = await h.page.evaluate(() => {
        const rows = [...document.querySelectorAll('.sheet .rep div')];
        const row = rows.find((r) => /принесли гости/.test(r.textContent));
        return Number(row?.querySelector('b')?.textContent ?? -1);
      });
      h.ok(eventGuests > 0, `не прочитал гостевые кадры вечера: ${eventGuests}`);
      h.eq(report, sum, 'гостевые кадры в отчёте против суммы по карточкам кабинета');
      h.ok(report >= eventGuests, `в отчёте ${report} гостевых кадров, а в одном вечере ${eventGuests}`);
    },
  },
  {
    name: 'плитка кадров: у каждого есть имя',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.feed .th').length > 0, 15000, 'лента');
      const s = await h.page.evaluate(() => {
        const all = [...document.querySelectorAll('.th')];
        const named = all.filter((t) => (t.getAttribute('aria-label') || '').trim().length > 4);
        return { all: all.length, named: named.length, sample: named[0]?.getAttribute('aria-label') ?? '' };
      });
      h.ok(s.all > 0, 'плитки не нарисовались');
      h.eq(s.named, s.all, 'плиток с доступным именем');
      h.ok(/\d{2}:\d{2}/.test(s.sample), `имя плитки без времени: ${s.sample}`);
    },
  },
  {
    name: 'кириллица: подписи без «заглушек» и падежей-ошибок',
    run: async (h) => {
      await h.go('/');
      await h.sleep(900);
      const text = await h.page.evaluate(() =>
        [document.body.innerText, document.querySelector('.menu')?.innerText ?? ''].join(' ').replace(/\s+/g, ' '),
      );
      h.ok(!/заглушк/i.test(text), 'в сборке осталось «фото — заглушки»');
      h.ok(!/31 вечеров|1 вечеров|2 вечеров|5 вечеров/i.test(text), 'падеж у числа вечеров сломан');
    },
  },
];
