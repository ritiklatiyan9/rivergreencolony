// Build step (npm run build): render the page into dist/index.html so search
// engines and AI crawlers that do not run JavaScript read the full content.
// In the browser, main.jsx hydrates it without replacing the first paint.
// Matching origin/year props keep the initial server and client HTML identical.
// The absolute URLs plus robots.txt, sitemap.xml
// and llms.txt are written into dist/ for SITE_URL, else the production
// address in src/data/seo.js, so static hosting (Vercel) gets them too.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'production';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.PRERENDER_DIST || join(root, 'dist'), page = join(dist, 'index.html');
const { createServer, loadEnv } = await import('vite');
const { managerHtml, seoFiles, siteOrigin, withOrigin } = await import('../server/seo.mjs');
const origin = siteOrigin(undefined, { ...loadEnv('production', root, ''), ...process.env });
const copyrightYear = new Date().getFullYear();
const escapeAttribute = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const { default: react } = await import('@vitejs/plugin-react');
const vite = await createServer({ root, cacheDir: join(root, 'node_modules/.vite-prerender'), configFile: false, mode: 'production', logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom', plugins: [react()] });
let html = await readFile(page, 'utf8');
const manager = managerHtml(html, origin);
try {
  const React = (await import('react')).default, ReactDOMServer = (await import('react-dom/server')).default;
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const markup = ReactDOMServer.renderToString(React.createElement(App, { seoOrigin: origin, copyrightYear }));
  if (!html.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root');
  html = html.replace('<div id="root"></div>', `<div id="root" data-prerendered="true" data-seo-origin="${escapeAttribute(origin)}" data-copyright-year="${copyrightYear}">${markup}</div>`);
  console.log(`Prerendered ${Math.round(markup.length / 1024)} KB of page HTML.`);
} finally {
  await vite.close();
}
await writeFile(page, withOrigin(html, origin));
await mkdir(join(dist, 'plot-manager'), { recursive: true });
await writeFile(join(dist, 'plot-manager/index.html'), manager);
for (const [path, body] of Object.entries(seoFiles(origin))) await writeFile(join(dist, path), body);
console.log(`Canonical URLs, manager noindex page, robots.txt, sitemap.xml, sitemap.html and llms.txt written for ${origin}.`);
