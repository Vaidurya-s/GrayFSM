import { apiClient, APIResponse } from '../client';
import type {
  OptimizationRequest,
  OptimizationResponse,
  AlgorithmResult,
} from '@/types/fsm';
import type { TaskStatus } from '@/types/api';

export const algorithmAPI = {
  /**
   * Optimize FSM with specified algorithm
   */
  optimize: async (
    fsmId: string,
    request: OptimizationRequest
  ): Promise<APIResponse<OptimizationResponse>> => {
    return apiClient.post(`/fsms/${fsmId}/optimize`, request);
  },

  /**
   * Get optimization results
   */
  getResults: async (
    fsmId: string,
    algorithm?: string
  ): Promise<APIResponse<AlgorithmResult[]>> => {
    return apiClient.get(`/fsms/${fsmId}/results`, {
      params: { algorithm },
    });
  },

  /**
   * Compare multiple algorithms
   */
  compare: async (
    fsmId: string,
    algorithms: string[],
    // Per-algorithm tuning knobs (max_iterations, timeout_ms, etc.).
    // Loose because the backend accepts any algorithm-specific shape.
    options?: Record<string, unknown>
  ): Promise<APIResponse<AlgorithmResult[]>> => {
    return apiClient.post(`/fsms/${fsmId}/compare`, {
      algorithms,
      options,
    });
  },

  /**
   * Get async task status
   */
  getTaskStatus: async (taskId: string): Promise<APIResponse<TaskStatus>> => {
    return apiClient.get(`/tasks/${taskId}`);
  },
};
