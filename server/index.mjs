import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, readFile, realpath, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { createPlotApi, PROJECT_ROOT } from './plot-api.mjs';
import { createBookingProxy } from './booking-proxy.mjs';
import { SEO_TYPES, seoFiles, siteOrigin, withOrigin } from './seo.mjs';

try { process.loadEnvFile?.(join(PROJECT_ROOT, '.env.local')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const api = await createPlotApi();
const bookingProxy = createBookingProxy();
const dist = resolve(PROJECT_ROOT, 'dist');
await access(join(dist, 'index.html')).catch(() => { throw new Error('Build the website with npm run build before npm start.'); });
const realDist = await realpath(dist);
const mime = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

async function staticFile(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (pathname.split('/').some((part) => part.startsWith('.'))) { res.writeHead(403); res.end(); return; }
  // robots.txt, sitemap.xml and llms.txt are generated for this site's origin.
  if (SEO_TYPES[pathname]) {
    const body = seoFiles(siteOrigin(req), (await stat(join(dist, 'index.html'))).mtime)[pathname];
    res.writeHead(200, { 'Content-Type': SEO_TYPES[pathname], 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body); return;
  }
  let path = resolve(dist, `.${pathname}`);
  if (path !== dist && !path.startsWith(`${dist}${sep}`)) { res.writeHead(403); res.end(); return; }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    await access(path);
  } catch {
    if (extname(pathname)) { res.writeHead(404); res.end(); return; }
    path = join(dist, 'index.html');
  }
  const resolved = await realpath(path);
  if (!resolved.startsWith(`${realDist}${sep}`)) { res.writeHead(403); res.end(); return; }
  // HTML carries __SITE_URL__ where absolute URLs are needed (canonical, Open Graph, JSON-LD).
  const html = extname(path) === '.html' ? withOrigin(await readFile(resolved, 'utf8'), siteOrigin(req)) : null;
  const file = await stat(resolved);
  res.writeHead(200, {
    'Content-Type': mime[extname(path)] || 'application/octet-stream',
    'Content-Length': html === null ? file.size : Buffer.byteLength(html),
    'Cache-Control': extname(path) === '.html' ? 'no-cache' : pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    ...(pathname.replace(/\/+$/, '') === '/plot-manager' ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
  });
  if (req.method === 'HEAD') res.end();
  else if (html !== null) res.end(html);
  else createReadStream(resolved).on('error', () => res.destroy()).pipe(res);
}

const server = createServer((req, res) => {
  void bookingProxy(req, res, () => api.handle(req, res, () => staticFile(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end('Unable to load this page.');
  })));
});
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`River Green website and plot API: http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => { void api.close().then(() => process.exit(0)); });
});
