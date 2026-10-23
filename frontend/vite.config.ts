import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // This game uses Phaser's Arcade Physics, not Matter. Use Phaser's
    // minified Arcade-only distribution to reduce the lazy game download.
    alias: [{ find: /^phaser$/, replacement: 'phaser/dist/phaser-arcade-physics.min.js' }],
  },
  build: {
    rollupOptions: {
      output: {
        // Keep React and Phaser independently cacheable. Phaser remains a
        // dependency of the lazy Game import, so the case menu still skips it.
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'phaser-engine': ['phaser'],
        },
      },
    },
    // Keep the lazy game chunk's size warning visible; the minified Arcade-only
    // Phaser dependency still exceeds this 1000KB optimization target.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      // Backend API during local dev (Phase 4+ investigation integration).
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
