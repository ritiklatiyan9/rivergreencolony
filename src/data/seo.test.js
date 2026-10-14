// npm run test:seo
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACTS, FAQS, SITE, llmsText, structuredData } from './seo.js';
import { managerHtml, seoFiles, siteOrigin, withOrigin } from '../../server/seo.mjs';

const origin = 'https://example.com';
const pageShell = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const publicFile = (path) => new URL(`../../public${path}`, import.meta.url);
const pngSize = (path) => {
  const bytes = readFileSync(publicFile(path));
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), `${path} must be a PNG`);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
};

test('structured data describes the colony, its sales office and the FAQ', () => {
  const graph = structuredData(origin, ['/images/hd/rivergreen-01.webp'])['@graph'];
  const byType = Object.fromEntries(graph.map((node) => [node['@type'], node]));
  for (const type of ['Organization', 'WebSite', 'Residence', 'RealEstateAgent', 'WebPage', 'FAQPage']) assert.ok(byType[type], `${type} missing`);
  assert.equal(byType.Residence.address.postalCode, '247776');
  assert.equal(byType.Residence.address.addressLocality, 'Shamli');
  assert.equal(byType.RealEstateAgent.name, SITE.name);
  assert.equal(byType.RealEstateAgent.logo.url, `${origin}${SITE.logo}`);
  assert.equal(byType.WebSite.image.url, `${origin}${SITE.logo}`);
  assert.equal(byType.WebPage.mainEntity['@id'], byType.Residence['@id']);
  assert.equal(byType.FAQPage.isPartOf['@id'], byType.WebPage['@id']);
  assert.equal(byType.FAQPage.mainEntity.length, FAQS.length);
  for (const node of graph) for (const value of JSON.stringify(node).match(/https?:\/\/[^"]+/g) || []) assert.ok(!value.includes('__SITE_URL__'), value);
  assert.ok(!('geo' in byType.Residence) || SITE.geo, 'geo is only emitted once a real pin is set');
});

test('the page head matches the shared title and description', () => {
  const html = pageShell;
  assert.ok(html.includes(`<title>${SITE.title}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${SITE.description}" />`));
  assert.ok(SITE.title.length <= 60 && SITE.description.length <= 160);
  assert.ok(html.includes('<link rel="canonical" href="__SITE_URL__/" />'));
  assert.ok(html.includes(`<meta name="geo.position" content="${SITE.geo.latitude};${SITE.geo.longitude}" />`), 'geo.position must match SITE.geo');
  assert.match(SITE.url, /^https:\/\/[^/\s]+$/, 'the build default origin must be an https origin without a trailing slash');
  assert.equal(withOrigin('<a href="__SITE_URL__/x">', origin), `<a href="${origin}/x">`);
  assert.ok(html.includes('<link rel="sitemap" type="application/xml" href="/sitemap.xml" />'));
});

test('robots allows reading the manager noindex rule and advertises the canonical sitemap', () => {
  const files = seoFiles(origin);
  assert.ok(files['/robots.txt'].includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.ok(files['/robots.txt'].includes('Disallow: /api/'));
  assert.ok(!files['/robots.txt'].includes('Disallow: /plot-manager'));
  const llms = llmsText(origin);
  assert.ok(llms.startsWith('# River Green Colony, Shamli') && FACTS.every(([label]) => llms.includes(`- ${label}:`)));
});

test('the XML sitemap lists only the canonical public page and existing unique images', () => {
  const sitemap = seoFiles(origin)['/sitemap.xml'];
  const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(pages, [`${origin}/`], 'aliases, sections and the manager must not be separate indexable URLs');
  const images = [...sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((match) => match[1]);
  assert.equal(images.length, 14);
  assert.equal(new Set(images).size, images.length);
  for (const url of images) {
    assert.equal(new URL(url).origin, origin);
    assert.ok(readFileSync(publicFile(new URL(url).pathname)).length > 0, `${url} must exist`);
  }
  assert.ok(images.includes(`${origin}/images/editorial-hero/open-landscape-3840.webp`));
  assert.ok(images.includes(`${origin}/images/fountain-evening/fountain-families.webp`));
  assert.doesNotMatch(sitemap, /<(?:lastmod|changefreq|priority|image:title|image:caption)>/);
  assert.ok(seoFiles(origin, '2026-10-08T00:00:00Z')['/sitemap.xml'].includes('<lastmod>2026-10-08</lastmod>'));
});

test('the human sitemap links to real sections and project contacts while allowing link discovery', () => {
  const html = seoFiles(origin)['/sitemap.html'];
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.ok(html.includes(`<link rel="canonical" href="${origin}/sitemap.html">`));
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const sections = [...html.matchAll(/href="\/#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(sections.length >= 6);
  for (const section of sections) assert.ok(app.includes(`id="${section}"`), `section ${section} must exist in the public page`);
  for (const link of [SITE.mapUrl, SITE.projectUrl, `mailto:${SITE.email}`, `tel:+${SITE.salesPhone.replace(/\D/g, '')}`, '/sitemap.xml']) {
    assert.ok(html.includes(`href="${link}"`), `${link} must be discoverable`);
  }
  assert.ok(!html.includes('/plot-manager'));
});

test('the canonical origin is configured or the public site address, independent of host headers', () => {
  const request = { headers: { host: '127.0.0.1:5173', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'http' } };
  assert.equal(siteOrigin(request, {}), SITE.url);
  assert.equal(siteOrigin({ headers: { host: 'bad host"><script>' } }, {}), SITE.url);
  assert.equal(siteOrigin(undefined, {}), SITE.url);
  assert.equal(siteOrigin(request, { SITE_URL: ' https://RiverGreen.example/ ', PLOT_APP_ORIGIN: 'https://other.example' }), 'https://rivergreen.example');
  assert.equal(siteOrigin(request, { PLOT_APP_ORIGIN: 'https://rivergreen.example/' }), 'https://rivergreen.example');
});

test('invalid origin configuration fails instead of producing broken canonical or sitemap URLs', () => {
  for (const value of ['relative.example', 'javascript:alert(1)', 'ftp://example.com', 'https://user:password@example.com', 'https://example.com/project', 'https://example.com/?query=1', 'https://example.com/#home', 'https://', ' ']) {
    assert.throws(() => siteOrigin(undefined, { SITE_URL: value }), /SITE_URL must be/, value);
  }
  assert.throws(() => siteOrigin(undefined, { PLOT_APP_ORIGIN: 'https://example.com/path' }), /SITE_URL must be/);
});

test('configured origins agree across page metadata, structured data and crawl files', () => {
  const configured = siteOrigin({ headers: { host: 'preview.example' } }, { SITE_URL: 'https://rivergreen.example' });
  const html = withOrigin(pageShell, configured);
  const files = seoFiles(configured);
  assert.ok(html.includes(`<link rel="canonical" href="${configured}/" />`));
  assert.ok(html.includes(`<meta property="og:url" content="${configured}/" />`));
  assert.ok(html.includes(`<meta property="og:image" content="${configured}/og-image.jpg" />`));
  assert.ok(files['/robots.txt'].includes(`Sitemap: ${configured}/sitemap.xml`));
  assert.ok(files['/sitemap.xml'].includes(`<loc>${configured}/</loc>`));
  const graph = structuredData(configured)['@graph'];
  for (const node of graph) assert.equal(new URL(node['@id']).origin, configured);
  assert.ok(!html.includes('__SITE_URL__') && !html.includes('preview.example'));
});

test('the management shell is excluded from indexing and public sharing metadata', () => {
  const html = managerHtml(pageShell, origin);
  assert.ok(html.includes('<meta name="robots" content="noindex, nofollow" />'));
  assert.ok(html.includes(`<link rel="canonical" href="${origin}/plot-manager" />`));
  assert.ok(html.includes('<title>River Green | Connected Plot Inventory</title>'));
  assert.ok(html.includes('<div id="root"></div>'));
  assert.doesNotMatch(html, /<meta (?:property="og:|name="twitter:)/);
  assert.ok(!html.includes(SITE.description));
  assert.ok(!html.includes('application/ld+json') && !html.includes('data-prerendered') && !html.includes('__SITE_URL__'));
});

test('favicon and touch-icon declarations point to correctly sized public assets', () => {
  const links = [...pageShell.matchAll(/<link\b[^>]+>/g)].map((match) => match[0]);
  const icons = links.filter((tag) => /rel="(?:icon|apple-touch-icon)"/.test(tag));
  assert.ok(icons.some((tag) => tag.includes('href="/favicon.ico"')));
  assert.ok(icons.some((tag) => tag.includes('href="/favicon-96.png"')));
  assert.ok(icons.some((tag) => tag.includes('href="/apple-touch-icon.png"')));
  for (const tag of icons) {
    const path = tag.match(/href="([^"]+)"/)[1];
    assert.ok(readFileSync(publicFile(path)).length > 0, `${path} must exist`);
    if (path.endsWith('.png')) assert.equal(pngSize(path), tag.match(/sizes="([^"]+)"/)[1]);
  }
  const ico = readFileSync(publicFile('/favicon.ico'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.readUInt16LE(4) >= 3, 'ICO must support small browser-tab sizes');
});

test('the web manifest uses square brand icons with matching declared dimensions', () => {
  assert.ok(pageShell.includes('<link rel="manifest" href="/site.webmanifest" />'));
  const manifest = JSON.parse(readFileSync(publicFile('/site.webmanifest'), 'utf8'));
  assert.equal(manifest.name, SITE.name);
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.theme_color, '#102d20');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  for (const icon of manifest.icons) {
    assert.equal(icon.type, 'image/png');
    assert.equal(pngSize(icon.src), icon.sizes);
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(width, height);
    assert.ok(width > 48);
  }
});
