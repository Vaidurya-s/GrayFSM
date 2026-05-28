import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  MarkerType,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import StateNode from './StateNode';
import TransitionEdge from './TransitionEdge';
import { useFSMStore } from '../../store/fsmStore';
import type { State, Transition } from '../../types/fsm';

const nodeTypes = { stateNode: StateNode };
const edgeTypes = { transitionEdge: TransitionEdge };

function statesToNodes(
  states: State[],
  initialState: string,
  fsmType: 'moore' | 'mealy',
  encoding: Record<string, string>,
): Node[] {
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
      fsmType,
      // Encoding subtitle ("011") rendered below the state label inside
      // the StateNode. Look up by state name; fall back to id; else undef
      // (StateNode then falls back to Moore output as the subtitle).
      encoding: encoding[s.name] ?? encoding[s.id],
    },
  }));
}

function transitionsToEdges(transitions: Transition[], fsmType: 'moore' | 'mealy'): Edge[] {
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
      fsmType,
    },
  }));
}

interface FSMCanvasProps {
  readOnly?: boolean;
}

export default function FSMCanvas({ readOnly = false }: FSMCanvasProps) {
  const {
    draftStates,
    draftTransitions,
    draftInitialState,
    draftFsmType,
    draftEncoding,
    setSelectedNode,
    setSelectedEdge,
    updateState,
    addTransition,
  } = useFSMStore();

  const initialNodes = useMemo(
    () => statesToNodes(draftStates, draftInitialState, draftFsmType, draftEncoding),
    [draftStates, draftInitialState, draftFsmType, draftEncoding]
  );
  const initialEdges = useMemo(
    () => transitionsToEdges(draftTransitions, draftFsmType),
    [draftTransitions, draftFsmType]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-sync when the store changes (useNodesState only reads initial value once)
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      onNodesChange(changes);
      // Sync position changes back to store
      changes.forEach((change) => {
        if (change.type === 'position' && change.position && change.id) {
          updateState(change.id, { position: change.position });
        }
      });
    },
    [readOnly, onNodesChange, updateState]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      onEdgesChange(changes);
    },
    [readOnly, onEdgesChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      if (connection.source && connection.target) {
        addTransition({
          from_state: connection.source,
          to_state: connection.target,
          input: '',
          output: '',
        });
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              type: 'transitionEdge',
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              data: { input: '', output: '', fsmType: draftFsmType },
            },
            eds
          )
        );
      }
    },
    [readOnly, addTransition, setEdges, draftFsmType]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge.id);
    },
    [setSelectedEdge]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [setSelectedNode, setSelectedEdge]);

  return (
    <div className="w-full h-full" data-testid="fsm-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        // Touch ergonomics — boolean `panOnDrag` is required for proper
        // single-touch panning (the array form is mouse-button-specific
        // and breaks touch).
        panOnDrag={true}
        panOnScroll={false}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        zoomOnScroll={true}
        selectionOnDrag={false}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="top-right" />
        {/* MiniMap kept mounted (CSS-hidden on narrow viewports) so React
            Flow's internal state stays stable across resizes. */}
        <div className="hidden md:block">
          <MiniMap
            nodeColor={(node) => {
              if (node.data?.isInitial) return '#0072B2';
              if (node.data?.isDummy) return '#E69F00';
              return '#e5e7eb';
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
        </div>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
