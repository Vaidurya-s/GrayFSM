// API Type Definitions

export interface APIResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
    timestamp: string;
    version: string;
    request_id: string;
  };
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface Pagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: Pagination;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface ErrorResponse {
  success: false;
  error: APIError;
}

export interface FSMListParams extends PaginationParams {
  visibility?: 'public' | 'private' | 'example';
  fsm_type?: 'moore' | 'mealy';
  search?: string;
  tags?: string;
  sort_by?: 'created_at' | 'updated_at' | 'view_count' | 'name';
  sort_order?: 'asc' | 'desc';
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  count: number;
}

export interface Example {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  fsm_data: any;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
}
