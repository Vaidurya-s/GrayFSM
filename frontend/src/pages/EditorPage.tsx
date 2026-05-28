import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import FSMCanvas from '../components/fsm/FSMCanvas';
import PropertyPanel from '../components/fsm/PropertyPanel';
import FSMCreateForm from '../components/forms/FSMCreateForm';
import KeyboardShortcutsModal from '../components/forms/KeyboardShortcutsModal';
import ImportForm from '../components/forms/ImportForm';
import { useFSM, useUpdateFSM } from '../hooks/useFSM';
import { examplesAPI } from '../api/endpoints/examples';
import { useToast } from '../components/ui';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { useFSMStore } from '../store/fsmStore';
import { useUIStore } from '../store/uiStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { ShortcutDefinition } from '../hooks/useKeyboardShortcuts';
import { ROUTES, generateRoute } from '../config/routes';
import { cn } from '../utils/cn';
import { useEditorModals } from './editor/useEditorModals';

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  // "Try it" on the Examples page links here as /editor/new?example=<id>.
  const exampleId = searchParams.get('example');
  const navigate = useNavigate();
  // Three editor-owned modals (create / shortcuts / import) — co-located
  // in a hook so each modal's open/close pair is one named action instead
  // of a useState-and-setter dance at the page level.
  const modals = useEditorModals();

  const { data: fsmResponse, isLoading, error } = useFSM(id);
  const updateMutation = useUpdateFSM();

  // Granular selectors — each hook call subscribes only to the slice it
  // needs, so unrelated store writes (e.g. per-keystroke draftName changes
  // or undo-stack pushes) do not trigger re-renders of this component.
  const draftStates = useFSMStore((s) => s.draftStates);
  const draftTransitions = useFSMStore((s) => s.draftTransitions);
  const draftName = useFSMStore((s) => s.draftName);
  const draftInitialState = useFSMStore((s) => s.draftInitialState);
  const selectedNode = useFSMStore((s) => s.selectedNode);
  const selectedEdge = useFSMStore((s) => s.selectedEdge);
  const canUndo = useFSMStore((s) => s.canUndo);
  const canRedo = useFSMStore((s) => s.canRedo);
  const addState = useFSMStore((s) => s.addState);
  const loadFSMIntoDraft = useFSMStore((s) => s.loadFSMIntoDraft);
  const resetDraft = useFSMStore((s) => s.resetDraft);
  const removeState = useFSMStore((s) => s.removeState);
  const removeTransition = useFSMStore((s) => s.removeTransition);
  const setSelectedNode = useFSMStore((s) => s.setSelectedNode);
  const setSelectedEdge = useFSMStore((s) => s.setSelectedEdge);
  const undo = useFSMStore((s) => s.undo);
  const redo = useFSMStore((s) => s.redo);
  const copySelected = useFSMStore((s) => s.copySelected);
  const pasteClipboard = useFSMStore((s) => s.pasteClipboard);
  const currentFSM = useFSMStore((s) => s.currentFSM);

  // Lab-report link target. When the loaded FSM is an optimized derivative
  // (`is_optimized` flag set by the optimizer), surface a button that jumps
  // to the OptimizationPage for the *source* FSM — that's where the saved
  // run shows up under the past-results restore path with the comparison,
  // metrics, and hypercube tabs already populated. The source id lives in
  // the JSONB definition as `original_fsm_id`; falling back to undefined
  // hides the button gracefully if a derived FSM was saved before that
  // field was added.
  const labReportTargetId = useMemo<string | undefined>(() => {
    if (!currentFSM?.is_optimized) return undefined;
    const def = currentFSM.definition as unknown as
      | { original_fsm_id?: unknown }
      | undefined;
    const orig = def?.original_fsm_id;
    return typeof orig === 'string' && orig.length > 0 ? orig : undefined;
  }, [currentFSM]);

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

  // Reset on unmount or when creating new — but not when we're about to load
  // a built-in example into the draft (that flow populates it instead).
  useEffect(() => {
    if (!id && !exampleId) {
      resetDraft();
    }
    return () => {
      // Don't reset on unmount, user might navigate to optimize
    };
  }, [id, exampleId, resetDraft]);

  // Load a built-in example into the editor when arriving via ?example=<id>.
  useEffect(() => {
    if (!exampleId || id) return;
    let cancelled = false;
    examplesAPI
      .get(exampleId)
      .then((res) => {
        if (cancelled) return;
        const ex = (res as unknown as { data?: unknown })?.data ?? res;
        loadFSMIntoDraft(ex as Parameters<typeof loadFSMIntoDraft>[0]);
      })
      .catch(() => {
        if (!cancelled) toastError('Failed to load example');
      });
    return () => {
      cancelled = true;
    };
  }, [exampleId, id, loadFSMIntoDraft, toastError]);

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
        const stateNames = draftStates.map((s) => s.name);
        const states = stateNames.length > 0 ? stateNames : ['S0'];
        const initial_state =
          draftInitialState && states.includes(draftInitialState)
            ? draftInitialState
            : states[0];
        await updateMutation.mutateAsync({
          id,
          data: {
            name: draftName,
            states,
            initial_state,
            transitions: draftTransitions.map((t) => ({
              from_state: t.from_state,
              to_state: t.to_state,
              input: t.input,
              output: t.output,
            })),
          },
        });
        toastSuccess('FSM saved successfully');
      } catch {
        toastError('Failed to save FSM');
      }
      return;
    }
    modals.openCreate();
  }, [
    id,
    updateMutation,
    draftName,
    draftStates,
    draftTransitions,
    draftInitialState,
    toastSuccess,
    toastError,
    modals,
  ]);

  const handleCreateSuccess = useCallback(
    (fsmId: string) => {
      modals.closeCreate();
      navigate(generateRoute(ROUTES.EDITOR_EDIT, { id: fsmId }));
    },
    [navigate, modals]
  );

  const handleImportSuccess = useCallback(
    (fsmId: string) => {
      modals.closeImport();
      toastSuccess('FSM imported successfully');
      navigate(generateRoute(ROUTES.EDITOR_EDIT, { id: fsmId }));
    },
    [navigate, toastSuccess, modals]
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
        handler: () => modals.openShortcuts(),
        description: 'Show keyboard shortcuts',
      },
    ],
    [handleSave, handleDelete, handleDeselect, undo, redo, copySelected, pasteClipboard, modals],
  );

  useKeyboardShortcuts(shortcuts);

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-sm text-ink-soft">Loading FSM...</p>
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
    // `relative` contains the absolute sidebar to the editor area so it
    // can't extend up over the sticky navbar. `overflow-x-hidden` clears the
    // spurious horizontal scrollbar from sub-pixel overflow on the toolbar
    // row (page reports body.scrollWidth ≈ viewport width but the browser
    // still renders one).
    <div
      className="relative h-[calc(100vh-4rem)] flex flex-col overflow-x-hidden"
      data-testid="editor-page"
    >
      {/* Toolbar — relative + z-30 puts it above the sidebar so the
          shortcut/help button + Import JSON aren't obscured. */}
      <div className="relative z-30 bg-paper dark:bg-gray-900 border-b border-rule dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            data-testid="editor-toggle-sidebar"
            className="p-1.5 rounded-md text-ink-faint hover:text-ink-soft dark:hover:text-gray-300 hover:bg-paper-shade dark:hover:bg-gray-800"
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-1 text-xs text-ink-faint dark:text-ink-faint mb-0.5">
              <Link to={ROUTES.HOME} className="hover:text-ink-soft dark:hover:text-gray-300">Home</Link>
              <span>/</span>
              <span className="text-ink-soft dark:text-gray-200">{id ? draftName || 'Edit FSM' : 'New FSM'}</span>
            </div>
            <p className="text-xs text-ink-faint dark:text-ink-faint">
              <span className="font-tabular">{draftStates.length}</span> states, <span className="font-tabular">{draftTransitions.length}</span> transitions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Keyboard shortcuts help button */}
          <button
            onClick={() => modals.openShortcuts()}
            data-testid="editor-shortcuts-help"
            title="Keyboard shortcuts (?)"
            className="p-1.5 rounded-md text-ink-faint hover:text-ink-soft hover:bg-paper-shade"
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
          <div className="flex items-center gap-1 border border-rule rounded-md">
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              data-testid="editor-undo"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="p-1.5 rounded-l-md text-ink-faint hover:text-ink-soft hover:bg-paper-shade disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 010 10H9m-6-10l4-4M3 10l4 4" />
              </svg>
            </button>
            <div className="w-px h-5 bg-paper-deep" />
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              data-testid="editor-redo"
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
              className="p-1.5 rounded-r-md text-ink-faint hover:text-ink-soft hover:bg-paper-shade disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 000 10h4m6-10l-4-4m4 4l-4 4" />
              </svg>
            </button>
          </div>

          {/* Import button */}
          <button
            onClick={() => modals.openImport()}
            data-testid="editor-import"
            className="px-3 py-1.5 text-xs font-medium text-ink-soft bg-paper border border-rule-strong rounded-md hover:bg-paper-shade"
          >
            Import
          </button>

          <button
            onClick={handleAddState}
            data-testid="editor-add-state"
            aria-label="Add new state"
            className="px-3 py-1.5 text-xs font-medium text-ink-soft bg-paper border border-rule-strong rounded-md hover:bg-paper-shade"
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
          {id && labReportTargetId ? (
            // The loaded FSM is already an optimization result. Re-running
            // the optimizer would just treat the existing DUMMY_ nodes as
            // ordinary states and bridge them with MORE dummies (4→6→10→12
            // observed in the wild). Block the action and point the user
            // at the Lab Report for the source FSM.
            <button
              disabled
              data-testid="editor-optimize-already-optimized"
              title="Already optimized — open Lab Report to view the source run, or optimize the source FSM directly"
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-400 rounded-md cursor-not-allowed opacity-60"
            >
              Optimize
            </button>
          ) : id ? (
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
          {/* Lab Report — only shown when the loaded FSM is an optimized
              derivative AND we have the source FSM's id. Routes to the
              OptimizationPage for the source, where the saved run replays
              with comparison/metrics/hypercube already populated. */}
          {labReportTargetId && (
            <Link
              to={generateRoute(ROUTES.OPTIMIZE, { id: labReportTargetId })}
              data-testid="editor-lab-report"
              title="View the optimization run that produced this FSM"
              className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              Lab Report
            </Link>
          )}
          {/* Export — only available once the FSM is saved; routes to the
              full export page (Verilog/VHDL/JSON/CSV/Testbench). This was
              completely unreachable from the UI before — only via direct
              URL. */}
          {id && (
            <Link
              to={generateRoute(ROUTES.EXPORT, { id })}
              data-testid="editor-export"
              className="px-3 py-1.5 text-xs font-medium text-ink-soft bg-paper border border-rule-strong rounded-md hover:bg-paper-shade"
            >
              Export
            </Link>
          )}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          {draftStates.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-paper-shade dark:bg-gray-900">
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
                <h3 className="mt-4 text-lg font-medium text-ink dark:text-white">
                  No states yet
                </h3>
                <p className="mt-2 text-sm text-ink-faint dark:text-ink-faint">
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
                    onClick={() => modals.openImport()}
                    data-testid="editor-import-empty"
                    className="px-4 py-2 text-sm font-medium text-ink-soft bg-paper border border-rule-strong rounded-md hover:bg-paper-shade"
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

        {/* Sidebar — full height, overlay on mobile, inline on lg+ */}
        {sidebarOpen && (
          <div
            className={cn(
              'border-l border-rule dark:border-gray-700 bg-paper dark:bg-gray-900 overflow-y-auto',
              'flex flex-col gap-4 p-4',
              // z-20 keeps the sidebar below the editor toolbar (z-30) and
              // the navbar (z-50) so it can't obscure controls.
              'absolute inset-y-0 right-0 z-20 w-72 lg:relative lg:z-auto'
            )}
            data-testid="editor-sidebar"
          >
            <PropertyPanel />

            {/* State list */}
            <div className="bg-paper dark:bg-gray-800 rounded-lg shadow p-4 border border-rule dark:border-gray-700">
              <h3 className="text-sm font-semibold text-ink dark:text-white mb-2">States</h3>
              {draftStates.length === 0 ? (
                <p className="text-xs text-ink-faint">No states added yet.</p>
              ) : (
                <ul className="space-y-1">
                  {draftStates.map((s) => (
                    <li
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedNode(s.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedNode(s.id); }}
                      aria-label={`Select state ${s.name}`}
                      className={cn(
                        'text-xs px-2 py-1.5 rounded cursor-pointer flex items-center gap-2',
                        'focus:outline-none focus:ring-2 focus:ring-accent',
                        s.id === draftInitialState && 'bg-green-50 text-green-700',
                        s.is_dummy && 'bg-orange-50 text-orange-700',
                        !s.is_dummy &&
                          s.id !== draftInitialState &&
                          'hover:bg-paper-shade text-ink-soft'
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
            <div className="bg-paper dark:bg-gray-800 rounded-lg shadow p-4 border border-rule dark:border-gray-700">
              <h3 className="text-sm font-semibold text-ink dark:text-white mb-2">
                Transitions
              </h3>
              {draftTransitions.length === 0 ? (
                <p className="text-xs text-ink-faint">
                  No transitions. Connect states by dragging between handles.
                </p>
              ) : (
                <ul className="space-y-1">
                  {draftTransitions.map((t, i) => (
                    <li
                      key={i}
                      className="text-xs px-2 py-1.5 rounded hover:bg-paper-shade text-ink-soft"
                    >
                      {t.from_state} &rarr; {t.to_state}
                      {t.input && (
                        <span className="text-ink-faint ml-1">
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
      {modals.createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-paper rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
            data-testid="create-fsm-modal"
          >
            <h2 className="text-lg font-semibold text-ink mb-4">
              Create New FSM
            </h2>
            <FSMCreateForm
              onSuccess={handleCreateSuccess}
              onCancel={() => modals.closeCreate()}
            />
          </div>
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      {modals.shortcutsOpen && (
        <KeyboardShortcutsModal onClose={() => modals.closeShortcuts()} />
      )}

      {/* Import FSM modal */}
      {modals.importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-paper rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
            data-testid="import-fsm-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ink">Import FSM</h2>
              <button
                onClick={() => modals.closeImport()}
                className="p-1 rounded-md text-ink-faint hover:text-ink-soft hover:bg-paper-shade"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ImportForm
              onSuccess={handleImportSuccess}
              onCancel={() => modals.closeImport()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
