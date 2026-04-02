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

  const selectedStateData = selectedNode
    ? draftStates.find((s) => s.id === selectedNode)
    : null;

  const selectedTransitionIndex = selectedEdge
    ? draftTransitions.findIndex(
        (t) => `${t.from_state}-${t.to_state}-${t.input || ''}` === selectedEdge
      )
    : -1;

  const selectedTransitionData =
    selectedTransitionIndex >= 0 ? draftTransitions[selectedTransitionIndex] : null;

  if (!selectedStateData && !selectedTransitionData) {
    return (
      <div
        className="bg-white rounded-lg shadow p-4 border border-gray-200"
        data-testid="property-panel"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Properties</h3>
        <p className="text-sm text-gray-500">
          Select a state or transition to edit its properties.
        </p>
      </div>
    );
  }

  if (selectedStateData) {
    return (
      <div
        className="bg-white rounded-lg shadow p-4 border border-gray-200"
        data-testid="property-panel-state"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-4">State Properties</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              data-testid="property-state-name"
              value={selectedStateData.name}
              onChange={(e) =>
                updateState(selectedStateData.id, { name: e.target.value })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Output
            </label>
            <input
              type="text"
              data-testid="property-state-output"
              value={selectedStateData.output || ''}
              onChange={(e) =>
                updateState(selectedStateData.id, { output: e.target.value })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
          <button
            data-testid="property-state-delete"
            onClick={() => removeState(selectedStateData.id)}
            className="w-full px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
          >
            Delete State
          </button>
        </div>
      </div>
    );
  }

  if (selectedTransitionData && selectedTransitionIndex >= 0) {
    return (
      <div
        className="bg-white rounded-lg shadow p-4 border border-gray-200"
        data-testid="property-panel-transition"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Transition Properties
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {draftStates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {draftStates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Input
            </label>
            <input
              type="text"
              data-testid="property-transition-input"
              value={selectedTransitionData.input || ''}
              onChange={(e) =>
                updateTransition(selectedTransitionIndex, { input: e.target.value })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 0, 1, a"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Output
            </label>
            <input
              type="text"
              data-testid="property-transition-output"
              value={selectedTransitionData.output || ''}
              onChange={(e) =>
                updateTransition(selectedTransitionIndex, { output: e.target.value })
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 0, 1"
            />
          </div>
          <button
            data-testid="property-transition-delete"
            onClick={() => removeTransition(selectedTransitionIndex)}
            className="w-full px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
          >
            Delete Transition
          </button>
        </div>
      </div>
    );
  }

  return null;
}
