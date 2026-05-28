import { apiClient, APIResponse, PaginatedResponse } from '../client';
import type { FSM, FSMCreate, FSMUpdate } from '@/types/fsm';
import type { FSMListParams } from '@/types/api';
import { normalizeFSM } from '../normalize';

/** Apply normalizeFSM to the `data` payload of an APIResponse/Paginated wrap. */
function normalizeFSMResponse<R extends { data: FSM }>(res: R): R {
  return { ...res, data: normalizeFSM(res.data) };
}
function normalizeFSMListResponse<R extends { data: FSM[] }>(res: R): R {
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
