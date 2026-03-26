import { apiClient, APIResponse, PaginatedResponse } from '../client';
import type { FSM } from '@/types/fsm';
import type { Category, Example } from '@/types/api';

export const examplesAPI = {
  /**
   * List all examples
   */
  list: async (category?: string): Promise<PaginatedResponse<Example>> => {
    return apiClient.get('/examples', {
      params: { category },
    });
  },

  /**
   * Get specific example
   */
  get: async (id: string): Promise<APIResponse<Example>> => {
    return apiClient.get(`/examples/${id}`);
  },

  /**
   * Get example as FSM
   */
  getFSM: async (id: string): Promise<APIResponse<FSM>> => {
    return apiClient.get(`/examples/${id}/fsm`);
  },

  /**
   * List categories
   */
  getCategories: async (): Promise<APIResponse<Category[]>> => {
    return apiClient.get('/examples/categories');
  },
};
