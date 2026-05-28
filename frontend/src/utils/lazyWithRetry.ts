import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * Reload-on-stale-chunk wrapper around React.lazy.
 *
 * After a deploy, Vite emits new content-hashed chunk filenames; tabs
 * that still hold the previous index.html will try to `import()` chunks
 * by the *old* hashes, which the server no longer serves. The dynamic
 * import then rejects with "Failed to fetch dynamically imported
 * module" and surfaces as the app's generic error boundary.
 *
 * On the first such failure within a session, force a page reload so
 * the browser fetches the new index.html + the new chunk paths. A
 * sessionStorage flag prevents an infinite reload loop if the failure
 * is a real network issue rather than a stale-tab one.
 */

const RELOAD_KEY = 'lazy-import-reloaded';

function isChunkLoadError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string };
  if (e.name === 'ChunkLoadError') return true;
  const msg = e.message ?? '';
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Clear the flag on success so a subsequent stale-chunk failure
      // (after a future deploy in this same tab) still gets one reload.
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* sessionStorage unavailable — fine */
      }
      return mod;
    } catch (err) {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1';
      } catch {
        /* sessionStorage unavailable — fall through to throw */
      }
      if (isChunkLoadError(err) && !alreadyReloaded) {
        try {
          sessionStorage.setItem(RELOAD_KEY, '1');
        } catch {
          /* ignore */
        }
        window.location.reload();
        // Block resolution until the reload navigates away, so React
        // doesn't surface the rejection to the nearest error boundary.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
