// Build step (npm run build): render the page into dist/index.html so search
// engines and AI crawlers that do not run JavaScript read the full content.
// In the browser, main.jsx's createRoot replaces it with the live app, so
// nothing changes for visitors. With SITE_URL set (for static hosting), the
// absolute URLs plus robots.txt, sitemap.xml and llms.txt are written into
// dist/ too; otherwise the Node server (npm start) fills them per request.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'production';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.PRERENDER_DIST || join(root, 'dist'), page = join(dist, 'index.html');
const { createServer } = await import('vite');
const { default: react } = await import('@vitejs/plugin-react');
const vite = await createServer({ root, cacheDir: join(root, 'node_modules/.vite-prerender'), configFile: false, mode: 'production', logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom', plugins: [react()] });
try {
  const React = (await import('react')).default, ReactDOMServer = (await import('react-dom/server')).default;
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const markup = ReactDOMServer.renderToString(React.createElement(App));
  let html = await readFile(page, 'utf8');
  if (!html.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root');
  html = html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  const origin = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (origin) {
    const { seoFiles, withOrigin } = await import('../server/seo.mjs');
    html = withOrigin(html, origin);
    for (const [path, body] of Object.entries(seoFiles(origin))) await writeFile(join(dist, path), body);
  }
  await writeFile(page, html);
  console.log(`Prerendered ${Math.round(markup.length / 1024)} KB of page HTML${origin ? ` for ${origin}` : ''}.`);
} catch (error) {
  // The site still works without it: the browser renders the app as before.
  console.warn(`Prerender skipped: ${error.message}`);
} finally {
  await vite.close();
}
