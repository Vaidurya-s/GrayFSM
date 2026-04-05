interface ShortcutRow {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['Ctrl', 'S'], description: 'Save / Create FSM' },
  { keys: ['Ctrl', 'Z'], description: 'Undo' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
  { keys: ['Ctrl', 'Y'], description: 'Redo (alternate)' },
  { keys: ['Ctrl', 'C'], description: 'Copy selected state' },
  { keys: ['Ctrl', 'V'], description: 'Paste copied state (+20 px offset)' },
  { keys: ['Delete'], description: 'Remove selected state or transition' },
  { keys: ['Backspace'], description: 'Remove selected state or transition' },
  { keys: ['Escape'], description: 'Deselect all' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
];

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 text-xs font-mono font-semibold bg-gray-100 border border-gray-300 rounded shadow-sm text-gray-700">
      {label}
    </kbd>
  );
}

export default function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcut table */}
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="pb-2 w-1/2">Keys</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1">
                      {row.keys.map((k, ki) => (
                        <span key={ki} className="inline-flex items-center gap-1">
                          <KeyBadge label={k} />
                          {ki < row.keys.length - 1 && (
                            <span className="text-gray-400 text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-700">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-gray-50 rounded-b-lg border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Shortcuts are disabled when a text field is focused.
          </p>
        </div>
      </div>
    </div>
  );
}
