import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/config/constants';
import { AUTH_TOKEN_KEY } from '@/store/authStore';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — unwrap the backend's {success, data} envelope
apiClient.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    // Handle errors globally
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        const redirect = encodeURIComponent(path + window.location.search);
        window.location.assign(`/login?redirect=${redirect}`);
      }
    }

    // Re-throw error for individual handlers
    return Promise.reject(error);
  }
);

// Type-safe API response wrapper
export interface APIResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
    timestamp: string;
    version: string;
    request_id: string;
  };
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface APIError {
  code: string;
  message: string;
  // Pydantic returns a list of validation errors; other paths may return
  // a string. Consumers should narrow before reading.
  details?: unknown;
}

export interface ErrorResponse {
  success: false;
  error: APIError;
}

/**
 * Generic API call function
 */
export async function apiCall<T>(config: AxiosRequestConfig): Promise<T> {
  return apiClient.request<T, T>(config);
}
