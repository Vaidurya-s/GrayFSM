import { apiClient, APIResponse } from '../client';

export interface AuthTokenPayload {
  access_token: string;
  token_type: string;
}

function extractToken(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid authentication response');
  }
  const record = body as Record<string, unknown>;
  if (typeof record.access_token === 'string') {
    return record.access_token;
  }
  if (record.data && typeof record.data === 'object') {
    const inner = record.data as Record<string, unknown>;
    if (typeof inner.access_token === 'string') {
      return inner.access_token;
    }
  }
  throw new Error('No access token in response');
}

export const authAPI = {
  register: async (email: string, password: string): Promise<string> => {
    const response = await apiClient.post<APIResponse<AuthTokenPayload> | AuthTokenPayload>(
      '/auth/register',
      { email, password }
    );
    return extractToken(response);
  },

  login: async (email: string, password: string): Promise<string> => {
    const response = await apiClient.post<APIResponse<AuthTokenPayload> | AuthTokenPayload>(
      '/auth/login',
      { email, password }
    );
    return extractToken(response);
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Clear local session even if the server call fails (expired token, offline).
    }
  },
};
