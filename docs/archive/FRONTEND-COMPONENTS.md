# GrayFSM Frontend - Component Library Specification

## Overview

This document provides detailed specifications for all major components in the GrayFSM frontend application, including props, state, behavior, and accessibility considerations.

---

## Table of Contents

1. [Form Components](#form-components)
2. [Visualization Components](#visualization-components)
3. [Layout Components](#layout-components)
4. [FSM-Specific Components](#fsm-specific-components)
5. [Page Components](#page-components)

---

## Form Components

### FSMCreateForm

**Purpose**: Create a new FSM from scratch

**Location**: `src/components/forms/FSMCreateForm/FSMCreateForm.tsx`

```typescript
interface FSMCreateFormProps {
  onSuccess?: (fsm: FSM) => void;
  onCancel?: () => void;
  initialData?: Partial<FSMCreateInput>;
}

export function FSMCreateForm({ onSuccess, onCancel, initialData }: FSMCreateFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FSMCreateInput>({
    resolver: zodResolver(fsmCreateSchema),
    defaultValues: initialData
  });

  const createMutation = useCreateFSM();

  const onSubmit = async (data: FSMCreateInput) => {
    try {
      const result = await createMutation.mutateAsync(data);
      onSuccess?.(result.data);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Input
        label="FSM Name"
        placeholder="Traffic Light Controller"
        {...register('name')}
        error={errors.name?.message}
        required
      />

      <Input
        label="Description"
        as="textarea"
        rows={3}
        placeholder="Describe your FSM..."
        {...register('description')}
        error={errors.description?.message}
      />

      <Select
        label="FSM Type"
        {...register('fsm_type')}
        error={errors.fsm_type?.message}
        required
      >
        <option value="moore">Moore Machine</option>
        <option value="mealy">Mealy Machine</option>
      </Select>

      <Select
        label="Visibility"
        {...register('visibility')}
        error={errors.visibility?.message}
      >
        <option value="private">Private</option>
        <option value="public">Public</option>
        <option value="unlisted">Unlisted</option>
      </Select>

      <TagInput
        label="Tags"
        {...register('tags')}
        error={errors.tags?.message}
      />

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          Create FSM
        </Button>
      </div>
    </form>
  );
}
```

**Features**:
- Form validation with Zod
- Auto-save to localStorage (optional)
- Keyboard shortcuts (Ctrl+Enter to submit)
- Accessible form labels and error messages

**Storybook Stories**:
```typescript
// FSMCreateForm.stories.tsx
export default {
  title: 'Forms/FSMCreateForm',
  component: FSMCreateForm
} as Meta;

export const Default: Story = {};

export const WithInitialData: Story = {
  args: {
    initialData: {
      name: 'My FSM',
      fsm_type: 'moore',
      visibility: 'private'
    }
  }
};

export const WithError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByRole('button', { name: /create/i });
    await userEvent.click(submitButton);
    // Validation errors should appear
  }
};
```

---

### ImportForm

**Purpose**: Import FSM from JSON or CSV

**Location**: `src/components/forms/ImportForm/ImportForm.tsx`

```typescript
interface ImportFormProps {
  onSuccess: (fsm: FSM) => void;
  onCancel?: () => void;
}

type ImportFormat = 'json' | 'csv';

export function ImportForm({ onSuccess, onCancel }: ImportFormProps) {
  const [format, setFormat] = useState<ImportFormat>('json');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FSM | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    try {
      const text = await selectedFile.text();
      let parsed: any;

      if (format === 'json') {
        parsed = JSON.parse(text);
      } else {
        parsed = parseCSV(text);
      }

      // Validate parsed FSM
      const validated = fsmCreateSchema.parse(parsed);
      setPreview(validated as any);
    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
      setPreview(null);
    }
  };

  const handleImport = () => {
    if (preview) {
      onSuccess(preview);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <button
          onClick={() => setFormat('json')}
          className={cn(
            'flex-1 rounded-lg border-2 p-4 text-center transition',
            format === 'json'
              ? 'border-primary-600 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <div className="text-lg font-medium">JSON</div>
          <div className="text-sm text-gray-500">Import from JSON file</div>
        </button>

        <button
          onClick={() => setFormat('csv')}
          className={cn(
            'flex-1 rounded-lg border-2 p-4 text-center transition',
            format === 'csv'
              ? 'border-primary-600 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <div className="text-lg font-medium">CSV</div>
          <div className="text-sm text-gray-500">Import from CSV file</div>
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select File
        </label>
        <input
          type="file"
          accept={format === 'json' ? '.json' : '.csv'}
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-primary-50 file:text-primary-700
            hover:file:bg-primary-100"
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>Import Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {preview && (
        <Card className="p-4">
          <h3 className="font-medium mb-2">Preview</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="font-medium">Name:</dt>
            <dd>{preview.name}</dd>
            <dt className="font-medium">Type:</dt>
            <dd>{preview.fsm_type}</dd>
            <dt className="font-medium">States:</dt>
            <dd>{preview.states.length}</dd>
            <dt className="font-medium">Transitions:</dt>
            <dd>{preview.transitions.length}</dd>
          </dl>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleImport} disabled={!preview}>
          Import
        </Button>
      </div>
    </div>
  );
}

function parseCSV(text: string): Partial<FSMCreateInput> {
  // CSV parsing logic
  // Expected format:
  // State,Output,Transitions (from:to:input:output)
  // S0,00,S0:S1:0,S0:S2:1
  // S1,01,S1:S3:0

  const lines = text.split('\n');
  const headers = lines[0].split(',');

  const states: string[] = [];
  const outputs: Record<string, string> = {};
  const transitions: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [stateName, output, ...transitionStrings] = line.split(',');

    states.push(stateName);
    outputs[stateName] = output;

    transitionStrings.forEach(transStr => {
      const [from, to, input, transOutput] = transStr.split(':');
      transitions.push({
        from_state: from,
        to_state: to,
        input: input || undefined,
        output: transOutput || undefined
      });
    });
  }

  return {
    states,
    outputs,
    transitions,
    initial_state: states[0]
  };
}
```

---

### ExportForm

**Purpose**: Export FSM to various formats

**Location**: `src/components/forms/ExportForm/ExportForm.tsx`

```typescript
interface ExportFormProps {
  fsmId: string;
  onClose?: () => void;
}

export function ExportForm({ fsmId, onClose }: ExportFormProps) {
  const [format, setFormat] = useState<ExportFormat>('verilog');
  const [options, setOptions] = useState({
    module_name: 'fsm_module',
    include_comments: true,
    style: 'standard' as const
  });

  const exportMutation = useMutation({
    mutationFn: () => exportAPI.export(fsmId, { format, options }),
    onSuccess: (response) => {
      // Download file
      const blob = new Blob([response.data.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fsm.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      onClose?.();
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Export Format
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['verilog', 'vhdl', 'json', 'csv', 'testbench'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              className={cn(
                'rounded-lg border-2 p-3 text-center transition',
                format === fmt
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="font-medium capitalize">{fmt}</div>
              <div className="text-xs text-gray-500">
                {getFormatDescription(fmt)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {(format === 'verilog' || format === 'vhdl') && (
        <div className="space-y-4">
          <Input
            label="Module Name"
            value={options.module_name}
            onChange={(e) => setOptions({ ...options, module_name: e.target.value })}
          />

          <Checkbox
            label="Include Comments"
            checked={options.include_comments}
            onChange={(e) => setOptions({ ...options, include_comments: e.target.checked })}
          />

          <Select
            label="Code Style"
            value={options.style}
            onChange={(e) => setOptions({ ...options, style: e.target.value as any })}
          >
            <option value="standard">Standard</option>
            <option value="compact">Compact</option>
            <option value="verbose">Verbose</option>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button
          onClick={() => exportMutation.mutate()}
          isLoading={exportMutation.isLoading}
        >
          Export
        </Button>
      </div>
    </div>
  );
}

function getFormatDescription(format: string): string {
  const descriptions = {
    verilog: 'Synthesizable Verilog',
    vhdl: 'VHDL code',
    json: 'JSON definition',
    csv: 'State table CSV',
    testbench: 'Testbench code'
  };
  return descriptions[format as keyof typeof descriptions] || '';
}
```

---

## Visualization Components

### FSMGraphViewer

**Purpose**: Display FSM as an interactive graph

**Location**: `src/components/visualization/FSMGraphViewer/FSMGraphViewer.tsx`

```typescript
interface FSMGraphViewerProps {
  fsm: FSM;
  highlightedStates?: string[];
  highlightedTransitions?: string[];
  onStateClick?: (stateId: string) => void;
  onTransitionClick?: (transitionId: string) => void;
  readOnly?: boolean;
}

export function FSMGraphViewer({
  fsm,
  highlightedStates = [],
  highlightedTransitions = [],
  onStateClick,
  onTransitionClick,
  readOnly = true
}: FSMGraphViewerProps) {
  const { nodes, edges } = useMemo(() => {
    return transformFSMToFlow(fsm);
  }, [fsm]);

  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  }, [reactFlowInstance, fsm]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            isHighlighted: highlightedStates.includes(node.id)
          }
        }))}
        edges={edges.map(edge => ({
          ...edge,
          data: {
            ...edge.data,
            isHighlighted: highlightedTransitions.includes(edge.id)
          }
        }))}
        onInit={setReactFlowInstance}
        onNodeClick={(_, node) => onStateClick?.(node.id)}
        onEdgeClick={(_, edge) => onTransitionClick?.(edge.id)}
        nodeTypes={{ fsmState: FSMNode }}
        edgeTypes={{ fsmTransition: FSMEdge }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        fitView
      >
        <Background />
        <Controls showInteractive={!readOnly} />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

function transformFSMToFlow(fsm: FSM): { nodes: Node[]; edges: Edge[] } {
  const definition = fsm.definition;

  const nodes: Node[] = (definition.states || []).map((state: any, index: number) => ({
    id: state.id || state.name,
    type: 'fsmState',
    position: state.position || getAutoPosition(index, definition.states.length),
    data: {
      label: state.name,
      output: state.output,
      isInitial: state.id === fsm.initial_state || state.name === fsm.initial_state,
      isDummy: state.is_dummy || false
    }
  }));

  const edges: Edge[] = (definition.transitions || []).map((transition: any) => ({
    id: transition.id || `${transition.from_state}-${transition.to_state}`,
    source: transition.from_state,
    target: transition.to_state,
    type: 'fsmTransition',
    label: transition.input || transition.label || '',
    data: {
      input: transition.input,
      output: transition.output
    }
  }));

  return { nodes, edges };
}

function getAutoPosition(index: number, total: number): { x: number; y: number } {
  // Circular layout
  const radius = 300;
  const angle = (2 * Math.PI * index) / total;
  return {
    x: 400 + radius * Math.cos(angle),
    y: 300 + radius * Math.sin(angle)
  };
}
```

---

### ComparisonView

**Purpose**: Side-by-side comparison of original and optimized FSMs

**Location**: `src/components/visualization/ComparisonView/ComparisonView.tsx`

```typescript
interface ComparisonViewProps {
  originalFSM: FSM;
  optimizedFSM: FSM;
  showDiff?: boolean;
}

export function ComparisonView({
  originalFSM,
  optimizedFSM,
  showDiff = true
}: ComparisonViewProps) {
  const [syncView, setSyncView] = useState(true);
  const [highlightChanges, setHighlightChanges] = useState(true);

  const { addedStates, modifiedTransitions } = useMemo(() => {
    return computeDiff(originalFSM, optimizedFSM);
  }, [originalFSM, optimizedFSM]);

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
        <div className="flex gap-4">
          <Checkbox
            label="Sync Views"
            checked={syncView}
            onChange={(e) => setSyncView(e.target.checked)}
          />
          <Checkbox
            label="Highlight Changes"
            checked={highlightChanges}
            onChange={(e) => setHighlightChanges(e.target.checked)}
          />
        </div>

        <div className="flex gap-2">
          <Badge variant="info">
            {addedStates.length} states added
          </Badge>
          <Badge variant="warning">
            {modifiedTransitions.length} transitions modified
          </Badge>
        </div>
      </div>

      {/* Comparison Panels */}
      <div className="flex flex-1 divide-x">
        {/* Original FSM */}
        <div className="flex flex-1 flex-col">
          <div className="border-b bg-gray-100 px-4 py-2 text-sm font-medium">
            Original FSM
          </div>
          <div className="flex-1">
            <FSMGraphViewer
              fsm={originalFSM}
              highlightedTransitions={
                highlightChanges ? modifiedTransitions.map(t => t.id) : []
              }
              readOnly
            />
          </div>
          <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-600">
            {originalFSM.state_count} states, {originalFSM.transition_count} transitions
          </div>
        </div>

        {/* Optimized FSM */}
        <div className="flex flex-1 flex-col">
          <div className="border-b bg-green-100 px-4 py-2 text-sm font-medium">
            Optimized FSM
          </div>
          <div className="flex-1">
            <FSMGraphViewer
              fsm={optimizedFSM}
              highlightedStates={highlightChanges ? addedStates.map(s => s.id) : []}
              readOnly
            />
          </div>
          <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-600">
            {optimizedFSM.state_count} states (+{addedStates.length}),{' '}
            {optimizedFSM.transition_count} transitions
          </div>
        </div>
      </div>

      {/* Diff Legend */}
      {showDiff && (
        <div className="flex gap-4 border-t bg-gray-50 px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span>Added dummy states</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span>Modified transitions</span>
          </div>
        </div>
      )}
    </div>
  );
}

function computeDiff(original: FSM, optimized: FSM) {
  const originalStates = new Set(original.definition.states?.map((s: any) => s.id) || []);
  const addedStates = (optimized.definition.states || []).filter(
    (s: any) => !originalStates.has(s.id)
  );

  const modifiedTransitions = (optimized.definition.transitions || []).filter(
    (t: any) => {
      // Transition is modified if it didn't exist in original
      const exists = original.definition.transitions?.some(
        (ot: any) => ot.from_state === t.from_state && ot.to_state === t.to_state
      );
      return !exists;
    }
  );

  return { addedStates, modifiedTransitions };
}
```

---

### HypercubeView2D

**Purpose**: 2D visualization of hypercube with FSM states

**Location**: `src/components/visualization/HypercubeView2D/HypercubeView2D.tsx`

```typescript
interface HypercubeView2DProps {
  bitWidth: number;
  states: Array<{
    id: string;
    name: string;
    encoding: string;
    isDummy?: boolean;
  }>;
  transitions?: Array<{
    from: string;
    to: string;
  }>;
  highlightPath?: string[];
}

export function HypercubeView2D({
  bitWidth,
  states,
  transitions = [],
  highlightPath = []
}: HypercubeView2DProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  const { vertices, edges } = useMemo(() => {
    return generateHypercubeLayout(bitWidth);
  }, [bitWidth]);

  const statePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    states.forEach(state => {
      const vertex = vertices.find(v => v.code === state.encoding);
      if (vertex) {
        positions.set(state.id, { x: vertex.x, y: vertex.y });
      }
    });
    return positions;
  }, [states, vertices]);

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        className="h-full w-full"
        viewBox="0 0 800 600"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Hypercube edges */}
        <g>
          {edges.map((edge, i) => (
            <line
              key={i}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
          ))}
        </g>

        {/* Transition paths */}
        <g>
          {transitions.map((trans, i) => {
            const from = statePositions.get(trans.from);
            const to = statePositions.get(trans.to);
            if (!from || !to) return null;

            return (
              <line
                key={i}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
        </g>

        {/* Highlight path */}
        {highlightPath.length > 1 && (
          <polyline
            points={highlightPath.map(code => {
              const vertex = vertices.find(v => v.code === code);
              return vertex ? `${vertex.x},${vertex.y}` : '';
            }).join(' ')}
            fill="none"
            stroke="#ef4444"
            strokeWidth={3}
            markerEnd="url(#arrowhead-red)"
          />
        )}

        {/* Vertices */}
        <g>
          {vertices.map((vertex, i) => {
            const state = states.find(s => s.encoding === vertex.code);
            const isHighlighted = highlightPath.includes(vertex.code);

            return (
              <g key={i}>
                <circle
                  cx={vertex.x}
                  cy={vertex.y}
                  r={state ? 12 : 6}
                  fill={
                    isHighlighted
                      ? '#ef4444'
                      : state?.isDummy
                      ? '#94a3b8'
                      : state
                      ? '#3b82f6'
                      : '#f3f4f6'
                  }
                  stroke={state ? '#1f2937' : '#9ca3af'}
                  strokeWidth={state ? 2 : 1}
                  onMouseEnter={(e) => {
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      content: state
                        ? `${state.name} (${vertex.code})`
                        : vertex.code
                    });
                  }}
                />
                <text
                  x={vertex.x}
                  y={vertex.y - 20}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#374151"
                >
                  {vertex.code}
                </text>
                {state && (
                  <text
                    x={vertex.x}
                    y={vertex.y + 25}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="#1f2937"
                  >
                    {state.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Arrow markers */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
          </marker>
          <marker
            id="arrowhead-red"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
          </marker>
        </defs>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

function generateHypercubeLayout(bitWidth: number) {
  const vertices: Array<{ code: string; x: number; y: number }> = [];
  const edges: Array<{ from: typeof vertices[0]; to: typeof vertices[0] }> = [];

  const count = Math.pow(2, bitWidth);
  const centerX = 400;
  const centerY = 300;

  // Layout strategies based on bit width
  if (bitWidth === 2) {
    // Square layout
    const size = 200;
    for (let i = 0; i < 4; i++) {
      const code = intToGray(i, 2);
      vertices.push({
        code,
        x: centerX + (i % 2 ? size : -size),
        y: centerY + (i >= 2 ? size : -size)
      });
    }
  } else if (bitWidth === 3) {
    // Cube layout (2D projection)
    const size = 150;
    for (let i = 0; i < 8; i++) {
      const code = intToGray(i, 3);
      const x = (i % 2) * 2 - 1;
      const y = ((i >> 1) % 2) * 2 - 1;
      const z = ((i >> 2) % 2) * 2 - 1;
      vertices.push({
        code,
        x: centerX + size * (x + z * 0.5),
        y: centerY + size * (y - z * 0.5)
      });
    }
  } else {
    // Circular layout for 4+ bits
    const radius = 250;
    for (let i = 0; i < count; i++) {
      const code = intToGray(i, bitWidth);
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      vertices.push({
        code,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    }
  }

  // Generate edges (connect vertices with Hamming distance 1)
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const xor = i ^ j;
      if ((xor & (xor - 1)) === 0) {
        // Hamming distance = 1
        edges.push({
          from: vertices[i],
          to: vertices[j]
        });
      }
    }
  }

  return { vertices, edges };
}

function intToGray(n: number, bitWidth: number): string {
  const gray = n ^ (n >> 1);
  return gray.toString(2).padStart(bitWidth, '0');
}
```

---

## Page Components

### OptimizePage

**Purpose**: Main optimization interface

**Location**: `src/pages/Optimize/OptimizePage.tsx`

```typescript
export function OptimizePage() {
  const { id } = useParams<{ id: string }>();
  const { data: fsm, isLoading } = useFSM(id!);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('greedy');
  const [optimizationOptions, setOptimizationOptions] = useState({});
  const [result, setResult] = useState<OptimizationResponse | null>(null);

  const optimizeMutation = useOptimizeFSM();

  const handleOptimize = async () => {
    if (!id) return;

    const response = await optimizeMutation.mutateAsync({
      fsmId: id,
      request: {
        algorithm: selectedAlgorithm,
        options: optimizationOptions
      }
    });

    setResult(response.data);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!fsm) {
    return <NotFoundScreen />;
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold">Optimize: {fsm.data.name}</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Configuration */}
        <aside className="w-80 border-r bg-gray-50 overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Algorithm</h2>
              <AlgorithmSelector
                value={selectedAlgorithm}
                onChange={setSelectedAlgorithm}
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Options</h2>
              <AlgorithmOptions
                algorithm={selectedAlgorithm}
                value={optimizationOptions}
                onChange={setOptimizationOptions}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleOptimize}
              isLoading={optimizeMutation.isLoading}
              size="lg"
            >
              Optimize
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          <Tabs defaultValue="comparison" className="h-full flex flex-col">
            <TabsList className="border-b px-6">
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
              <TabsTrigger value="hypercube">Hypercube</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="animation">Animation</TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="flex-1">
              {result ? (
                <ComparisonView
                  originalFSM={fsm.data}
                  optimizedFSM={result.optimized_fsm}
                />
              ) : (
                <EmptyState
                  icon={<BeakerIcon className="h-12 w-12" />}
                  title="Ready to Optimize"
                  description="Configure options and click Optimize to get started"
                />
              )}
            </TabsContent>

            <TabsContent value="hypercube" className="flex-1">
              {result ? (
                <HypercubeView3D
                  bitWidth={result.optimized_fsm.bit_width}
                  highlightedCodes={extractEncodings(result.optimized_fsm)}
                />
              ) : (
                <EmptyState
                  icon={<CubeIcon className="h-12 w-12" />}
                  title="No Results Yet"
                  description="Run optimization to visualize the hypercube"
                />
              )}
            </TabsContent>

            <TabsContent value="metrics" className="flex-1 overflow-auto">
              {result ? (
                <div className="p-6">
                  <MetricsDashboard
                    originalFSM={fsm.data}
                    optimizedFSM={result.optimized_fsm}
                    results={result.algorithm_result}
                  />
                </div>
              ) : (
                <EmptyState
                  icon={<ChartBarIcon className="h-12 w-12" />}
                  title="No Metrics Available"
                  description="Run optimization to view performance metrics"
                />
              )}
            </TabsContent>

            <TabsContent value="animation" className="flex-1">
              {result ? (
                <TransformationAnimation
                  originalFSM={fsm.data}
                  optimizedFSM={result.optimized_fsm}
                  steps={result.optimization_steps}
                />
              ) : (
                <EmptyState
                  icon={<FilmIcon className="h-12 w-12" />}
                  title="No Animation Available"
                  description="Run optimization to view the transformation animation"
                />
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
```

---

## Testing Specifications

### Unit Tests Example

```typescript
// src/components/ui/Button/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button isLoading>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies variant styles', () => {
    const { rerender } = render(<Button variant="primary">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary-600');

    rerender(<Button variant="secondary">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-gray-100');
  });

  it('is accessible', () => {
    render(<Button aria-label="Close dialog">×</Button>);
    expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
  });
});
```

### Integration Tests Example

```typescript
// src/pages/Editor/EditorPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorPage } from './EditorPage';
import { TestWrapper } from '@/tests/utils/TestWrapper';

describe('EditorPage', () => {
  it('allows creating a new FSM', async () => {
    render(
      <TestWrapper>
        <EditorPage />
      </TestWrapper>
    );

    // Add a state
    await userEvent.click(screen.getByRole('button', { name: /add state/i }));
    await userEvent.click(screen.getByTestId('canvas'));

    // State should appear
    await waitFor(() => {
      expect(screen.getByText('S0')).toBeInTheDocument();
    });
  });

  it('supports undo/redo', async () => {
    render(
      <TestWrapper>
        <EditorPage />
      </TestWrapper>
    );

    // Perform action
    await userEvent.click(screen.getByRole('button', { name: /add state/i }));
    await userEvent.click(screen.getByTestId('canvas'));

    // Undo
    await userEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(screen.queryByText('S0')).not.toBeInTheDocument();

    // Redo
    await userEvent.click(screen.getByRole('button', { name: /redo/i }));
    expect(screen.getByText('S0')).toBeInTheDocument();
  });
});
```

---

This document provides comprehensive component specifications. Each component includes props, implementation details, accessibility considerations, and testing strategies.
