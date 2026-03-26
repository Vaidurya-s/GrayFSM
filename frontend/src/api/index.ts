// Export all API endpoints
export { fsmAPI } from './endpoints/fsms';
export { algorithmAPI } from './endpoints/algorithms';
export { exportAPI } from './endpoints/export';
export { examplesAPI } from './endpoints/examples';

export { apiClient } from './client';
export { apiClient as api } from './client'; // Alias for convenience
export type { APIResponse, PaginatedResponse, APIError, ErrorResponse } from './client';
