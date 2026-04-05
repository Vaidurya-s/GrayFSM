import { useMemo, useState } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from 'reactflow';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import StateNode from '../fsm/StateNode';
import TransitionEdge from '../fsm/TransitionEdge';
import type { FSM, OptimizationResponse, State, Transition } from '../../types/fsm';

const nodeTypes = { stateNode: StateNode };
const edgeTypes = { transitionEdge: TransitionEdge };

function statesToNodes(states: State[], initialState: string): Node[] {
  return states.map((s, i) => ({
    id: s.id,
    type: 'stateNode',
    position: s.position || {
      x: 150 + (i % 4) * 220,
      y: 100 + Math.floor(i / 4) * 180,
    },
    data: {
      label: s.name,
      output: s.output,
      isInitial: s.id === initialState || s.name === initialState,
      isDummy: s.is_dummy,
    },
  }));
}

function transitionsToEdges(transitions: Transition[]): Edge[] {
  return transitions.map((t, i) => ({
    id: t.id || `e-${t.from_state}-${t.to_state}-${i}`,
    source: t.from_state,
    target: t.to_state,
    type: 'transitionEdge',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    data: {
      input: t.input,
      output: t.output,
      label: t.label,
    },
  }));
}

interface StaticCanvasProps {
  fsm: FSM;
  label: string;
  badge?: React.ReactNode;
}

function StaticCanvas({ fsm, label, badge }: StaticCanvasProps) {
  const states: State[] =
    fsm.definition?.states ||
    fsm.states.map((name, i) => ({
      id: name,
      name,
      position: { x: 150 + (i % 4) * 200, y: 100 + Math.floor(i / 4) * 150 },
    }));

  const transitions: Transition[] = fsm.transitions || [];

  const initialNodes = useMemo(
    () => statesToNodes(states, fsm.initial_state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fsm.id]
  );
  const initialEdges = useMemo(
    () => transitionsToEdges(transitions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fsm.id]
  );

  const [nodes] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg shrink-0">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        {badge}
      </div>
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(node) => {
              if (node.data?.isInitial) return '#22c55e';
              if (node.data?.isDummy) return '#f97316';
              return '#e5e7eb';
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}

interface ComparisonViewProps {
  originalFSM: FSM;
  optimizedFSM: FSM;
  metrics: OptimizationResponse;
}

type ViewMode = 'side-by-side' | 'overlay';

export default function ComparisonView({
  originalFSM,
  optimizedFSM,
  metrics,
}: ComparisonViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');

  const statesAdded = metrics.dummy_states_added;
  const transitionsChanged =
    (optimizedFSM.transition_count ?? 0) - (originalFSM.transition_count ?? 0);
  const improvementPct = metrics.improvement_percentage;

  const statsBadgeOriginal = (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600">
      {originalFSM.state_count} states
    </span>
  );

  const statsBadgeOptimized = (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 font-medium">
      {optimizedFSM.state_count} states
    </span>
  );

  return (
    <div className="flex flex-col gap-3 h-full" data-testid="comparison-view">
      {/* Controls bar */}
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-700">FSM Comparison</h3>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setViewMode('overlay')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'overlay'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Overlay
          </button>
        </div>
      </div>

      {/* Stats summary bar */}
      <div className="grid grid-cols-3 gap-2 shrink-0">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-orange-700">
            {statesAdded >= 0 ? `+${statesAdded}` : statesAdded}
          </div>
          <div className="text-xs text-orange-600">Dummy States Added</div>
        </div>
        <div
          className={`border rounded-lg p-2 text-center ${
            transitionsChanged >= 0
              ? 'bg-blue-50 border-blue-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div
            className={`text-lg font-bold ${
              transitionsChanged >= 0 ? 'text-blue-700' : 'text-red-700'
            }`}
          >
            {transitionsChanged >= 0 ? `+${transitionsChanged}` : transitionsChanged}
          </div>
          <div
            className={`text-xs ${
              transitionsChanged >= 0 ? 'text-blue-600' : 'text-red-600'
            }`}
          >
            Transitions Changed
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-green-700">
            {improvementPct.toFixed(1)}%
          </div>
          <div className="text-xs text-green-600">Improvement</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          Initial state
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-dashed border-orange-400 bg-orange-50 inline-block" />
          Dummy state
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
          Regular state
        </span>
      </div>

      {/* Canvas area */}
      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <ReactFlowProvider>
              <StaticCanvas
                fsm={originalFSM}
                label="Original FSM"
                badge={statsBadgeOriginal}
              />
            </ReactFlowProvider>
          </div>
          <div className="border border-green-200 rounded-lg overflow-hidden">
            <ReactFlowProvider>
              <StaticCanvas
                fsm={optimizedFSM}
                label="Optimized FSM"
                badge={statsBadgeOptimized}
              />
            </ReactFlowProvider>
          </div>
        </div>
      ) : (
        /* Overlay mode: show optimized FSM full-width with a note */
        <div className="flex-1 min-h-0 border border-green-200 rounded-lg overflow-hidden relative">
          <ReactFlowProvider>
            <StaticCanvas
              fsm={optimizedFSM}
              label="Optimized FSM (overlay mode — dummy states shown in orange)"
              badge={statsBadgeOptimized}
            />
          </ReactFlowProvider>
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-500 shadow-sm">
            Original: {originalFSM.state_count} states &rarr; Optimized: {optimizedFSM.state_count} states
          </div>
        </div>
      )}
    </div>
  );
}
