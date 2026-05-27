import { apiClient, APIResponse } from '../client';

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export interface AuthUser {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export const authAPI = {
  register: async (email: string, password: string): Promise<APIResponse<AuthTokens>> => {
    return apiClient.post('/auth/register', { email, password });
  },

  login: async (email: string, password: string): Promise<APIResponse<AuthTokens>> => {
    return apiClient.post('/auth/login', { email, password });
  },

  me: async (): Promise<APIResponse<AuthUser>> => {
    return apiClient.get('/auth/me');
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
