// Проверки страниц: вечер, создание с оплатой, загрузка кадров.
export default [
  {
    name: 'вечер: чипсы периодов и лента кадров',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.chip2').length > 0, 15000, 'чипсы периодов');
      const n = await h.page.evaluate(() => document.querySelectorAll('.chip2').length);
      h.eq(n, 4, 'количество чипсов периода');
      const tl = await h.page.evaluate(() => !!document.querySelector('.tl'));
      h.ok(!tl, 'на странице вечера снова появился таймлайн, его быть не должно');
      await h.click(h.page, '.chip2', 1);
      await h.sleep(500);
      const s = await h.page.evaluate(() => ({
        on: [...document.querySelectorAll('.chip2')].findIndex((x) => x.classList.contains('on')),
        feed: document.querySelectorAll('.glab').length,
      }));
      h.eq(s.on, 1, 'выбранный чипс после клика');
      h.ok(s.feed > 0, 'в ленте вечера нет кадров');
    },
  },
  {
    name: 'оплата: демо-вечер создаётся',
    run: async (h) => {
      await h.go('/new');
      await h.waitFor(() => document.querySelectorAll('.cta').length > 0, 15000, 'шаг 1');
      await h.click(h.page, '.cta');
      await h.waitFor(() => /Оплатить/.test(document.body.innerText), 8000, 'шаг 2 «Оплата»');
      await h.click(h.page, '.cta');
      await h.waitFor(() => !!document.querySelector('.okc'), 10000, 'экран «Готово»');
      const created = await h.page.evaluate(() => localStorage.getItem('ep.created'));
      h.ok(!!created, 'в localStorage нет созданного вечера');
    },
  },
  {
    name: 'загрузка: прогресс доходит до «готово»',
    run: async (h) => {
      await h.go('/u');
      await h.waitFor(() => !!document.querySelector('.pick'), 15000, 'кнопка выбора файлов');
      await h.click(h.page, '.pick');
      await h.waitFor(() => !!document.querySelector('.pickline .go'), 8000, 'кнопка «Загрузить»');
      await h.click(h.page, '.pickline .go');
      await h.waitFor(
        () => /готово/.test(document.querySelector('.pickline')?.innerText ?? ''),
        30000,
        'загрузка завершилась',
      );
    },
  },
  {
    name: 'вечер: чипс периода совпадает с лентой',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.chip2').length > 0, 15000, 'чипсы');
      const all = await h.page.$$eval('.feed .th', (els) => els.length);
      const want = await h.page.$eval('.chip2 b', (el) => Number(el.textContent));
      await h.click(h.page, '.chip2', 0);
      await h.sleep(500);
      const got = await h.page.$$eval('.feed .th', (els) => els.length);
      h.eq(got, want, 'кадров в ленте против числа на чипсе');
      h.ok(want < all, `чипс не сузил ленту: было ${all}, стало ${got}`);
      await h.click(h.page, '.hint2 .fake');
      await h.sleep(500);
      const back = await h.page.$$eval('.feed .th', (els) => els.length);
      h.eq(back, all, 'лента после «сбросить фильтр»');
    },
  },
  {
    name: 'вечер: назад на карту',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => !!document.querySelector('.ehead .rb'), 15000, 'стрелка назад');
      await h.click(h.page, '.ehead .rb');
      await h.sleep(900);
      const href = await h.page.evaluate(() => location.pathname);
      h.eq(href, `${h.prefix}/`, 'адрес после «назад»');
    },
  },
  {
    name: 'лайтбокс: скачивание и лайк',
    run: async (h) => {
      await h.go('/e/7kd2qf9xm/');
      await h.waitFor(() => document.querySelectorAll('.feed .th').length > 0, 15000, 'лента кадров');
      await h.click(h.page, '.feed .th', 0);
      await h.waitFor(() => !!document.querySelector('.lb'), 6000, 'лайтбокс');
      const save = await h.page.$eval('.lb .acts .save', (el) => ({
        tag: el.tagName,
        href: el.getAttribute('href'),
        download: el.getAttribute('download'),
      }));
      h.eq(save.tag, 'A', 'кнопка скачивания — ссылка на файл');
      h.ok(!!save.href && /\.(png|jpe?g)$/i.test(save.href), `href у скачивания: ${save.href}`);
      h.ok(!!save.download, 'у ссылки нет атрибута download');
      await h.click(h.page, '.lb .acts button', 0);
      await h.sleep(300);
      const meta = await h.page.$eval('.lb .meta .s', (el) => el.textContent);
      h.ok(/1 ♥/.test(meta), `в строке кадра не обновился лайк: ${meta}`);
    },
  },
  {
    name: 'кабинет: карточка вечера открывается',
    run: async (h) => {
      await h.go('/photographer/');
      await h.waitFor(() => document.querySelectorAll('.cab .ev').length > 0, 15000, 'карточки вечеров');
      const id = await h.page.$eval('.cab .ev', (el) => el.getAttribute('href'));
      h.ok(!!id && id.startsWith(`${h.prefix}/e/`), `карточка вечера не ссылка: ${id}`);
      await h.click(h.page, '.cab .ev');
      await h.sleep(900);
      /* у демо-вечера адрес с параметром ?id=, поэтому сверяем путь вместе с запросом */
      const path = await h.page.evaluate(() => location.pathname + location.search);
      h.eq(path, id, 'адрес после клика по карточке вечера');
    },
  },
  {
    name: 'загрузка: способ переключается',
    run: async (h) => {
      await h.go('/u/');
      await h.waitFor(() => document.querySelectorAll('.upl .who button').length > 0, 15000, 'переключатель способа');
      await h.click(h.page, '.upl .who button', 1);
      await h.sleep(300);
      const on = await h.page.$$eval('.upl .who button', (els) => els.findIndex((e) => e.classList.contains('on')));
      h.eq(on, 1, 'активный способ загрузки');
    },
  },
];
