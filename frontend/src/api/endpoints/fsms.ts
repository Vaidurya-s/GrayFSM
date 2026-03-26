import { apiClient, APIResponse, PaginatedResponse } from '../client';
import type { FSM, FSMCreate, FSMUpdate } from '@/types/fsm';
import type { FSMListParams } from '@/types/api';

export const fsmAPI = {
  /**
   * List FSMs with pagination and filtering
   */
  list: async (params?: FSMListParams): Promise<PaginatedResponse<FSM>> => {
    return apiClient.get('/fsms', { params });
  },

  /**
   * Get single FSM by ID
   */
  get: async (id: string): Promise<APIResponse<FSM>> => {
    return apiClient.get(`/fsms/${id}`);
  },

  /**
   * Create new FSM
   */
  create: async (data: FSMCreate): Promise<APIResponse<FSM>> => {
    return apiClient.post('/fsms', data);
  },

  /**
   * Update existing FSM
   */
  update: async (id: string, data: FSMUpdate): Promise<APIResponse<FSM>> => {
    return apiClient.put(`/fsms/${id}`, data);
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
    return apiClient.post(`/fsms/${id}/fork`, { name });
  },

  /**
   * Increment view count
   */
  incrementViews: async (id: string): Promise<void> => {
    return apiClient.post(`/fsms/${id}/view`);
  },
};
