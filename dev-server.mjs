// Servidor local opcional: `node dev-server.mjs` → http://localhost:3000 (na Vercel não é usado)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import search from './api/search.js';

const root = new URL('.', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/search') {
    res.status = c => { res.statusCode = c; return res; };
    res.json = d => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(d)); };
    req.query = Object.fromEntries(url.searchParams);
    return search(req, res);
  }
  const p = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const f = await readFile(join(root, p));
    res.setHeader('content-type', types[extname(p)] || 'application/octet-stream');
    res.end(f);
  } catch { res.statusCode = 404; res.end('404'); }
}).listen(process.env.PORT || 3000, () => console.log('Wave em http://localhost:' + (process.env.PORT || 3000)));
