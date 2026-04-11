import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FSMCanvas from '../components/fsm/FSMCanvas';
import PropertyPanel from '../components/fsm/PropertyPanel';
import FSMCreateForm from '../components/forms/FSMCreateForm';
import KeyboardShortcutsModal from '../components/forms/KeyboardShortcutsModal';
import ImportForm from '../components/forms/ImportForm';
import { useFSM, useUpdateFSM } from '../hooks/useFSM';
import { useToast } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { useFSMStore } from '../store/fsmStore';
import { useUIStore } from '../store/uiStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { ShortcutDefinition } from '../hooks/useKeyboardShortcuts';
import { ROUTES, generateRoute } from '../config/routes';
import { cn } from '../utils/cn';

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { data: fsmResponse, isLoading, error } = useFSM(id);
  const updateMutation = useUpdateFSM();

  const {
    draftStates,
    draftTransitions,
    draftName,
    draftInitialState,
    addState,
    loadFSMIntoDraft,
    resetDraft,
    selectedNode,
    selectedEdge,
    removeState,
    removeTransition,
    setSelectedNode,
    setSelectedEdge,
    undo,
    redo,
    canUndo,
    canRedo,
    copySelected,
    pasteClipboard,
  } = useFSMStore();

  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { success: toastSuccess, error: toastError } = useToast();

  // Load FSM into editor when data arrives
  useEffect(() => {
    if (fsmResponse) {
      const fsm = (fsmResponse as unknown as { data: typeof fsmResponse })?.data || fsmResponse;
      if (fsm && typeof fsm === 'object' && 'id' in fsm) {
        loadFSMIntoDraft(fsm as unknown as Parameters<typeof loadFSMIntoDraft>[0]);
      }
    }
  }, [fsmResponse, loadFSMIntoDraft]);

  // Reset on unmount or when creating new
  useEffect(() => {
    if (!id) {
      resetDraft();
    }
    return () => {
      // Don't reset on unmount, user might navigate to optimize
    };
  }, [id, resetDraft]);

  const handleAddState = useCallback(() => {
    const stateNumber = draftStates.length;
    // Circular layout: states arranged on a circle, radius scales with count
    const total = stateNumber + 1;
    const cx = 400;
    const cy = 300;
    const radius = Math.max(120, 80 * Math.min(total, 8));
    const angle = (2 * Math.PI * stateNumber) / Math.max(total, 1);
    const newState = {
      id: `S${stateNumber}`,
      name: `S${stateNumber}`,
      position: {
        x: Math.round(cx + radius * Math.cos(angle - Math.PI / 2)),
        y: Math.round(cy + radius * Math.sin(angle - Math.PI / 2)),
      },
    };
    addState(newState);
  }, [draftStates.length, addState]);

  const handleSave = useCallback(async () => {
    if (id) {
      try {
        await updateMutation.mutateAsync({ id, data: { name: draftName } });
        toastSuccess('FSM saved successfully');
      } catch {
        toastError('Failed to save FSM');
      }
      return;
    }
    setShowCreateForm(true);
  }, [id, updateMutation, draftName, toastSuccess, toastError]);

  const handleCreateSuccess = useCallback(
    (fsmId: string) => {
      setShowCreateForm(false);
      navigate(generateRoute(ROUTES.EDITOR_EDIT, { id: fsmId }));
    },
    [navigate]
  );

  const handleImportSuccess = useCallback(
    (fsmId: string) => {
      setShowImportModal(false);
      toastSuccess('FSM imported successfully');
      navigate(generateRoute(ROUTES.EDITOR_EDIT, { id: fsmId }));
    },
    [navigate, toastSuccess]
  );

  const handleOptimize = useCallback(() => {
    if (id) {
      navigate(generateRoute(ROUTES.OPTIMIZE, { id }));
    }
  }, [id, navigate]);

  /**
   * Delete the currently selected node or edge.
   */
  const handleDelete = useCallback(() => {
    if (selectedNode) {
      removeState(selectedNode);
    } else if (selectedEdge !== null) {
      // selectedEdge is stored as a string; transitions are indexed numerically
      const idx = parseInt(selectedEdge, 10);
      if (!isNaN(idx)) {
        removeTransition(idx);
      } else {
        // Edge id might be a string — find matching transition by id field
        const idx2 = draftTransitions.findIndex((t) => t.id === selectedEdge);
        if (idx2 !== -1) removeTransition(idx2);
      }
      setSelectedEdge(null);
    }
  }, [selectedNode, selectedEdge, removeState, removeTransition, setSelectedEdge, draftTransitions]);

  /**
   * Deselect everything.
   */
  const handleDeselect = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [setSelectedNode, setSelectedEdge]);

  // ---- Keyboard shortcuts ----

  const shortcuts = useMemo<ShortcutDefinition[]>(
    () => [
      {
        key: 's',
        ctrlOrCmd: true,
        handler: () => handleSave(),
        description: 'Save / Create FSM',
      },
      {
        key: 'z',
        ctrlOrCmd: true,
        handler: () => undo(),
        description: 'Undo',
      },
      {
        key: 'z',
        ctrlOrCmd: true,
        shift: true,
        handler: () => redo(),
        description: 'Redo',
      },
      {
        key: 'y',
        ctrlOrCmd: true,
        handler: () => redo(),
        description: 'Redo (alternate)',
      },
      {
        key: 'c',
        ctrlOrCmd: true,
        handler: () => copySelected(),
        description: 'Copy selected state',
      },
      {
        key: 'v',
        ctrlOrCmd: true,
        handler: () => pasteClipboard(),
        description: 'Paste copied state',
      },
      {
        key: 'delete',
        handler: () => handleDelete(),
        description: 'Remove selected element',
      },
      {
        key: 'backspace',
        handler: () => handleDelete(),
        description: 'Remove selected element',
      },
      {
        key: 'escape',
        handler: () => handleDeselect(),
        description: 'Deselect all',
      },
      {
        key: '?',
        handler: () => setShowShortcutsModal(true),
        description: 'Show keyboard shortcuts',
      },
    ],
    [handleSave, handleDelete, handleDeselect, undo, redo, copySelected, pasteClipboard],
  );

  useKeyboardShortcuts(shortcuts);

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-600">Loading FSM...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800">Failed to load FSM</h2>
            <p className="text-sm text-red-600 mt-2">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
            <button
              onClick={() => navigate(ROUTES.HOME)}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col" data-testid="editor-page">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            data-testid="editor-toggle-sidebar"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
              {id ? draftName || 'Edit FSM' : 'New FSM'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {draftStates.length} states, {draftTransitions.length} transitions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Keyboard shortcuts help button */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            data-testid="editor-shortcuts-help"
            title="Keyboard shortcuts (?)"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Show keyboard shortcuts"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* Undo / Redo buttons */}
          <div className="flex items-center gap-1 border border-gray-200 rounded-md">
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              data-testid="editor-undo"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="p-1.5 rounded-l-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 010 10H9m-6-10l4-4M3 10l4 4" />
              </svg>
            </button>
            <div className="w-px h-5 bg-gray-200" />
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              data-testid="editor-redo"
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
              className="p-1.5 rounded-r-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 000 10h4m6-10l-4-4m4 4l-4 4" />
              </svg>
            </button>
          </div>

          {/* Import button */}
          <button
            onClick={() => setShowImportModal(true)}
            data-testid="editor-import"
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Import
          </button>

          <button
            onClick={handleAddState}
            data-testid="editor-add-state"
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            + Add State
          </button>
          <button
            onClick={handleSave}
            data-testid="editor-save"
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            {id ? 'Save' : 'Create'}
          </button>
          {id ? (
            <button
              onClick={handleOptimize}
              data-testid="editor-optimize"
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              Optimize
            </button>
          ) : draftStates.length > 0 ? (
            <button
              disabled
              data-testid="editor-optimize-disabled"
              title="Save first to enable optimization"
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-400 rounded-md cursor-not-allowed opacity-60"
            >
              Optimize
            </button>
          ) : null}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          {draftStates.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="text-center max-w-md">
                <svg
                  className="mx-auto h-16 w-16 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  No states yet
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Click &quot;Add State&quot; to start building your FSM, or connect states
                  by dragging from one handle to another.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={handleAddState}
                    data-testid="editor-add-state-empty"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Add First State
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    data-testid="editor-import-empty"
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Import JSON
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <ErrorBoundary>
              <FSMCanvas />
            </ErrorBoundary>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div
            className={cn(
              'w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto',
              'flex flex-col gap-4 p-4'
            )}
            data-testid="editor-sidebar"
          >
            <PropertyPanel />

            {/* State list */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">States</h3>
              {draftStates.length === 0 ? (
                <p className="text-xs text-gray-500">No states added yet.</p>
              ) : (
                <ul className="space-y-1">
                  {draftStates.map((s) => (
                    <li
                      key={s.id}
                      className={cn(
                        'text-xs px-2 py-1.5 rounded cursor-pointer flex items-center gap-2',
                        s.id === draftInitialState && 'bg-green-50 text-green-700',
                        s.is_dummy && 'bg-orange-50 text-orange-700',
                        !s.is_dummy &&
                          s.id !== draftInitialState &&
                          'hover:bg-gray-50 text-gray-700'
                      )}
                    >
                      <span className="font-medium">{s.name}</span>
                      {s.id === draftInitialState && (
                        <span className="text-[10px] bg-green-100 px-1 rounded">
                          initial
                        </span>
                      )}
                      {s.is_dummy && (
                        <span className="text-[10px] bg-orange-100 px-1 rounded">
                          dummy
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Transition list */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Transitions
              </h3>
              {draftTransitions.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No transitions. Connect states by dragging between handles.
                </p>
              ) : (
                <ul className="space-y-1">
                  {draftTransitions.map((t, i) => (
                    <li
                      key={i}
                      className="text-xs px-2 py-1.5 rounded hover:bg-gray-50 text-gray-700"
                    >
                      {t.from_state} &rarr; {t.to_state}
                      {t.input && (
                        <span className="text-gray-400 ml-1">
                          [{t.input}{t.output ? `/${t.output}` : ''}]
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create FSM modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
            data-testid="create-fsm-modal"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Create New FSM
            </h2>
            <FSMCreateForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcutsModal && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}

      {/* Import FSM modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
            data-testid="import-fsm-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Import FSM</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ImportForm
              onSuccess={handleImportSuccess}
              onCancel={() => setShowImportModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
