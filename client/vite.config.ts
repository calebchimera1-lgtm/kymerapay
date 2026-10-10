import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The monorepo keeps a single `.env` at the repository root.
const envDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_');

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY ?? 'http://localhost:4000',
          changeOrigin: false,
        },
        // Uploaded avatars and logos are served by the API.
        '/uploads': {
          target: env.VITE_DEV_API_PROXY ?? 'http://localhost:4000',
          changeOrigin: false,
        },
      },
    },
    preview: { port: 4173 },
    build: { sourcemap: true },
  };
});
