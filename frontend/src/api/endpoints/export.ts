import { apiClient, APIResponse } from '../client';
import type { ExportRequest, ExportResponse } from '@/types/fsm';

export const exportAPI = {
  /**
   * Export FSM to specified format
   */
  export: async (
    fsmId: string,
    request: ExportRequest
  ): Promise<APIResponse<ExportResponse>> => {
    return apiClient.post(`/fsms/${fsmId}/export`, request);
  },

  /**
   * Get cached export if available
   */
  getCached: async (fsmId: string, format: string): Promise<string> => {
    const response = await apiClient.get(`/fsms/${fsmId}/export/${format}`, {
      responseType: 'text',
    });
    return response as unknown as string;
  },

  /**
   * Download export file
   */
  download: async (fsmId: string, format: string): Promise<Blob> => {
    const response = await apiClient.get(`/fsms/${fsmId}/export/${format}`, {
      responseType: 'blob',
    });
    return response as unknown as Blob;
  },
};
