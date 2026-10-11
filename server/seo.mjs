// Search-engine files and the site origin, shared by the production server
// (server/index.mjs), the Vite dev/preview plugin and the build prerender.
// index.html carries the token __SITE_URL__ wherever an absolute URL is needed
// (canonical, Open Graph, JSON-LD); it is replaced with the site's origin.
import gallery from '../src/data/gallery.js';
import { llmsText } from '../src/data/seo.js';

export const SITE_TOKEN = '__SITE_URL__';
const clean = (value) => String(value || '').trim().replace(/\/+$/, '');

// SITE_URL (or PLOT_APP_ORIGIN) wins; otherwise the request's own host.
export function siteOrigin(req) {
  const configured = clean(process.env.SITE_URL || process.env.PLOT_APP_ORIGIN);
  if (/^https?:\/\/[^/\s]+$/i.test(configured)) return configured;
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return '';
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (/^(localhost|127\.|\[::1\])/.test(host) ? 'http' : 'https');
  return `${proto === 'http' ? 'http' : 'https'}://${host}`;
}

export const withOrigin = (html, origin) => html.replaceAll(SITE_TOKEN, origin);

const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function seoFiles(origin, lastModified = new Date()) {
  const day = new Date(lastModified).toISOString().slice(0, 10);
  const images = [{ src: '/og-image.jpg', title: 'River Green Colony, Shamli' }, ...gallery.map(({ src, title, alt }) => ({ src, title: `${title} — River Green Colony, Shamli`, caption: alt }))];
  return {
    '/robots.txt': ['User-agent: *', 'Allow: /', 'Disallow: /plot-manager', 'Disallow: /api/', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n'),
    '/sitemap.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      `  <url><loc>${xml(origin)}/</loc><lastmod>${day}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority>`,
      ...images.map(({ src, title, caption }) => `    <image:image><image:loc>${xml(origin + src)}</image:loc><image:title>${xml(title)}</image:title>${caption ? `<image:caption>${xml(caption)}</image:caption>` : ''}</image:image>`),
      '  </url>',
      '</urlset>', '',
    ].join('\n'),
    '/llms.txt': llmsText(origin),
  };
}

export const SEO_TYPES = { '/robots.txt': 'text/plain; charset=utf-8', '/sitemap.xml': 'application/xml; charset=utf-8', '/llms.txt': 'text/markdown; charset=utf-8' };
