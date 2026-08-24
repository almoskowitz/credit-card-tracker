import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    // Dev-only: the built app is served by the FastAPI process itself (server/static/), so
    // this proxy only matters for `npm run dev` against a locally running `uvicorn`.
    proxy: {
      '/api': 'http://127.0.0.1:8101',
    },
  },
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
  test: {
    environment: 'node',
  },
});
