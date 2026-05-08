import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

/**
 * Theme context — split out of `ThemeProvider.tsx` so React Refresh can do
 * fast-refresh on theme-related component changes without a full reload.
 * Files that export both a component AND a non-component value (context,
 * hook, plain helper) confuse React Refresh.
 */
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
