import { createPlotApi } from './plot-api.mjs';
import { createBookingProxy } from './booking-proxy.mjs';
import { bookingDeploymentOptions } from './booking-deployment.mjs';
import { managerHtml, SEO_TYPES, seoFiles, siteOrigin, withOrigin } from './seo.mjs';

export default function plotApiPlugin(options = {}) {
  const origin = options.siteOrigin || siteOrigin();
  const configure = async (server) => {
    const api = await createPlotApi(options);
    const bookingProxy = createBookingProxy(bookingDeploymentOptions({ BOOKING_API_URL: options.bookingApiUrl, PLOT_APP_ORIGIN: options.appOrigin }, { production: false }));
    server.middlewares.use((req, res, next) => { void bookingProxy(req, res, next); });
    // Development and preview serve the same search-engine files as production.
    server.middlewares.use((req, res, next) => {
      const path = (req.url || '').split('?')[0];
      if ((/^\/plot-manager(?:\/(?:index\.html)?)?$/).test(path)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      if (!SEO_TYPES[path]) { next(); return; }
      const body = seoFiles(origin)[path];
      res.setHeader('Content-Type', SEO_TYPES[path]); res.end(req.method === 'HEAD' ? undefined : body);
    });
    server.middlewares.use((req, res, next) => { void api.handle(req, res, next); });
    server.httpServer?.once('close', () => { void api.close(); });
  };
  return {
    name: 'rivergreen-persistent-plot-api', configureServer: configure, configurePreviewServer: configure,
    // Development and built pages share a public canonical origin.
    transformIndexHtml: (html, ctx) => {
      if (!ctx?.server) return html;
      const path = (ctx.originalUrl || ctx.path || '').split('?')[0].replace(/\/+$/, '');
      return (/^\/plot-manager(?:\/(?:index\.html)?)?$/).test(path) ? managerHtml(html, origin) : withOrigin(html, origin);
    },
  };
}
