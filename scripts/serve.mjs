// Tiny static server for previewing dist/ locally: npm run serve
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import config from '../site.config.mjs';

const root = join(import.meta.dirname, '..', 'dist');
const port = Number(process.env.PORT || 4321);
// Serve dist/ under the same sub-folder the site is built for (if any).
const base = new URL(config.url).pathname.replace(/\/$/, '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };

export function start(p = port) {
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (base && path.startsWith(base)) path = path.slice(base.length) || '/';
    let file = join(root, path);
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': types['.html'] });
      res.end(await readFile(join(root, '404.html')).catch(() => 'Not found'));
    }
  });
  return new Promise((resolve) => server.listen(p, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await start();
  console.log(`Preview at http://localhost:${port}`);
}
