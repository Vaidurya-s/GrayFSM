import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/config/constants';

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
    const token = localStorage.getItem('auth_token');
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
      // Clear auth and redirect to login
      localStorage.removeItem('auth_token');
      // Optionally redirect: window.location.href = '/login';
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
