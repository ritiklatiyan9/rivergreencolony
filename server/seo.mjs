// Search-engine files and the site origin, shared by the production server
// (server/index.mjs), the Vite dev/preview plugin and the build prerender.
// index.html carries the token __SITE_URL__ wherever an absolute URL is needed
// (canonical, Open Graph, JSON-LD); it is replaced with the site's origin.
import gallery from '../src/data/gallery.js';
import { SITE, llmsText } from '../src/data/seo.js';

export const SITE_TOKEN = '__SITE_URL__';
const clean = (value) => String(value || '').trim().replace(/\/+$/, '');

// The public canonical address is independent of preview/request hostnames.
// Build and runtime must use the same SITE_URL when overriding SITE.url.
export function siteOrigin(_req, env = process.env) {
  const configured = clean(env.SITE_URL || env.PLOT_APP_ORIGIN || SITE.url);
  let url;
  try { url = new URL(configured); } catch { throw new Error('SITE_URL must be an absolute http(s) origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be an http(s) origin without credentials, a path, query or fragment.');
  }
  return url.origin;
}

export const withOrigin = (html, origin) => html.replaceAll(SITE_TOKEN, origin);

const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const SITE_SECTIONS = [
  ['River Green Colony home', '/', 'Residential plots on Shamli Road, Mundet, Shamli.'],
  ['The community', '/#overview', 'The planned colony and its landscaped avenues.'],
  ['Colony layout and plot availability', '/#experience', 'Explore the colony plan and current plot availability.'],
  ['Project gallery', '/#gallery', 'Entrance, streets and green-space visualisations.'],
  ['Location and directions', '/#location', 'Find River Green on Shamli Road and arrange a visit.'],
  ['Plot sizes and project details', '/#at-a-glance', 'The original layout, roads, green spaces and contact details.'],
  ['Questions about plots and visits', '/#faq', 'Answers about the project, plot sizes and meeting the team.'],
];

function htmlSitemap(origin) {
  return `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>River Green Colony | Website Sitemap</title>
<meta name="description" content="Explore River Green Colony: plots, community, gallery, location, project details and questions about visiting.">
<meta name="robots" content="noindex, follow"><meta name="theme-color" content="#102d20">
<link rel="canonical" href="${xml(origin)}/sitemap.html"><link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="stylesheet" href="/fonts/fonts.css">
<style>body{margin:0;background:#f6f4ed;color:#162b20;font:16px/1.7 'Golos Text',sans-serif}main{max-width:800px;margin:auto;padding:48px 24px}a{color:inherit;text-underline-offset:4px}a:focus-visible{outline:3px solid #162b20;outline-offset:5px}.brand{display:inline-block}.brand img{width:230px;max-width:100%;height:auto}h1{font:600 clamp(40px,8vw,64px)/1.1 'Cormorant Garamond',serif;margin:40px 0 16px}h2{font-size:22px;margin-top:36px}ul{padding:0;list-style:none}li{padding:18px 0;border-bottom:1px solid #162b2033}li a{font-weight:600}li p{margin:4px 0 0}footer{margin-top:40px;font-size:14px}</style>
</head><body><main><a class="brand" href="/"><img src="${SITE.logo}" alt="River Green Colony home" width="2172" height="724"></a>
<h1>Explore River Green.</h1><p>Find your way around the colony website, explore the layout and contact the Defence Garden team.</p>
<nav aria-label="Website sitemap"><ul>${SITE_SECTIONS.map(([label, path, description]) => `<li><a href="${path}">${xml(label)}</a><p>${xml(description)}</p></li>`).join('')}</ul></nav>
<h2>Contact and project links</h2><ul>
<li><a href="tel:${SITE.salesPhone.replace(/[^+\d]/g, '')}">Call the sales team: ${xml(SITE.salesPhone)}</a></li>
<li><a href="mailto:${xml(SITE.email)}">Email the sales team</a></li>
<li><a href="${xml(SITE.mapUrl)}">Directions on Google Maps</a></li>
<li><a href="${xml(SITE.projectUrl)}">Defence Garden project page</a></li></ul>
<footer><a href="/">Return to River Green Colony</a> · <a href="/sitemap.xml">XML sitemap</a></footer></main></body></html>`;
}

// This helper operates on the build's empty shell before public prerendering.
export function managerHtml(html, origin) {
  return withOrigin(html
    .replace(/<title>[^<]*<\/title>/, '<title>River Green | Connected Plot Inventory</title>')
    .replace(/<meta name="description"[^>]*\/>/, '<meta name="description" content="Connected plot inventory for the River Green team." />')
    .replace(/<meta name="robots"[^>]*\/>/, '<meta name="robots" content="noindex, nofollow" />')
    .replace('<link rel="canonical" href="__SITE_URL__/" />', '<link rel="canonical" href="__SITE_URL__/plot-manager" />')
    .replace(/\s*<meta (?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*\/>/g, ''), origin);
}

export function seoFiles(origin, lastModified) {
  // A deployment/crawl date is not a meaningful content modification date.
  const lastmod = lastModified ? `<lastmod>${new Date(lastModified).toISOString().slice(0, 10)}</lastmod>` : '';
  const images = [...new Set(['/og-image.jpg', '/images/editorial-hero/open-landscape-3840.webp', '/images/fountain-evening/fountain-families.webp', ...gallery.map(({ src }) => src)])];
  return {
    // Keep the manager crawlable so search engines can read its noindex rule.
    '/robots.txt': ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n'),
    '/sitemap.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      `  <url><loc>${xml(origin)}/</loc>${lastmod}`,
      ...images.map((src) => `    <image:image><image:loc>${xml(origin + src)}</image:loc></image:image>`),
      '  </url>',
      '</urlset>', '',
    ].join('\n'),
    '/sitemap.html': htmlSitemap(origin),
    '/llms.txt': llmsText(origin),
  };
}

export const SEO_TYPES = { '/robots.txt': 'text/plain; charset=utf-8', '/sitemap.xml': 'application/xml; charset=utf-8', '/sitemap.html': 'text/html; charset=utf-8', '/llms.txt': 'text/markdown; charset=utf-8' };
