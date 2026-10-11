// npm run test:seo
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACTS, FAQS, SITE, llmsText, structuredData } from './seo.js';
import { seoFiles, siteOrigin, withOrigin } from '../../server/seo.mjs';

const origin = 'https://example.com';

test('structured data describes the colony, its sales office and the FAQ', () => {
  const graph = structuredData(origin, ['/images/hd/rivergreen-01.webp'])['@graph'];
  const byType = Object.fromEntries(graph.map((node) => [node['@type'], node]));
  for (const type of ['Organization', 'WebSite', 'Residence', 'RealEstateAgent', 'WebPage', 'FAQPage']) assert.ok(byType[type], `${type} missing`);
  assert.equal(byType.Residence.address.postalCode, '247776');
  assert.equal(byType.Residence.address.addressLocality, 'Shamli');
  assert.equal(byType.RealEstateAgent.name, SITE.name);
  assert.equal(byType.FAQPage.mainEntity.length, FAQS.length);
  for (const node of graph) for (const value of JSON.stringify(node).match(/https?:\/\/[^"]+/g) || []) assert.ok(!value.includes('__SITE_URL__'), value);
  assert.ok(!('geo' in byType.Residence) || SITE.geo, 'geo is only emitted once a real pin is set');
});

test('the page head matches the shared title and description', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`<title>${SITE.title}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${SITE.description}" />`));
  assert.ok(SITE.title.length <= 60 && SITE.description.length <= 160);
  assert.ok(html.includes('<link rel="canonical" href="__SITE_URL__/" />'));
  assert.ok(html.includes(`<meta name="geo.position" content="${SITE.geo.latitude};${SITE.geo.longitude}" />`), 'geo.position must match SITE.geo');
  assert.match(SITE.url, /^https:\/\/[^/\s]+$/, 'the build default origin must be an https origin without a trailing slash');
  assert.equal(withOrigin('<a href="__SITE_URL__/x">', origin), `<a href="${origin}/x">`);
});

test('robots, sitemap and llms.txt point at the site', () => {
  const files = seoFiles(origin, '2026-10-08T00:00:00Z');
  assert.ok(files['/robots.txt'].includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.ok(files['/robots.txt'].includes('Disallow: /plot-manager'));
  assert.ok(files['/sitemap.xml'].includes(`<loc>${origin}/</loc><lastmod>2026-10-08</lastmod>`));
  assert.ok((files['/sitemap.xml'].match(/<image:image>/g) || []).length >= 12);
  const llms = llmsText(origin);
  assert.ok(llms.startsWith('# River Green Colony, Shamli') && FACTS.every(([label]) => llms.includes(`- ${label}:`)));
});

test('the origin comes from configuration, else a well-formed host', () => {
  const saved = process.env.SITE_URL;
  process.env.SITE_URL = 'https://rivergreen.example/';
  assert.equal(siteOrigin({ headers: { host: 'evil.test' } }), 'https://rivergreen.example');
  delete process.env.SITE_URL;
  const savedApp = process.env.PLOT_APP_ORIGIN; delete process.env.PLOT_APP_ORIGIN;
  assert.equal(siteOrigin({ headers: { host: 'www.site.in' } }), 'https://www.site.in');
  assert.equal(siteOrigin({ headers: { host: '127.0.0.1:5173' } }), 'http://127.0.0.1:5173');
  assert.equal(siteOrigin({ headers: { host: 'bad host"><script>' } }), '');
  if (saved) process.env.SITE_URL = saved;
  if (savedApp) process.env.PLOT_APP_ORIGIN = savedApp;
});
