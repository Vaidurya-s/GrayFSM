import { useState } from 'react';

/**
 * Co-locates the three modal flags the EditorPage owns.
 *
 * Before this hook, the editor was holding `showCreateForm`,
 * `showShortcutsModal`, and `showImportModal` as three separate `useState`
 * calls scattered across the page body. They have nothing to do with the
 * FSM-editing logic, so pulling them into a single hook makes the page
 * shorter and lets each modal's open/close logic be tested in isolation
 * without rendering the full editor.
 *
 * Naming convention: `<modal>Open` for the boolean, `open<Modal>()` /
 * `close<Modal>()` for the actions. Avoids the slightly-clumsier
 * `setShow<Modal>(true|false)` pattern at call sites.
 */
export function useEditorModals() {
  const [createOpen, setCreateOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return {
    createOpen,
    openCreate: () => setCreateOpen(true),
    closeCreate: () => setCreateOpen(false),

    shortcutsOpen,
    openShortcuts: () => setShortcutsOpen(true),
    closeShortcuts: () => setShortcutsOpen(false),

    importOpen,
    openImport: () => setImportOpen(true),
    closeImport: () => setImportOpen(false),
  };
}
