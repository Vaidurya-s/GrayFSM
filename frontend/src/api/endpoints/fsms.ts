import { apiClient, APIResponse, PaginatedResponse } from '../client';
import type { FSM, FSMCreate, FSMUpdate } from '@/types/fsm';
import type { FSMListParams } from '@/types/api';
import { normalizeFSM } from '../normalize';

/** Apply normalizeFSM to the `data` payload of an APIResponse/Paginated wrap.
 *
 * Tolerant of two shapes because the backend's response_wrapper middleware
 * has been observed skipping the envelope on some responses (notably the
 * GET /fsms/{id} for freshly-created optimized FSMs). When the body comes
 * back as a bare FSM (`{id, name, ...}`) instead of `{success, data: FSM}`,
 * the previous code spread the FSM and then overlaid `data: normalize(undefined)`
 * — producing an object whose `.data` was an id-less defaults blob and
 * triggering the "response was empty" diagnostic.
 *
 * Now: if the body already looks like a bare FSM (has `id` but no `data`),
 * synthesize the envelope so downstream `res.data` reads work uniformly.
 */
function normalizeFSMResponse<R extends { data: FSM }>(res: R): R {
  const raw = res as unknown as Record<string, unknown>;
  if (raw && typeof raw === 'object' && 'id' in raw && !('data' in raw)) {
    return { success: true, data: normalizeFSM(raw as Partial<FSM>) } as unknown as R;
  }
  return { ...res, data: normalizeFSM(res.data) };
}
function normalizeFSMListResponse<R extends { data: FSM[] }>(res: R): R {
  const raw = res as unknown as Record<string, unknown>;
  if (Array.isArray(raw)) {
    return { success: true, data: (raw as unknown as FSM[]).map(normalizeFSM) } as unknown as R;
  }
  return { ...res, data: (res.data ?? []).map(normalizeFSM) };
}

export const fsmAPI = {
  /**
   * List FSMs with pagination and filtering
   */
  list: async (params?: FSMListParams): Promise<PaginatedResponse<FSM>> => {
    const res = (await apiClient.get('/fsms', { params })) as unknown as PaginatedResponse<FSM>;
    return normalizeFSMListResponse(res);
  },

  /**
   * Get single FSM by ID
   */
  get: async (id: string): Promise<APIResponse<FSM>> => {
    const res = (await apiClient.get(`/fsms/${id}`)) as unknown as APIResponse<FSM>;
    return normalizeFSMResponse(res);
  },

  /**
   * Create new FSM
   */
  create: async (data: FSMCreate): Promise<APIResponse<FSM>> => {
    const res = (await apiClient.post('/fsms', data)) as unknown as APIResponse<FSM>;
    return normalizeFSMResponse(res);
  },

  /**
   * Update existing FSM
   */
  update: async (id: string, data: FSMUpdate): Promise<APIResponse<FSM>> => {
    const res = (await apiClient.put(`/fsms/${id}`, data)) as unknown as APIResponse<FSM>;
    return normalizeFSMResponse(res);
  },

  /**
   * Delete FSM
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/fsms/${id}`);
  },

  /**
   * Fork (duplicate) FSM
   */
  fork: async (id: string, name?: string): Promise<APIResponse<FSM>> => {
    const res = (await apiClient.post(`/fsms/${id}/fork`, { name })) as unknown as APIResponse<FSM>;
    return normalizeFSMResponse(res);
  },

  /**
   * Increment view count
   */
  incrementViews: async (id: string): Promise<void> => {
    return apiClient.post(`/fsms/${id}/view`);
  },
};
