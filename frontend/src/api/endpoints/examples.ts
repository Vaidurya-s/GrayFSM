import { apiClient, APIResponse, PaginatedResponse } from '../client';
import type { FSM } from '@/types/fsm';
import type { Category, Example } from '@/types/api';
import { normalizeExample, normalizeFSM } from '../normalize';

export const examplesAPI = {
  /**
   * List all examples
   */
  list: async (category?: string): Promise<PaginatedResponse<Example>> => {
    const res = (await apiClient.get('/examples', {
      params: { category },
    })) as unknown as PaginatedResponse<Example>;
    return { ...res, data: (res.data ?? []).map(normalizeExample) };
  },

  /**
   * Get specific example
   */
  get: async (id: string): Promise<APIResponse<Example>> => {
    const res = (await apiClient.get(`/examples/${id}`)) as unknown as APIResponse<Example>;
    return { ...res, data: normalizeExample(res.data) };
  },

  /**
   * Get example as FSM
   */
  getFSM: async (id: string): Promise<APIResponse<FSM>> => {
    const res = (await apiClient.get(`/examples/${id}/fsm`)) as unknown as APIResponse<FSM>;
    return { ...res, data: normalizeFSM(res.data) };
  },

  /**
   * List categories
   */
  getCategories: async (): Promise<APIResponse<Category[]>> => {
    return apiClient.get('/examples/categories');
  },
};
