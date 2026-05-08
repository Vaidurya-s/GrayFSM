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
  // Pydantic returns a list of validation errors; other backends may
  // return strings or maps. `unknown` forces callers to narrow.
  details?: unknown;
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
  // Inline FSM definition. Mirrors the backend's `definition` field;
  // kept loose because example sources include encodings and other
  // extension fields that aren't all typed.
  fsm_data: Record<string, unknown>;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  // OptimizationResponse from the backend on success; loose because
  // each algorithm contributes its own keys.
  result?: Record<string, unknown>;
  error?: string;
}
