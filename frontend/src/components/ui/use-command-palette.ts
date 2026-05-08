import { useCallback, useEffect, useState } from 'react';

/**
 * Global Ctrl+K / Cmd+K hook — open/close state for the command palette.
 *
 * Split out of `CommandPalette.tsx` so React Refresh can fast-refresh
 * the component without reloading the keybinding handler. Files that
 * export both a component AND a non-component value (like a hook)
 * confuse Fast Refresh.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const trigger = isMac ? e.metaKey : e.ctrlKey;
      if (trigger && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  return { isOpen, open, close, toggle };
}
