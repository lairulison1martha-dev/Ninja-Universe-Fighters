// Static server that mimics a GitHub Pages PROJECT site: everything is served
// from /Ninja-Universe-Fighters/ so absolute-root paths would 404.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path, { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = '/Ninja-Universe-Fighters';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0]);
  if (!path.startsWith(BASE)) {
    res.writeHead(404); res.end('outside base'); return;
  }
  path = path.slice(BASE.length) || '/';
  if (path === '/' || path === '') path = '/index.html';
  const file = join(ROOT, path);
  try {
    const st = await stat(file);
    if (st.isDirectory()) throw new Error('dir');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Service-Worker-Allowed': '/',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 ' + path);
  }
});

server.listen(process.env.NUF_TEST_PORT || 8099, () => console.log('serving on http://127.0.0.1:8099' + BASE + '/'));
