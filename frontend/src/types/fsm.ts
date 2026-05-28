// FSM Type Definitions

export type FSMType = 'moore' | 'mealy';
export type Visibility = 'private' | 'public' | 'unlisted';

export interface State {
  id: string;
  name: string;
  output?: string;
  position?: { x: number; y: number };
  is_dummy?: boolean;
}

export interface Transition {
  id?: string;
  from_state: string;
  to_state: string;
  input?: string;
  output?: string;
  label?: string;
}

export interface FSMDefinition {
  states?: State[];
  transitions?: Transition[];
  outputs?: Record<string, string>;
}

export interface FSM {
  id: string;
  name: string;
  description?: string;
  fsm_type: FSMType;
  states: string[];
  initial_state: string;
  transitions: Transition[];
  outputs?: Record<string, string>;
  encoding?: Record<string, string>;
  definition: FSMDefinition;
  state_count: number;
  transition_count: number;
  bit_width?: number;
  tags?: string[];
  visibility: Visibility;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  view_count?: number;
  fork_count?: number;
  is_optimized?: boolean;
  dummy_state_count?: number;
  optimization_algorithm?: string;
  avg_hamming_distance?: number;
  encoding_type?: string;
}

export interface FSMCreate {
  name: string;
  description?: string;
  fsm_type: FSMType;
  states: string[];
  initial_state: string;
  transitions: Transition[];
  outputs?: Record<string, string>;
  tags?: string[];
  visibility?: Visibility;
}

export interface FSMUpdate extends Partial<FSMCreate> {
  id?: string;
}

export interface DummyState {
  id: string;
  encoding: string;
  output?: string;
  is_dummy: boolean;
  inserted_for: string;
}

export interface OptimizedFSM extends FSM {
  dummy_states: DummyState[];
  algorithm_used: string;
  // Per-algorithm metrics. Common keys: avg_hamming_before/_after,
  // max_hamming, improvement_percentage. Kept loose because each
  // algorithm contributes its own keys.
  metrics: Record<string, number | string | boolean>;
  optimization_time_ms: number;
}

export interface AlgorithmResult {
  id?: string;
  // Set when the algorithm produced a derived FSM (greedy/BFS may add
  // dummy states; SA/GA produce a re-encoded FSM). Lets the lab report
  // re-fetch the optimized FSM after revisiting the page.
  optimized_fsm_id?: string | null;
  algorithm: string;
  dummy_states_added: number;
  total_states_final: number;
  avg_hamming_before: number;
  avg_hamming_after: number;
  improvement_percentage: number;
  execution_time_ms: number;
  encoding_map: Record<string, string>;
  executed_at?: string;
}

export interface OptimizationRequest {
  algorithm: 'greedy' | 'bfs_optimal' | 'global_sa' | 'global_ga';
  options?: {
    timeout_ms?: number;
    iterations?: number;
    temperature?: number;
    cooling_rate?: number;
  };
  async_mode?: boolean;
}

export interface OptimizationMetrics {
  avg_hamming_before: number;
  avg_hamming_after: number;
  max_hamming_before: number;
  max_hamming_after: number;
}

export interface OptimizationResponse {
  optimized_fsm_id: string;
  algorithm: string;
  execution_time_ms: number;
  dummy_states_added: number;
  total_states: number;
  improvement_percentage: number;
  metrics: OptimizationMetrics;
  encoding_map?: Record<string, string>;
}

export interface ExportFormat {
  format: 'verilog' | 'vhdl' | 'json' | 'csv' | 'testbench';
  options?: {
    module_name?: string;
    include_comments?: boolean;
    style?: 'standard' | 'compact' | 'verbose';
  };
}

export interface ExportRequest extends ExportFormat {}

export interface ExportResponse {
  format: string;
  content: string;
  file_name: string;
}
