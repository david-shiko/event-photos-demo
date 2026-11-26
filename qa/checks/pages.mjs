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
];
