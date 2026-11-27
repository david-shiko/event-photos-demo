// Проверки правок аудита 27 ноября: пустой вечер, 404, адрес созданного вечера,
// «найти себя», Esc, сходимость цифр, имена у плитки.
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
    name: 'кабинет: созданный вечер открывает себя',
    run: async (h) => {
      await h.go('/new');
      await h.waitFor(() => document.querySelectorAll('.cta').length > 0, 15000, 'шаг 1');
      await h.click(h.page, '.cta');
      await h.waitFor(() => /Оплатить/.test(document.body.innerText), 8000, 'шаг 2');
      await h.click(h.page, '.cta');
      await h.waitFor(() => !!document.querySelector('.okc'), 10000, 'экран «Готово»');
      const title = await h.page.evaluate(() => document.querySelector('.okc')?.innerText ?? '');
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
      return title;
    },
  },
  {
    name: 'найти себя: лист сужает ленту по времени',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.chip2').length > 0, 15000, 'чипсы');
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
    name: 'Esc закрывает лайтбокс и лист',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.feed .th').length > 0, 15000, 'лента');
      await h.click(h.page, '.feed .th', 0);
      await h.waitFor(() => !!document.querySelector('.lb'), 6000, 'лайтбокс');
      await h.page.keyboard.press('Escape');
      await h.sleep(400);
      h.ok(!(await h.page.$('.lb')), 'Esc не закрыл лайтбокс');
      await h.click(h.page, '.foot .ghost2', 0);
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
