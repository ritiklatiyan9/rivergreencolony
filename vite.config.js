import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import plotApiPlugin from './server/vite-plugin.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'PLOT_');
  return {
    plugins: [react(), tailwindcss(), plotApiPlugin({ password: env.PLOT_ADMIN_PASSWORD, stateDir: env.PLOT_STATE_DIR, appOrigin: env.PLOT_APP_ORIGIN })],
    build: {
      rollupOptions: {
        output: {
          manualChunks: { three: ['three'], maplibre: ['maplibre-gl'], motion: ['framer-motion'], animation: ['gsap', 'locomotive-scroll'] },
        },
      },
    },
  };
});
