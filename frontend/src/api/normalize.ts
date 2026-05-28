/**
 * API response normalization boundary.
 *
 * Stabilizes the optional/transport shape so components consume strict
 * domain types (FSM, Example, OptimizationResponse, AlgorithmResult)
 * without nullable-handling at every render site.
 *
 * Policy (deliberate):
 *  - Default safe, optional, display-only fields (arrays, metric numbers,
 *    optional metadata, encoding maps).
 *  - Pass identity / core-domain fields through (id, name, fsm_type,
 *    algorithm, optimized_fsm_id, ownership). Fabricating these would
 *    mask backend bugs.
 */

import type {
  AlgorithmResult,
  FSM,
  FSMDefinition,
  OptimizationMetrics,
  OptimizationResponse,
} from '@/types/fsm';
import type { Example } from '@/types/api';

export const DEFAULT_METRICS: OptimizationMetrics = {
  avg_hamming_before: 0,
  avg_hamming_after: 0,
  max_hamming_before: 0,
  max_hamming_after: 0,
};

/** Used internally so optional FSM fields land as stable empties. Both
 * `states` and `transitions` stay UNDEFINED here on purpose: callers
 * like loadFSMIntoDraft use `fsm.definition?.states || fsm.states` to
 * pick the right source, and a literal `[]` would mask the fall-through. */
const EMPTY_DEFINITION: FSMDefinition = {};

/** Defaults applied to optional FSM fields. */
export const DEFAULT_FSM_OPTIONALS = {
  tags: [] as string[],
  outputs: {} as Record<string, string>,
  encoding: {} as Record<string, string>,
} as const;

/**
 * Normalize an FSM payload from the API.
 * Required identity fields (id, name, fsm_type, initial_state, visibility,
 * state_count, transition_count) are passed through unchanged.
 */
export function normalizeFSM(raw: Partial<FSM> | null | undefined): FSM {
  const r = (raw ?? {}) as Partial<FSM>;
  return {
    ...(r as FSM),
    states: r.states ?? [],
    transitions: r.transitions ?? [],
    tags: r.tags ?? DEFAULT_FSM_OPTIONALS.tags,
    outputs: r.outputs ?? DEFAULT_FSM_OPTIONALS.outputs,
    encoding: r.encoding ?? DEFAULT_FSM_OPTIONALS.encoding,
    definition: r.definition ?? EMPTY_DEFINITION,
  };
}

/**
 * Normalize an Example payload.
 *
 * The backend returns examples with top-level `states`/`transitions`
 * rather than a `fsm_data` wrapper, so we surface the raw object under
 * fsm_data for components that read it that way, while still defaulting
 * the display fields (tags, category) and difficulty enum.
 */
export function normalizeExample(
  raw: Partial<Example> | null | undefined,
): Example {
  const r = (raw ?? {}) as Partial<Example> & Record<string, unknown>;
  return {
    id: r.id as string,
    name: (r.name as string) ?? '',
    description: (r.description as string) ?? '',
    category: (r.category as string) ?? '',
    difficulty: (r.difficulty as Example['difficulty']) ?? 'beginner',
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    fsm_data:
      (r.fsm_data as Record<string, unknown>) ??
      (r as Record<string, unknown>),
  };
}

/**
 * Normalize an OptimizationResponse. The nested `metrics` is merged on
 * top of DEFAULT_METRICS so any missing field renders 0 in charts.
 */
export function normalizeOptimizationResponse(
  raw: Partial<OptimizationResponse> | null | undefined,
): OptimizationResponse {
  const r = (raw ?? {}) as Partial<OptimizationResponse>;
  return {
    ...(r as OptimizationResponse),
    metrics: { ...DEFAULT_METRICS, ...(r.metrics ?? {}) },
    encoding_map: r.encoding_map ?? {},
  };
}

/**
 * Normalize an AlgorithmResult row (from /results listings). Numeric
 * display fields default to 0; `algorithm` is identity — passed through.
 */
export function normalizeAlgorithmResult(
  raw: Partial<AlgorithmResult> | null | undefined,
): AlgorithmResult {
  const r = (raw ?? {}) as Partial<AlgorithmResult>;
  return {
    ...(r as AlgorithmResult),
    avg_hamming_before: r.avg_hamming_before ?? 0,
    avg_hamming_after: r.avg_hamming_after ?? 0,
    improvement_percentage: r.improvement_percentage ?? 0,
    execution_time_ms: r.execution_time_ms ?? 0,
    dummy_states_added: r.dummy_states_added ?? 0,
    total_states_final: r.total_states_final ?? 0,
    encoding_map: r.encoding_map ?? {},
  };
}

/**
 * Single canonical transformation from the persistence-model
 * AlgorithmResult to the runtime-model OptimizationResponse. Used to
 * replay a stored lab report (most-recent or selected past run) without
 * re-running the algorithm. Lives at the normalization boundary so the
 * conversion isn't duplicated in component code.
 *
 * Fields backfilled with 0 / empty are display-only — they degrade
 * gracefully and only affect partially-snapshotted rows written before
 * migration e6a8c9d0b3f1 added max_hamming_* and encoding_map.
 */
export function normalizeAlgorithmResultToOptimizationResponse(
  result: AlgorithmResult,
): OptimizationResponse {
  return {
    optimized_fsm_id: result.optimized_fsm_id ?? '',
    algorithm: result.algorithm,
    execution_time_ms: result.execution_time_ms ?? 0,
    dummy_states_added: result.dummy_states_added ?? 0,
    total_states: result.total_states_final ?? 0,
    improvement_percentage: result.improvement_percentage ?? 0,
    metrics: {
      avg_hamming_before: result.avg_hamming_before ?? 0,
      avg_hamming_after: result.avg_hamming_after ?? 0,
      max_hamming_before: result.max_hamming_before ?? 0,
      max_hamming_after: result.max_hamming_after ?? 0,
    },
    encoding_map: result.encoding_map ?? {},
  };
}
