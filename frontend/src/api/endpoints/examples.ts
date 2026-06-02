import { apiClient, APIResponse, PaginatedResponse } from '../client';
import type { FSM } from '@/types/fsm';
import type { Category, Example } from '@/types/api';
import { normalizeExample, normalizeFSM } from '../normalize';

export const examplesAPI = {
  /**
   * List all examples
   *
   * Tolerates a bare-array body (no {success,data} envelope). The
   * backend's response_wrapper has been observed skipping the envelope
   * on some responses; without this check `res.data` was undefined and
   * the page silently fell back to the static-examples view, which has
   * no advanced entries — hence the "Complex tab empty" report despite
   * elevator_10floor.json sitting on disk with difficulty=advanced.
   */
  list: async (category?: string): Promise<PaginatedResponse<Example>> => {
    const res = (await apiClient.get('/examples', {
      params: { category },
    })) as unknown as PaginatedResponse<Example>;
    if (Array.isArray(res)) {
      return {
        success: true,
        data: (res as unknown as Example[]).map(normalizeExample),
      } as unknown as PaginatedResponse<Example>;
    }
    return { ...res, data: (res.data ?? []).map(normalizeExample) };
  },

  /**
   * Get specific example
   */
  get: async (id: string): Promise<APIResponse<Example>> => {
    const res = (await apiClient.get(`/examples/${id}`)) as unknown as APIResponse<Example>;
    const raw = res as unknown as Record<string, unknown>;
    if (raw && typeof raw === 'object' && 'id' in raw && !('data' in raw)) {
      return {
        success: true,
        data: normalizeExample(raw as Partial<Example>),
      } as unknown as APIResponse<Example>;
    }
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
    return apiClient.get('/categories');
  },
};
