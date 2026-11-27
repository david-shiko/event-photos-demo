import { readFileSync } from 'node:fs';

/* Подмена тайл-сервера на время прогона, когда чужой сервер недоступен.
   QA_MAP=file QA_STYLE=/tmp/style.json — подложка из локального файла стиля.
   QA_MAP=stub  — плоский фон: нужен только загруженный стиль, чтобы работали пины и жесты.
   Без QA_MAP прогон ходит в настоящий openfreemap, как живой сайт. */
export const STYLE = {
  version: 8,
  name: 'qa-stub',
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#efece4' } }],
};

export const stubMap = (page) => {
  const mode = process.env.QA_MAP;
  if (mode === 'file' && process.env.QA_STYLE) {
    const body = readFileSync(process.env.QA_STYLE, 'utf8');
    return page.route('https://tiles.openfreemap.org/styles/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body,
      }),
    );
  }
  if (mode === 'stub') {
    return page.route('https://tiles.openfreemap.org/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STYLE) }),
    );
  }
  return Promise.resolve();
};
