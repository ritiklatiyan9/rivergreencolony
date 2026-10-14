import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import plotApiPlugin from './server/vite-plugin.mjs';
import { siteOrigin } from './server/seo.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'PLOT_');
  const bookingEnv = loadEnv(mode, process.cwd(), 'BOOKING_');
  const siteEnv = loadEnv(mode, process.cwd(), 'SITE_');
  const origin = siteOrigin(undefined, { SITE_URL: siteEnv.SITE_URL, PLOT_APP_ORIGIN: env.PLOT_APP_ORIGIN });
  return {
    define: { 'import.meta.env.VITE_SEO_ORIGIN': JSON.stringify(origin) },
    plugins: [react(), tailwindcss(), plotApiPlugin({ password: env.PLOT_ADMIN_PASSWORD, stateDir: env.PLOT_STATE_DIR, appOrigin: env.PLOT_APP_ORIGIN, bookingApiUrl: bookingEnv.BOOKING_API_URL, siteOrigin: origin })],
    build: {
      rollupOptions: {
        output: {
          manualChunks: { three: ['three'], maplibre: ['maplibre-gl'], motion: ['framer-motion'], animation: ['gsap', 'lenis'] },
        },
      },
    },
  };
});
