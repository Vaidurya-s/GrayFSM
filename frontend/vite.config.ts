import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';

/**
 * Resolve the current git SHA at build time so the colophon / Navbar can
 * show a real build hash instead of the literal string "dev". Falls back
 * to the CI-provided env var (most CI systems set GITHUB_SHA, VERCEL_GIT_
 * COMMIT_SHA etc.) and finally to "dev" if neither works.
 */
function resolveBuildHash(): string {
  if (process.env.VITE_BUILD_HASH) return process.env.VITE_BUILD_HASH;
  const ci =
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CI_COMMIT_SHA;
  if (ci) return ci.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const BUILD_HASH = resolveBuildHash();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // `import.meta.env.VITE_BUILD_HASH` reads this at runtime in any
  // component (HomePage colophon, Navbar build-stamp). Variables prefixed
  // with `VITE_` are inlined into the bundle by Vite at build time.
  define: {
    'import.meta.env.VITE_BUILD_HASH': JSON.stringify(BUILD_HASH),
  },
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
