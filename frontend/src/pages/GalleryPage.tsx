import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, SlidersHorizontal, Plus, Eye, GitFork, CheckCircle2 } from 'lucide-react';
import { useFSMs } from '../hooks/useFSM';
import { ROUTES, generateRoute } from '../config/routes';
import {
  Button,
  Badge,
  Card,
  CardBody,
  CardFooter,
  Input,
  Alert,
} from '../components/ui';
import type { FSMListParams } from '../types/api';
import type { FSMType } from '../types/fsm';

// Extended FSM type to include server-side fields not in the frozen type definition
interface GalleryFSM {
  id: string;
  name: string;
  description?: string;
  fsm_type: FSMType | string;
  state_count: number;
  transition_count: number;
  view_count?: number;
  fork_count?: number;
  tags?: string[];
  is_optimized?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

const FSM_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'moore', label: 'Moore' },
  { value: 'mealy', label: 'Mealy' },
] as const;

const SORT_OPTIONS = [
  { value: 'created_at-desc', label: 'Newest First' },
  { value: 'created_at-asc', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'view_count-desc', label: 'Most Viewed' },
] as const;

function FSMTypeVariant(fsmType: string): 'default' | 'info' {
  return fsmType === 'moore' ? 'default' : 'info';
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SkeletonCard() {
  return (
    <div className="animate-pulse bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 bg-gray-200 rounded w-3/5" />
        <div className="h-5 bg-gray-200 rounded-full w-14" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-full mb-2" />
      <div className="h-3 bg-gray-200 rounded w-4/5 mb-4" />
      <div className="flex gap-3">
        <div className="h-3 bg-gray-200 rounded w-16" />
        <div className="h-3 bg-gray-200 rounded w-20" />
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortValue, setSortValue] = useState<string>('created_at-desc');
  const [fsmType, setFsmType] = useState<string>('');

  const [sortBy, sortOrder] = sortValue.split('-') as [
    FSMListParams['sort_by'],
    FSMListParams['sort_order'],
  ];

  const { data: response, isLoading, error, refetch } = useFSMs({
    visibility: 'public',
    search: search || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    fsm_type: fsmType ? (fsmType as 'moore' | 'mealy') : undefined,
    page_size: 24,
  });

  const fsms: GalleryFSM[] = (() => {
    if (!response) return [];
    if (Array.isArray(response)) return response as unknown as GalleryFSM[];
    if (Array.isArray((response as unknown as { data: GalleryFSM[] })?.data))
      return (response as unknown as { data: GalleryFSM[] }).data;
    return [];
  })();

  const hasFilters = !!(search || fsmType);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="gallery-page">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <Link to={ROUTES.HOME} className="hover:text-gray-700 dark:hover:text-gray-300">Home</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">Gallery</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-gray-900">FSM Gallery</h1>
          </div>
          <p className="text-sm text-gray-500">
            Browse publicly shared finite state machines from the community.
          </p>
        </div>
        <Button onClick={() => navigate(ROUTES.EDITOR_NEW)} size="md">
          <Plus className="h-4 w-4" />
          New FSM
        </Button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-6">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FSMs by name..."
              data-testid="gallery-search"
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Type filter */}
          <div className="sm:col-span-3">
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute inset-y-0 left-3 h-4 w-4 my-auto text-gray-400" />
              <select
                value={fsmType}
                onChange={(e) => setFsmType(e.target.value)}
                data-testid="gallery-type-filter"
                className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {FSM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort */}
          <div className="sm:col-span-3">
            <select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              data-testid="gallery-sort"
              className="block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {!isLoading && error && (
        <Alert variant="error" title="Failed to load FSMs" className="mb-6">
          <span>Could not fetch gallery data from the server. </span>
          <button
            onClick={() => refetch()}
            className="underline font-medium hover:no-underline"
          >
            Try again
          </button>
        </Alert>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && fsms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <LayoutGrid className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {hasFilters ? 'No FSMs match your filters' : 'No public FSMs yet'}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            {hasFilters
              ? 'Try removing some filters or broadening your search.'
              : 'Be the first to share a finite state machine with the community.'}
          </p>
          {hasFilters ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setFsmType('');
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Button onClick={() => navigate(ROUTES.EDITOR_NEW)}>
              <Plus className="h-4 w-4" />
              Create your first FSM
            </Button>
          )}
        </div>
      )}

      {/* FSM grid */}
      {!isLoading && fsms.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-4">
            Showing {fsms.length} FSM{fsms.length !== 1 ? 's' : ''}
            {hasFilters ? ' matching your filters' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {fsms.map((fsm) => (
              <Link
                key={fsm.id}
                to={generateRoute(ROUTES.EDITOR_EDIT, { id: fsm.id })}
                data-testid={`gallery-card-${fsm.id}`}
                className="group block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl"
              >
                <Card className="h-full rounded-xl transition-all group-hover:border-blue-200">
                  <CardBody className="pt-5">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-blue-700 transition-colors">
                        {fsm.name}
                      </h3>
                      <Badge variant={FSMTypeVariant(fsm.fsm_type as string)} className="flex-shrink-0 capitalize">
                        {fsm.fsm_type}
                      </Badge>
                    </div>

                    {/* Description */}
                    {fsm.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                        {fsm.description}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-gray-600">{fsm.state_count}</span>
                        {' '}states
                      </span>
                      <span className="text-gray-200">|</span>
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-gray-600">{fsm.transition_count}</span>
                        {' '}transitions
                      </span>
                      {typeof fsm.view_count === 'number' && (
                        <>
                          <span className="text-gray-200">|</span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {fsm.view_count}
                          </span>
                        </>
                      )}
                      {typeof fsm.fork_count === 'number' && fsm.fork_count > 0 && (
                        <span className="flex items-center gap-1">
                          <GitFork className="h-3 w-3" />
                          {fsm.fork_count}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {fsm.tags && fsm.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {fsm.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                        {fsm.tags.length > 3 && (
                          <span className="text-xs text-gray-400">+{fsm.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </CardBody>

                  <CardFooter className="pt-0 pb-4 justify-between">
                    {/* Optimized badge */}
                    {fsm.is_optimized ? (
                      <Badge variant="success" className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Optimized
                      </Badge>
                    ) : (
                      <span />
                    )}

                    {/* Date */}
                    {fsm.created_at && (
                      <span className="text-xs text-gray-400">{formatDate(fsm.created_at)}</span>
                    )}
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
