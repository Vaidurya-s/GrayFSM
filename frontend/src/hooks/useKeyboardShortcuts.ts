import { useEffect, useCallback } from 'react';

export interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  cmd?: boolean;
  /** true means Ctrl OR Cmd (cross-platform primary modifier) */
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  /** Human-readable description shown in the shortcuts modal */
  description?: string;
}

/**
 * Tags that, when focused, should suppress shortcut handling so the user can
 * type freely.
 */
const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  if (INPUT_TAGS.has(el.tagName)) return true;
  if (el.isContentEditable) return true;
  return false;
}

function matchesShortcut(e: KeyboardEvent, def: ShortcutDefinition): boolean {
  // Normalise the key for case-insensitive comparison
  const key = e.key.toLowerCase();
  const defKey = def.key.toLowerCase();
  if (key !== defKey) return false;

  const ctrlDown = e.ctrlKey;
  const metaDown = e.metaKey;
  const shiftDown = e.shiftKey;
  const altDown = e.altKey;

  if (def.ctrlOrCmd) {
    if (!ctrlDown && !metaDown) return false;
  } else {
    const wantsCtrl = def.ctrl ?? false;
    const wantsMeta = def.cmd ?? false;
    if (wantsCtrl && !ctrlDown) return false;
    if (wantsMeta && !metaDown) return false;
    // If neither ctrl nor cmd required but one is pressed, reject (avoids
    // hijacking browser shortcuts).
    if (!wantsCtrl && !wantsMeta && !def.ctrlOrCmd && (ctrlDown || metaDown)) return false;
  }

  if ((def.shift ?? false) !== shiftDown) return false;
  if ((def.alt ?? false) !== altDown) return false;

  return true;
}

/**
 * Register global keyboard shortcuts.
 *
 * @param shortcuts - Array of shortcut definitions.  Stable references are
 *   important: wrap in useMemo or define outside the component.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire shortcuts when the user is typing in a form field
      if (isTypingTarget(e.target)) return;

      for (const def of shortcuts) {
        if (matchesShortcut(e, def)) {
          e.preventDefault();
          def.handler(e);
          break; // first match wins
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
