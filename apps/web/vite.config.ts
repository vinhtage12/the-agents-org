import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const config = defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '');
  return {
    resolve: {
      tsconfigPaths: true,
      dedupe: ['react', 'react-dom']
    },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        indexToken: 'home'
      }),
      viteReact()
    ],
    // The daemon listens on loopback only; proxying keeps the API same-origin for remote browsers.
    server: {
      port: 3000,
      proxy: API_PROXY_TARGET
        ? { '/api': { target: API_PROXY_TARGET, ws: true } }
        : undefined
    }
  };
});

export default config;
