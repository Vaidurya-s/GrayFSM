import { useEffect, useState } from 'react';

/* -------------------------------------------------------------------------- *
 * useThemeColors — read design-system tokens from `:root` so SVG / canvas    *
 * visualisations inherit the active theme.                                   *
 * -------------------------------------------------------------------------- *
 *                                                                            *
 * Recharts, Three.js, and any other rendering surface that draws to SVG or   *
 * WebGL doesn't inherit CSS custom properties — colours have to be passed    *
 * in as explicit strings. This hook samples `getComputedStyle` on the root   *
 * element, returns the resolved values, and re-runs whenever the `dark` /   *
 * `light` class on `<html>` flips (via MutationObserver on `attributes`).    *
 *                                                                            *
 * Fallbacks match the Phase-1 light-theme tokens so SSR / first-paint /     *
 * test environments without a real document still get sensible values.      *
 * -------------------------------------------------------------------------- */

export interface ThemeColors {
  ink: string;
  inkSoft: string;
  inkFaint: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  accentSoft: string;
  accentTint: string;
  paper: string;
  paperShade: string;
  paperDeep: string;
  ok: string;
  warn: string;
  err: string;
}

const FALLBACK: ThemeColors = {
  ink: '#14110d',
  inkSoft: '#4a4338',
  inkFaint: '#8c8474',
  rule: '#c9c0a8',
  ruleStrong: '#8c8474',
  accent: '#0c5ce8',
  accentSoft: '#4d8df0',
  accentTint: '#e0eaff',
  paper: '#f7f4ec',
  paperShade: '#ede8d8',
  paperDeep: '#e3ddc8',
  ok: '#2a6e3f',
  warn: '#c47a00',
  err: '#c12a2a',
};

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  ink: '--ink',
  inkSoft: '--ink-soft',
  inkFaint: '--ink-faint',
  rule: '--rule',
  ruleStrong: '--rule-strong',
  accent: '--accent',
  accentSoft: '--accent-soft',
  accentTint: '--accent-tint',
  paper: '--paper',
  paperShade: '--paper-shade',
  paperDeep: '--paper-deep',
  ok: '--ok',
  warn: '--warn',
  err: '--err',
};

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(FALLBACK);

  useEffect(() => {
    const read = () => {
      if (typeof window === 'undefined') return;
      const styles = getComputedStyle(document.documentElement);
      const next: Partial<ThemeColors> = {};
      for (const key of Object.keys(CSS_VAR_MAP) as (keyof ThemeColors)[]) {
        const v = styles.getPropertyValue(CSS_VAR_MAP[key]).trim();
        next[key] = v || FALLBACK[key];
      }
      setColors(next as ThemeColors);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
