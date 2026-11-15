import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const isStaticPages = mode === 'pages' || process.env.VITE_STATIC_MODE === 'true';
  return {
    root: path.resolve(__dirname, 'client'),
    base: process.env.VITE_BASE_PATH || '/',
    define: {
      'import.meta.env.VITE_STATIC_MODE': JSON.stringify(isStaticPages ? 'true' : 'false'),
    },
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
  };
});
