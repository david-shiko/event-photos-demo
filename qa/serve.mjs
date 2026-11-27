import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Отдаёт собранную статику из out/. Без зависимостей: тест должен запускаться
// на чистом npm ci и в CI, где ничего не установлено кроме devDependencies.
export function serveSite(root = ROOT, prefix = '') {
  const server = http.createServer((req, res) => {
    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    if (prefix) {
      if (path === prefix) path = '/';
      else if (path.startsWith(prefix + '/')) path = path.slice(prefix.length);
      else {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
    }
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      /* как GitHub Pages: неизвестный адрес отдаёт 404.html сборки, а не голый текст */
      const fallback = join(root, '404.html');
      if (existsSync(fallback) && !path.startsWith('/_next/')) {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        createReadStream(fallback).pipe(res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });

  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      ok({ server, url: `http://127.0.0.1:${server.address().port}${prefix}`, root });
    });
  });
}
