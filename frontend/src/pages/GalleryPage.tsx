import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, SlidersHorizontal, Plus, Eye, GitFork, CheckCircle2 } from 'lucide-react';
import { useFSMs } from '../hooks/useFSM';
import { ROUTES, generateRoute } from '../config/routes';
import {
  Button,
  Input,
  Alert,
  Kicktitle,
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
    <div className="bg-paper border border-rule p-5 min-h-[12rem]">
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-3 w-12" />
      </div>
      <div className="skeleton h-5 w-3/5 mb-3" />
      <div className="skeleton h-3 w-full mb-1" />
      <div className="skeleton h-3 w-4/5 mb-6" />
      <div className="flex gap-3 pt-3 border-t border-rule">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-3 w-20" />
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortValue, setSortValue] = useState<string>('created_at-desc');
  const [fsmType, setFsmType] = useState<string>('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;

  // Debounce search input — wait 300ms after typing stops before querying
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [sortValue, fsmType]);

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
    page_size: PAGE_SIZE,
    page,
  });

  const fsms: GalleryFSM[] = (() => {
    if (!response) return [];
    if (Array.isArray(response)) return response as unknown as GalleryFSM[];
    if (Array.isArray((response as unknown as { data: GalleryFSM[] })?.data))
      return (response as unknown as { data: GalleryFSM[] }).data;
    return [];
  })();

  const hasFilters = !!(searchInput || fsmType);

  // Extract pagination from response envelope
  const pagination = (response as unknown as { pagination?: { pages: number; page: number; total: number } })?.pagination;
  const totalPages = pagination?.pages ?? 1;
  const totalItems = pagination?.total ?? fsms.length;

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-paper text-ink min-h-screen" data-testid="gallery-page">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint mb-3"
      >
        <Link to={ROUTES.HOME} className="hover:text-accent transition-colors">
          Catalog
        </Link>
        <span>›</span>
        <span className="text-ink">Gallery</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <Kicktitle number="3" className="mb-2">
            Gallery
          </Kicktitle>
          <h1 className="font-sans text-3xl sm:text-4xl font-semibold tracking-tight text-ink mb-2 pb-3 border-b-[2px] border-ink">
            Specifications, publicly shared.
          </h1>
          <p className="font-serif italic text-ink-soft text-base leading-relaxed mt-3 max-w-[44rem]">
            Finite-state machines contributed to the public catalog by other
            users &mdash; browsable, searchable, freely forkable into your own
            workspace.
          </p>
        </div>
        <Button onClick={() => navigate(ROUTES.EDITOR_NEW)} size="md">
          <Plus className="h-4 w-4" />
          New FSM
        </Button>
      </div>

      {/* Filter bar */}
      <div className="bg-paper rounded-xl border border-rule shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-6">
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search FSMs by name..."
              data-testid="gallery-search"
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Type filter */}
          <div className="sm:col-span-3">
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute inset-y-0 left-3 h-4 w-4 my-auto text-ink-faint" />
              <select
                value={fsmType}
                onChange={(e) => setFsmType(e.target.value)}
                data-testid="gallery-type-filter"
                className="block w-full rounded-md border border-rule-strong bg-paper py-2 pl-9 pr-3 text-sm text-ink shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="block w-full rounded-md border border-rule-strong bg-paper py-2 px-3 text-sm text-ink shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-paper-shade">
            <LayoutGrid className="h-8 w-8 text-ink-faint" />
          </div>
          <h3 className="text-lg font-semibold text-ink mb-2">
            {hasFilters ? 'No FSMs match your filters' : 'No public FSMs yet'}
          </h3>
          <p className="text-sm text-ink-soft max-w-sm mb-6">
            {hasFilters
              ? 'Try removing some filters or broadening your search.'
              : 'Be the first to share a finite state machine with the community.'}
          </p>
          {hasFilters ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearchInput('');
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
          <p className="text-xs text-ink-faint mb-4">
            Showing <span className="font-tabular">{fsms.length}</span> FSM{fsms.length !== 1 ? 's' : ''}
            {hasFilters ? ' matching your filters' : ''}
            {totalItems > PAGE_SIZE && ` (${totalItems} total)`}
          </p>
          {/* Datasheet entry grid — each card is a numbered specification
           *  entry. No rounded corners, no shadows, hairline rules; the
           *  entire card is a single anchor with focus-ring on the row. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-rule border border-ink">
            {fsms.map((fsm, idx) => (
              <Link
                key={fsm.id}
                to={generateRoute(ROUTES.EDITOR_EDIT, { id: fsm.id })}
                data-testid={`gallery-card-${fsm.id}`}
                className="group flex flex-col bg-paper hover:bg-accent-tint focus:outline-none focus:bg-accent-tint focus-ring transition-colors p-5 min-h-[12rem]"
              >
                {/* Index + type kicker */}
                <div className="flex items-baseline justify-between mb-2 font-mono text-[0.65rem] uppercase tracking-[0.18em]">
                  <span className="text-ink-faint font-tabular">
                    No. {String(idx + 1).padStart(3, '0')}
                  </span>
                  <span className="text-accent">{fsm.fsm_type}</span>
                </div>

                {/* Title */}
                <h3 className="font-sans text-lg font-semibold text-ink leading-tight line-clamp-2 mb-1.5 group-hover:text-accent transition-colors">
                  {fsm.name}
                </h3>

                {/* Description */}
                {fsm.description && (
                  <p className="font-serif italic text-[0.88rem] leading-snug text-ink-soft line-clamp-2 mb-3">
                    {fsm.description}
                  </p>
                )}

                {/* Spacer pushes meta to bottom of card */}
                <div className="flex-1" />

                {/* Stats row — mono, tabular, hairline-divided */}
                <div className="flex items-center gap-2 text-[0.7rem] font-mono uppercase tracking-[0.08em] text-ink-faint mt-3 pt-3 border-t border-rule">
                  <span>
                    <span className="font-tabular text-ink">{fsm.state_count}</span>
                    {' '}st
                  </span>
                  <span className="text-rule">·</span>
                  <span>
                    <span className="font-tabular text-ink">{fsm.transition_count}</span>
                    {' '}tr
                  </span>
                  {typeof fsm.view_count === 'number' && (
                    <>
                      <span className="text-rule">·</span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" aria-hidden />
                        <span className="font-tabular text-ink">{fsm.view_count}</span>
                      </span>
                    </>
                  )}
                  {typeof fsm.fork_count === 'number' && fsm.fork_count > 0 && (
                    <span className="flex items-center gap-1">
                      <GitFork className="h-3 w-3" aria-hidden />
                      <span className="font-tabular text-ink">{fsm.fork_count}</span>
                    </span>
                  )}
                </div>

                {/* Tags + status footer */}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex flex-wrap gap-1 min-w-0">
                    {fsm.tags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-[0.62rem] uppercase tracking-[0.08em] border border-rule-strong text-ink-soft px-1.5 py-[0.05rem]"
                      >
                        {tag}
                      </span>
                    ))}
                    {fsm.tags && fsm.tags.length > 3 && (
                      <span className="font-mono text-[0.62rem] text-ink-faint">
                        +{fsm.tags.length - 3}
                      </span>
                    )}
                  </div>
                  {fsm.is_optimized && (
                    <span className="flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] border border-ok text-ok px-1.5 py-[0.05rem] flex-shrink-0">
                      <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
                      Optimised
                    </span>
                  )}
                </div>

                {/* Date */}
                {fsm.created_at && (
                  <div className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint font-tabular">
                    {formatDate(fsm.created_at)}
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                data-testid="gallery-prev"
              >
                Previous
              </Button>
              <span className="text-sm text-ink-soft dark:text-ink-faint">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                data-testid="gallery-next"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
