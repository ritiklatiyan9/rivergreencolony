// Build step (npm run build): render the page into dist/index.html so search
// engines and AI crawlers that do not run JavaScript read the full content.
// In the browser, main.jsx's createRoot replaces it with the live app, so
// nothing changes for visitors. The absolute URLs plus robots.txt, sitemap.xml
// and llms.txt are written into dist/ for SITE_URL, else the production
// address in src/data/seo.js, so static hosting (Vercel) gets them too.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'production';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.PRERENDER_DIST || join(root, 'dist'), page = join(dist, 'index.html');
const { createServer } = await import('vite');
const { default: react } = await import('@vitejs/plugin-react');
const vite = await createServer({ root, cacheDir: join(root, 'node_modules/.vite-prerender'), configFile: false, mode: 'production', logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom', plugins: [react()] });
let html = await readFile(page, 'utf8');
try {
  const React = (await import('react')).default, ReactDOMServer = (await import('react-dom/server')).default;
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const markup = ReactDOMServer.renderToString(React.createElement(App));
  if (!html.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root');
  html = html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  console.log(`Prerendered ${Math.round(markup.length / 1024)} KB of page HTML.`);
} catch (error) {
  // The site still works without it: the browser renders the app as before.
  console.warn(`Prerender skipped: ${error.message}`);
} finally {
  await vite.close();
}
// Always, even when rendering failed: a page left with __SITE_URL__ has a broken canonical link.
const { SITE } = await import('../src/data/seo.js');
const { seoFiles, withOrigin } = await import('../server/seo.mjs');
const origin = String(process.env.SITE_URL || SITE.url).trim().replace(/\/+$/, '');
await writeFile(page, withOrigin(html, origin));
for (const [path, body] of Object.entries(seoFiles(origin))) await writeFile(join(dist, path), body);
console.log(`Absolute URLs, robots.txt, sitemap.xml and llms.txt written for ${origin}.`);
