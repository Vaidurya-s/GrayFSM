/** @type {import('tailwindcss').Config} */
//
// Datasheet-brutalism design system — Phase 1 of the redesign.
//
// Notes:
// - `darkMode: 'class'` is preserved; ThemeProvider toggles `.dark` on <html>.
// - Color tokens are CSS variables defined in `src/styles/globals.css`; the
//   entries below expose them as Tailwind utilities so authors can write
//   `bg-paper`, `text-ink`, `border-rule`, `text-accent` etc.
// - The legacy `primary` and `gray` ramps are kept (with `primary` re-pointed
//   at the new electric blue) so existing pages keep rendering until their
//   redesign phase lands. They will be removed once every page is migrated.
// - `success` / `warning` / `error` are aliased to the semantic CSS vars.
//
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // -------- design-system tokens (read CSS vars; theme-aware) --------
        paper:       'var(--paper)',
        'paper-shade': 'var(--paper-shade)',
        'paper-deep':  'var(--paper-deep)',
        ink:         'var(--ink)',
        'ink-soft':  'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        rule:        'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        accent:      'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-tint': 'var(--accent-tint)',

        // -------- semantic status (vars; usable as bg-ok / text-warn etc.) -
        ok:    'var(--ok)',
        warn:  'var(--warn)',
        err:   'var(--err)',

        // -------- legacy scale, kept until pages are migrated --------------
        // `primary` re-pointed to the new electric blue so existing
        // primary-* utilities visually shift toward the new palette without
        // breaking layout.
        primary: {
          50:  '#e8efff',
          100: '#cfdbff',
          200: '#a3b9ff',
          300: '#7796f7',
          400: '#4d77f0',
          500: '#0c5ce8',
          600: '#0a4dc7',
          700: '#093ea0',
          800: '#082f78',
          900: '#062354',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          700: '#047857',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          700: '#b45309',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        sans:  ['IBM Plex Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['IBM Plex Serif', 'Iowan Old Style', 'Charter', 'Georgia', 'serif'],
        mono:  ['IBM Plex Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      // Tabular figures and other OpenType features as utility classes.
      // Use `font-tabular` for any numeric column / metric.
      fontFeatureSettings: {
        tabular: '"tnum" 1, "lnum" 1',
        oldstyle: '"onum" 1, "kern" 1, "liga" 1',
      },
      spacing: {
        18: '4.5rem',
        112: '28rem',
        128: '32rem',
      },
      borderRadius: {
        // Datasheet aesthetic: no rounded corners. The `4xl` token is kept
        // for ReactFlow / Three.js controls that occasionally need it.
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    // Expose `font-tabular` and `font-oldstyle` utilities backed by
    // font-feature-settings — keeps numeric tables aligned.
    function ({ addUtilities, theme }) {
      const features = theme('fontFeatureSettings') || {};
      const utilities = Object.fromEntries(
        Object.entries(features).map(([name, value]) => [
          `.font-${name}`,
          { 'font-feature-settings': value },
        ]),
      );
      addUtilities(utilities);
    },
  ],
};
