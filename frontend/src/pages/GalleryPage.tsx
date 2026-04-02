import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFSMs } from '../hooks/useFSM';
import { ROUTES, generateRoute } from '../config/routes';
import { cn } from '../utils/cn';
import type { FSMListParams } from '../types/api';

// Extended FSM type to include server-side fields not in the frozen type definition
interface GalleryFSM {
  id: string;
  name: string;
  description?: string;
  fsm_type: string;
  state_count: number;
  transition_count: number;
  view_count?: number;
  tags?: string[];
  is_optimized?: boolean;
  [key: string]: unknown;
}

export default function GalleryPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<FSMListParams['sort_by']>('created_at');
  const [sortOrder, setSortOrder] = useState<FSMListParams['sort_order']>('desc');
  const [fsmType, setFsmType] = useState<string>('');

  const { data: response, isLoading, error } = useFSMs({
    visibility: 'public',
    search: search || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    fsm_type: fsmType ? (fsmType as 'moore' | 'mealy') : undefined,
    page_size: 20,
  });

  // Handle both possible response shapes
  const fsms: GalleryFSM[] = (() => {
    if (!response) return [];
    if (Array.isArray(response)) return response as unknown as GalleryFSM[];
    if (Array.isArray((response as unknown as { data: GalleryFSM[] })?.data))
      return (response as unknown as { data: GalleryFSM[] }).data;
    return [];
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="gallery-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">FSM Gallery</h1>
        <p className="text-sm text-gray-600 mt-1">
          Browse publicly shared finite state machines from the community.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FSMs..."
              data-testid="gallery-search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <select
              value={fsmType}
              onChange={(e) => setFsmType(e.target.value)}
              data-testid="gallery-type-filter"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Types</option>
              <option value="moore">Moore</option>
              <option value="mealy">Mealy</option>
            </select>
          </div>
          <div>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-') as [
                  FSMListParams['sort_by'],
                  FSMListParams['sort_order'],
                ];
                setSortBy(by);
                setSortOrder(order);
              }}
              data-testid="gallery-sort"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="view_count-desc">Most Viewed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-sm text-red-800">Failed to load gallery</p>
          <p className="text-xs text-red-600 mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && fsms.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 border border-gray-200 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No FSMs found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {search
              ? 'Try adjusting your search or filters.'
              : 'No public FSMs have been shared yet. Be the first!'}
          </p>
          <Link
            to={ROUTES.EDITOR_NEW}
            className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Create an FSM
          </Link>
        </div>
      )}

      {/* FSM Grid */}
      {fsms.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {fsms.map((fsm) => (
            <Link
              key={fsm.id}
              to={generateRoute(ROUTES.EDITOR_EDIT, { id: fsm.id })}
              data-testid={`gallery-card-${fsm.id}`}
              className="bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow p-6 block"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {fsm.name}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    fsm.fsm_type === 'moore'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-indigo-100 text-indigo-800'
                  )}
                >
                  {fsm.fsm_type}
                </span>
              </div>
              {fsm.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                  {fsm.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{fsm.state_count} states</span>
                <span>{fsm.transition_count} transitions</span>
                {fsm.view_count !== undefined && <span>{fsm.view_count} views</span>}
              </div>
              {fsm.is_optimized && (
                <div className="mt-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Optimized
                  </span>
                </div>
              )}
              {fsm.tags && fsm.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {fsm.tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                  {fsm.tags.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{fsm.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
