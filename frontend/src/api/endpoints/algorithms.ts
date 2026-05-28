import { apiClient, APIResponse } from '../client';
import type {
  OptimizationRequest,
  OptimizationResponse,
  AlgorithmResult,
} from '@/types/fsm';
import type { TaskStatus } from '@/types/api';
import {
  normalizeAlgorithmResult,
  normalizeOptimizationResponse,
} from '../normalize';

export const algorithmAPI = {
  /**
   * Optimize FSM with specified algorithm
   */
  optimize: async (
    fsmId: string,
    request: OptimizationRequest,
  ): Promise<APIResponse<OptimizationResponse>> => {
    const res = (await apiClient.post(
      `/fsms/${fsmId}/optimize`,
      request,
    )) as unknown as APIResponse<OptimizationResponse>;
    return { ...res, data: normalizeOptimizationResponse(res.data) };
  },

  /**
   * Get optimization results
   */
  getResults: async (
    fsmId: string,
    algorithm?: string,
  ): Promise<APIResponse<AlgorithmResult[]>> => {
    const res = (await apiClient.get(`/fsms/${fsmId}/results`, {
      params: { algorithm },
    })) as unknown as APIResponse<AlgorithmResult[]>;
    return { ...res, data: (res.data ?? []).map(normalizeAlgorithmResult) };
  },

  /**
   * Compare multiple algorithms
   */
  compare: async (
    fsmId: string,
    algorithms: string[],
    // Per-algorithm tuning knobs (max_iterations, timeout_ms, etc.).
    // Loose because the backend accepts any algorithm-specific shape.
    options?: Record<string, unknown>,
  ): Promise<APIResponse<AlgorithmResult[]>> => {
    const res = (await apiClient.post(`/fsms/${fsmId}/compare`, {
      algorithms,
      options,
    })) as unknown as APIResponse<AlgorithmResult[]>;
    return { ...res, data: (res.data ?? []).map(normalizeAlgorithmResult) };
  },

  /**
   * Get async task status
   */
  getTaskStatus: async (taskId: string): Promise<APIResponse<TaskStatus>> => {
    return apiClient.get(`/tasks/${taskId}`);
  },
};
