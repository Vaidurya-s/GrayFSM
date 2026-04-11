import { useState } from 'react';
import { useFSMStore } from '../../store/fsmStore';

export default function PropertyPanel() {
  const {
    selectedNode,
    selectedEdge,
    draftStates,
    draftTransitions,
    updateState,
    updateTransition,
    removeState,
    removeTransition,
    draftInitialState,
    setDraftInitialState,
  } = useFSMStore();

  const [pendingDeleteState, setPendingDeleteState] = useState<string | null>(null);
  const [pendingDeleteTransition, setPendingDeleteTransition] = useState<number | null>(null);

  const validateStateName = (name: string, currentId: string): string | null => {
    if (!name.trim()) return 'Name cannot be empty';
    if (/[^a-zA-Z0-9_]/.test(name)) return 'Only letters, numbers, and underscores allowed';
    if (draftStates.some((s) => s.id !== currentId && s.name === name)) return 'Name already exists';
    return null;
  };

  const selectedStateData = selectedNode
    ? draftStates.find((s) => s.id === selectedNode)
    : null;

  const selectedTransitionIndex = selectedEdge
    ? draftTransitions.findIndex(
        (t, i) => (t.id || `e-${t.from_state}-${t.to_state}-${i}`) === selectedEdge
      )
    : -1;

  const selectedTransitionData =
    selectedTransitionIndex >= 0 ? draftTransitions[selectedTransitionIndex] : null;

  if (!selectedStateData && !selectedTransitionData) {
    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
        data-testid="property-panel"
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Properties</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a state or transition to edit its properties.
        </p>
      </div>
    );
  }

  if (selectedStateData) {
    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
        data-testid="property-panel-state"
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">State Properties</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              data-testid="property-state-name"
              value={selectedStateData.name}
              onChange={(e) => {
                const err = validateStateName(e.target.value, selectedStateData.id);
                if (!err) updateState(selectedStateData.id, { name: e.target.value });
              }}
              className={`w-full px-3 py-1.5 text-sm border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                validateStateName(selectedStateData.name, selectedStateData.id)
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {validateStateName(selectedStateData.name, selectedStateData.id) && (
              <p className="text-xs text-red-600 mt-1" data-testid="property-state-name-error">
                {validateStateName(selectedStateData.name, selectedStateData.id)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Output
            </label>
            <input
              type="text"
              data-testid="property-state-output"
              value={selectedStateData.output || ''}
              onChange={(e) =>
                updateState(selectedStateData.id, { output: e.target.value })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 00, 01, 10"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="initial-state"
              data-testid="property-state-initial"
              checked={draftInitialState === selectedStateData.id}
              onChange={(e) =>
                setDraftInitialState(e.target.checked ? selectedStateData.id : '')
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="initial-state" className="text-xs text-gray-700">
              Initial State
            </label>
          </div>
          {pendingDeleteState === selectedStateData.id ? (
            <div className="space-y-2">
              <p className="text-xs text-red-700">Delete this state?</p>
              <div className="flex gap-2">
                <button
                  data-testid="property-state-delete-confirm"
                  onClick={() => { removeState(selectedStateData.id); setPendingDeleteState(null); }}
                  className="flex-1 px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
                <button
                  data-testid="property-state-delete-cancel"
                  onClick={() => setPendingDeleteState(null)}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              data-testid="property-state-delete"
              onClick={() => setPendingDeleteState(selectedStateData.id)}
              className="w-full px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
            >
              Delete State
            </button>
          )}
        </div>
      </div>
    );
  }

  if (selectedTransitionData && selectedTransitionIndex >= 0) {
    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
        data-testid="property-panel-transition"
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Transition Properties
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              From
            </label>
            <select
              data-testid="property-transition-from"
              value={selectedTransitionData.from_state}
              onChange={(e) =>
                updateTransition(selectedTransitionIndex, {
                  from_state: e.target.value,
                })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {draftStates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              To
            </label>
            <select
              data-testid="property-transition-to"
              value={selectedTransitionData.to_state}
              onChange={(e) =>
                updateTransition(selectedTransitionIndex, {
                  to_state: e.target.value,
                })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {draftStates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Input
            </label>
            <input
              type="text"
              data-testid="property-transition-input"
              value={selectedTransitionData.input || ''}
              onChange={(e) =>
                updateTransition(selectedTransitionIndex, { input: e.target.value })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 0, 1, a"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Output
            </label>
            <input
              type="text"
              data-testid="property-transition-output"
              value={selectedTransitionData.output || ''}
              onChange={(e) =>
                updateTransition(selectedTransitionIndex, { output: e.target.value })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 0, 1"
            />
          </div>
          {pendingDeleteTransition === selectedTransitionIndex ? (
            <div className="space-y-2">
              <p className="text-xs text-red-700">Delete this transition?</p>
              <div className="flex gap-2">
                <button
                  data-testid="property-transition-delete-confirm"
                  onClick={() => { removeTransition(selectedTransitionIndex); setPendingDeleteTransition(null); }}
                  className="flex-1 px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
                <button
                  data-testid="property-transition-delete-cancel"
                  onClick={() => setPendingDeleteTransition(null)}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              data-testid="property-transition-delete"
              onClick={() => setPendingDeleteTransition(selectedTransitionIndex)}
              className="w-full px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
            >
              Delete Transition
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
