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
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'react-flow': ['reactflow'],
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', 'zod'],
        },
      },
    },
  },
});
