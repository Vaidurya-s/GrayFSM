import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Source maps shipped to production let anyone read the original TS.
    // Keep them on for `vite dev` (default) and any non-prod build.
    sourcemap: process.env.NODE_ENV !== 'production',
    // chunkSizeWarningLimit lifted to silence the "Some chunks are larger
    // than 500 kB" warning — `charts-*.js` is just over the threshold and
    // is already lazy-friendly via React Query route-level loading.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'react-flow': ['reactflow'],
          // three.js + @react-three/* are deliberately NOT in manualChunks
          // — they're loaded lazily by the Hypercube3D component (see
          // pages/OptimizationPage.tsx). Listing them here would force
          // them into the initial bundle even though only the "Hypercube"
          // tab on the optimization page uses them.
          'charts': ['recharts'],
          'forms': ['react-hook-form', 'zod'],
        },
      },
    },
  },
});
