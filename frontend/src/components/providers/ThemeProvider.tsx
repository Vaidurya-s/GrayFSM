import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './theme-context';

const STORAGE_KEY = 'grayfsm-theme';

function resolveIsDark(theme: Theme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Apply theme classes to the root <html> element.
 *
 * Three states matter for the CSS cascade in `globals.css`:
 *   - `.dark`  — explicit dark theme (Tailwind's `darkMode: 'class'` reads this)
 *   - `.light` — explicit light theme; needed so the
 *                `@media (prefers-color-scheme: dark) :root:not(.light) { … }`
 *                fallback doesn't override an explicit light choice on a
 *                machine whose OS prefers dark.
 *   - neither  — "system": the prefers-color-scheme media query decides.
 *
 * `theme` is the user's stored preference; `isDark` is the resolved current
 * value used for Tailwind utilities.
 */
function applyTheme(theme: Theme, isDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', theme === 'light');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
    return 'system';
  });

  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(theme));

  // Apply theme classes whenever theme or isDark changes
  useEffect(() => {
    applyTheme(theme, isDark);
  }, [theme, isDark]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') {
      setIsDark(resolveIsDark(theme));
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    setIsDark(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
