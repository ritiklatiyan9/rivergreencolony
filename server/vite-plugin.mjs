import { createPlotApi } from './plot-api.mjs';
import { createBookingProxy } from './booking-proxy.mjs';
import { bookingDeploymentOptions } from './booking-deployment.mjs';
import { SEO_TYPES, seoFiles, siteOrigin, withOrigin } from './seo.mjs';

export default function plotApiPlugin(options = {}) {
  const configure = async (server) => {
    const api = await createPlotApi(options);
    const bookingProxy = createBookingProxy(bookingDeploymentOptions({ BOOKING_API_URL: options.bookingApiUrl, PLOT_APP_ORIGIN: options.appOrigin }, { production: false }));
    server.middlewares.use((req, res, next) => { void bookingProxy(req, res, next); });
    // Development and preview serve the same search-engine files as production.
    server.middlewares.use((req, res, next) => {
      const path = (req.url || '').split('?')[0];
      if (!SEO_TYPES[path]) { next(); return; }
      res.setHeader('Content-Type', SEO_TYPES[path]); res.end(seoFiles(siteOrigin(req))[path]);
    });
    server.middlewares.use((req, res, next) => { void api.handle(req, res, next); });
    server.httpServer?.once('close', () => { void api.close(); });
  };
  return {
    name: 'rivergreen-persistent-plot-api', configureServer: configure, configurePreviewServer: configure,
    // Development pages use relative URLs; built pages keep __SITE_URL__ for the server or prerender to fill.
    transformIndexHtml: (html, ctx) => (ctx?.server ? withOrigin(html, '') : html),
  };
}
