import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  // API_PORT lets a second copy (e.g. against a scratch DB) run beside the usual one.
  server: { proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3000}` } },
  build: { outDir: '../dist', emptyOutDir: true },
});
