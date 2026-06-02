/**
 * API normalization regression tests.
 *
 * The frontend has explicit tolerance for both envelope-wrapped
 * (``{success, data, ...}``) and bare-body responses on the FSM,
 * Examples, and Algorithm endpoints. The bug at 7f00cea was that the
 * previous fsmAPI.get spread the bare FSM and then OVERWROTE `.data`
 * with `normalizeFSM(undefined)` — producing a defaults blob with no
 * id, which the editor then could not load.
 *
 * These tests assert that both shapes produce a result where
 * `result.data.id === 'x'`, so a future refactor that drops the
 * bare-body tolerance fails here instead of in production.
 *
 * apiClient is mocked at the call boundary so the tests stay focused
 * on the normalization logic, not transport.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '../../api/client';
import { fsmAPI } from '../../api/endpoints/fsms';
import { examplesAPI } from '../../api/endpoints/examples';
import { algorithmAPI } from '../../api/endpoints/algorithms';

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

// ---------------------------------------------------------------------------
// fsmAPI.get — bare body vs envelope (pins fix 7f00cea / 12ce23e)
// ---------------------------------------------------------------------------

describe('fsmAPI.get bare-body tolerance', () => {
  it('wrapped envelope: returns data.id', async () => {
    get.mockResolvedValueOnce({
      success: true,
      data: { id: 'x', name: 'wrapped', fsm_type: 'moore' },
    });
    const res = await fsmAPI.get('x');
    expect(res.success).toBe(true);
    expect(res.data.id).toBe('x');
    expect(res.data.name).toBe('wrapped');
  });

  it('bare FSM body (no envelope): synthesises envelope, preserves id', async () => {
    // This is the exact shape the backend returned that caused the
    // "response was empty" diagnostic and the id-less defaults blob.
    get.mockResolvedValueOnce({
      id: 'x',
      name: 'bare',
      fsm_type: 'moore',
      states: ['a'],
    });
    const res = await fsmAPI.get('x');
    expect(res.success).toBe(true);
    expect(res.data.id).toBe('x');
    expect(res.data.name).toBe('bare');
  });
});

// ---------------------------------------------------------------------------
// examplesAPI.list — bare array vs envelope (pins fix 4700451)
// ---------------------------------------------------------------------------

describe('examplesAPI.list bare-array tolerance', () => {
  it('envelope-wrapped array: returns data list with normalized ids', async () => {
    get.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 'e1', name: 'Elevator', category: 'beginner' },
        { id: 'e2', name: 'Traffic', category: 'intermediate' },
      ],
    });
    const res = await examplesAPI.list();
    expect(res.success).toBe(true);
    expect(res.data.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('bare array body: synthesises envelope, preserves ids', async () => {
    get.mockResolvedValueOnce([
      { id: 'e1', name: 'Elevator', category: 'beginner' },
      { id: 'e2', name: 'Traffic', category: 'intermediate' },
    ]);
    const res = await examplesAPI.list();
    expect(res.success).toBe(true);
    expect(res.data.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

// ---------------------------------------------------------------------------
// algorithmAPI.optimize — bare OptimizationResponse vs envelope (4700451)
// ---------------------------------------------------------------------------

describe('algorithmAPI.optimize bare-body tolerance', () => {
  const fullOptimizationBody = {
    optimized_fsm_id: 'opt-1',
    algorithm: 'greedy',
    execution_time_ms: 5,
    dummy_states_added: 0,
    total_states: 3,
    improvement_percentage: 0,
    metrics: {
      avg_hamming_before: 1,
      avg_hamming_after: 1,
      max_hamming_before: 1,
      max_hamming_after: 1,
    },
    encoding_map: { A: '00', B: '01' },
  };

  it('envelope-wrapped: returns data.optimized_fsm_id', async () => {
    post.mockResolvedValueOnce({ success: true, data: fullOptimizationBody });
    const res = await algorithmAPI.optimize('any', {
      algorithm: 'greedy',
      options: {},
    });
    expect(res.success).toBe(true);
    expect(res.data.optimized_fsm_id).toBe('opt-1');
    expect(res.data.algorithm).toBe('greedy');
  });

  it('bare body (no envelope): synthesises envelope, preserves optimized_fsm_id', async () => {
    post.mockResolvedValueOnce(fullOptimizationBody);
    const res = await algorithmAPI.optimize('any', {
      algorithm: 'greedy',
      options: {},
    });
    expect(res.success).toBe(true);
    expect(res.data.optimized_fsm_id).toBe('opt-1');
    expect(res.data.algorithm).toBe('greedy');
  });
});
