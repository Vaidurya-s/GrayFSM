import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Zap, ChevronRight, Layers } from 'lucide-react';
import { examplesAPI } from '../api/endpoints/examples';
import { ROUTES, generateRoute } from '../config/routes';
import {
  Button,
  Alert,
  Spinner,
  Tabs,
  TabPanel,
  Kicktitle,
} from '../components/ui';
import type { Example } from '../types/api';

// ── Static fallback examples shown when the API is unavailable ──────────────

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type Category = 'Simple' | 'Medium' | 'Complex';

interface StaticExample {
  id: string;
  name: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
  fsmType: 'Moore' | 'Mealy';
  stateCount: number;
  transitionCount: number;
  tags: string[];
}

const STATIC_EXAMPLES: StaticExample[] = [
  {
    id: 'traffic_light',
    name: 'Traffic Light Controller',
    description:
      'A Moore machine that cycles through green, yellow, and red states based on a timer signal. Classic control systems example ideal for beginners.',
    category: 'Simple',
    difficulty: 'beginner',
    fsmType: 'Moore',
    stateCount: 3,
    transitionCount: 3,
    tags: ['control', 'moore', 'timer'],
  },
  {
    id: 'sequence_detector',
    name: '101 Sequence Detector',
    description:
      'Detects the binary pattern "101" in a continuous stream of input bits. Demonstrates overlapping detection with Moore-style outputs.',
    category: 'Simple',
    difficulty: 'beginner',
    fsmType: 'Moore',
    stateCount: 4,
    transitionCount: 8,
    tags: ['sequence', 'binary', 'detection'],
  },
  {
    id: 'vending_machine',
    name: 'Vending Machine',
    description:
      'A Moore machine modelling a simple vending machine that accepts nickels and dimes, dispensing an item once 15 cents have been inserted.',
    category: 'Medium',
    difficulty: 'intermediate',
    fsmType: 'Moore',
    stateCount: 6,
    transitionCount: 10,
    tags: ['vending', 'coins', 'digital-logic'],
  },
  {
    id: 'elevator',
    name: 'Elevator Controller',
    description:
      'A Mealy machine modelling a two-floor elevator with up/down request inputs and door-open outputs. Great for studying Mealy vs Moore trade-offs.',
    category: 'Medium',
    difficulty: 'intermediate',
    fsmType: 'Mealy',
    stateCount: 5,
    transitionCount: 12,
    tags: ['elevator', 'mealy', 'control'],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_TABS: Category[] = ['Simple', 'Medium', 'Complex'];

// ── Static card (offline / fallback) ────────────────────────────────────────

function StaticExampleCard({
  example,
  index,
}: {
  example: StaticExample;
  index: number;
}) {
  const navigate = useNavigate();
  const tone =
    example.difficulty === 'beginner'
      ? 'border-ok text-ok'
      : example.difficulty === 'intermediate'
        ? 'border-warn text-warn'
        : 'border-err text-err';

  return (
    <article className="flex flex-col bg-paper border border-rule p-5 min-h-[14rem]">
      {/* Index + difficulty kicker */}
      <div className="flex items-baseline justify-between mb-2 font-mono text-[0.65rem] uppercase tracking-[0.18em]">
        <span className="text-ink-faint font-tabular">
          No. {String(index + 1).padStart(3, '0')}
        </span>
        <span className={`border ${tone} px-1.5 py-[0.05rem]`}>
          {example.difficulty}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-sans text-lg font-semibold text-ink leading-tight mb-1.5">
        {example.name}
      </h3>

      {/* Description */}
      <p className="font-serif italic text-[0.88rem] leading-snug text-ink-soft line-clamp-3 mb-4">
        {example.description}
      </p>

      {/* Spec inline rule — three-up datasheet stats */}
      <div className="grid grid-cols-3 mt-auto mb-3 border-t border-b border-rule">
        <SpecRow label="States" value={example.stateCount} />
        <SpecRow label="Transitions" value={example.transitionCount} divider />
        <SpecRow
          label="Type"
          value={example.fsmType?.toUpperCase() ?? '—'}
          tabular={false}
          divider
        />
      </div>

      {/* Tags */}
      {Array.isArray(example.tags) && example.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {example.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="font-mono text-[0.62rem] uppercase tracking-[0.08em] border border-rule-strong text-ink-soft px-1.5 py-[0.05rem]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(`${ROUTES.EDITOR_NEW}?example=${example.id}`)}
        data-testid={`example-try-${example.id}`}
        className="mt-1 font-mono text-[0.78rem] uppercase tracking-[0.1em] border border-ink bg-accent text-paper px-4 py-2 hover:bg-ink hover:text-paper transition-colors focus-ring"
      >
        <span className="text-paper mr-1.5">↳</span>
        Try it
      </button>
    </article>
  );
}

/** SpecRow — small spec-row used inside the example card three-up grid. */
function SpecRow({
  label,
  value,
  divider = false,
  tabular = true,
}: {
  label: string;
  value: number | string;
  divider?: boolean;
  tabular?: boolean;
}) {
  return (
    <div
      className={
        'py-2 px-1 text-center ' +
        (divider ? 'border-l border-rule' : '')
      }
    >
      <div
        className={
          'text-base font-semibold text-ink leading-none mb-0.5 ' +
          (tabular ? 'font-mono font-tabular' : 'font-mono')
        }
      >
        {value}
      </div>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}

// ── API-sourced card ─────────────────────────────────────────────────────────

function ApiExampleCard({
  example,
  index,
}: {
  example: Example;
  index: number;
}) {
  const navigate = useNavigate();

  // fsm_data is intentionally typed loose (Record<string, unknown>) on
  // the API boundary, so narrow at use-site instead of fighting the type.
  const fsmData = example.fsm_data as
    | { states?: unknown[]; state_count?: number; transitions?: unknown[]; transition_count?: number }
    | undefined;

  const stateCount: number =
    Array.isArray(fsmData?.states)
      ? fsmData.states.length
      : fsmData?.state_count ?? 0;

  const transitionCount: number =
    Array.isArray(fsmData?.transitions)
      ? fsmData.transitions.length
      : fsmData?.transition_count ?? 0;

  const tone =
    example.difficulty === 'beginner'
      ? 'border-ok text-ok'
      : example.difficulty === 'intermediate'
        ? 'border-warn text-warn'
        : 'border-err text-err';

  return (
    <article
      className="flex flex-col bg-paper border border-rule p-5 min-h-[14rem]"
      data-testid={`example-card-${example.id}`}
    >
      {/* Index + difficulty kicker */}
      <div className="flex items-baseline justify-between mb-2 font-mono text-[0.65rem] uppercase tracking-[0.18em]">
        <span className="text-ink-faint font-tabular">
          No. {String(index + 1).padStart(3, '0')}
        </span>
        <span className={`border ${tone} px-1.5 py-[0.05rem]`}>
          {example.difficulty}
        </span>
      </div>

      {/* Category */}
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-accent mb-1">
        {example.category}
      </p>

      {/* Title */}
      <h3 className="font-sans text-lg font-semibold text-ink leading-tight mb-1.5">
        {example.name}
      </h3>

      {/* Description */}
      <p className="font-serif italic text-[0.88rem] leading-snug text-ink-soft line-clamp-3 mb-4">
        {example.description}
      </p>

      {/* Spec stats inline */}
      {(stateCount > 0 || transitionCount > 0) && (
        <div className="grid grid-cols-2 mt-auto mb-3 border-t border-b border-rule">
          {stateCount > 0 && <SpecRow label="States" value={stateCount} />}
          {transitionCount > 0 && (
            <SpecRow
              label="Transitions"
              value={transitionCount}
              divider={stateCount > 0}
            />
          )}
        </div>
      )}

      {/* Tags */}
      {Array.isArray(example.tags) && example.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {example.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="font-mono text-[0.62rem] uppercase tracking-[0.08em] border border-rule-strong text-ink-soft px-1.5 py-[0.05rem]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button
          type="button"
          onClick={() => navigate(`${ROUTES.EDITOR_NEW}?example=${example.id}`)}
          data-testid={`example-try-${example.id}`}
          className="flex-1 font-mono text-[0.78rem] uppercase tracking-[0.1em] border border-ink bg-accent text-paper px-4 py-2 hover:bg-ink hover:text-paper transition-colors focus-ring"
        >
          <span className="text-paper mr-1.5">↳</span>
          Try it
        </button>
        <button
          type="button"
          onClick={() =>
            navigate(generateRoute(ROUTES.EXAMPLE_DETAIL, { id: example.id }))
          }
          aria-label="Details"
          className="font-mono text-[0.78rem] uppercase tracking-[0.1em] border border-ink bg-paper text-ink px-3 py-2 hover:bg-ink hover:text-paper transition-colors focus-ring"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

// ── Tabs definition ──────────────────────────────────────────────────────────

const CATEGORY_TAB_DEFS = CATEGORY_TABS.map((cat) => ({ value: cat, label: cat }));

// ── Page ────────────────────────────────────────────────────────────────────

export default function ExamplesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('Simple');

  const {
    data: examplesResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['examples'],
    queryFn: () => examplesAPI.list(),
    retry: 1,
  });

  const apiExamples: Example[] = (() => {
    if (!examplesResponse) return [];
    if (Array.isArray(examplesResponse)) return examplesResponse;
    if (Array.isArray((examplesResponse as unknown as { data: Example[] })?.data))
      return (examplesResponse as unknown as { data: Example[] }).data;
    return [];
  })();

  // Group API examples by difficulty for tabs
  const byDifficulty: Record<string, Example[]> = {
    Simple: apiExamples.filter((e) => e.difficulty === 'beginner'),
    Medium: apiExamples.filter((e) => e.difficulty === 'intermediate'),
    Complex: apiExamples.filter((e) => e.difficulty === 'advanced'),
  };

  // Group static examples by category
  const byCategory: Record<Category, StaticExample[]> = {
    Simple: STATIC_EXAMPLES.filter((e) => e.category === 'Simple'),
    Medium: STATIC_EXAMPLES.filter((e) => e.category === 'Medium'),
    Complex: STATIC_EXAMPLES.filter((e) => e.category === 'Complex'),
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-paper text-ink min-h-screen" data-testid="examples-page">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint mb-3"
      >
        <Link to={ROUTES.HOME} className="hover:text-accent transition-colors">
          Catalog
        </Link>
        <span>›</span>
        <span className="text-ink">Examples</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <Kicktitle number="4" className="mb-2">
            Examples
          </Kicktitle>
          <h1 className="font-sans text-3xl sm:text-4xl font-semibold tracking-tight text-ink mb-2 pb-3 border-b-[2px] border-ink">
            Reference specifications.
          </h1>
          <p className="font-serif italic text-ink-soft text-base leading-relaxed mt-3 max-w-[44rem]">
            Built-in finite-state machines, annotated for study. Open any in
            the editor &mdash; transitions, encodings, and outputs are all
            inspectable, and any can be forked into your own catalog.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(ROUTES.EDITOR_NEW)}
        >
          <Zap className="h-4 w-4" />
          Create your own
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-ink-soft">Loading examples…</p>
        </div>
      )}

      {/* Error — show static fallback with note */}
      {!isLoading && error && (
        <>
          <Alert variant="warning" title="Using offline examples" className="mb-6">
            Could not reach the server. Showing built-in example definitions — &quot;Try it&quot; will open
            the editor with the example pre-loaded.
          </Alert>

          <Tabs
            tabs={CATEGORY_TAB_DEFS.map((t) => ({
              value: t.value,
              label: (
                <>
                  {t.label}
                  {byCategory[t.value as Category].length > 0 && (
                    <span className="ml-1.5 rounded-full bg-rule px-1.5 text-[10px] font-semibold text-ink-soft">
                      {byCategory[t.value as Category].length}
                    </span>
                  )}
                </>
              ),
            }))}
            value={activeTab}
            onChange={setActiveTab}
            className="mb-6"
          >
            {CATEGORY_TABS.map((cat) => (
              <TabPanel key={cat} value={cat} activeValue={activeTab}>
                {byCategory[cat].length === 0 ? (
                  <div className="py-12 text-center text-sm text-ink-faint">
                    No {cat.toLowerCase()} examples available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {byCategory[cat].map((ex, i) => (
                      <StaticExampleCard key={ex.id} example={ex} index={i} />
                    ))}
                  </div>
                )}
              </TabPanel>
            ))}
          </Tabs>
        </>
      )}

      {/* API examples with tabs */}
      {!isLoading && !error && apiExamples.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <p className="text-xs text-ink-faint">
              <span className="font-tabular">{apiExamples.length}</span> example{apiExamples.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <Tabs
            tabs={CATEGORY_TAB_DEFS.map((t) => ({
              value: t.value,
              label: (
                <>
                  {t.label}
                  {byDifficulty[t.value].length > 0 && (
                    <span className="ml-1.5 rounded-full bg-rule px-1.5 text-[10px] font-semibold text-ink-soft">
                      {byDifficulty[t.value].length}
                    </span>
                  )}
                </>
              ),
            }))}
            value={activeTab}
            onChange={setActiveTab}
          >
            {CATEGORY_TABS.map((cat) => (
              <TabPanel key={cat} value={cat} activeValue={activeTab}>
                {byDifficulty[cat].length === 0 ? (
                  <div className="py-12 text-center text-sm text-ink-faint">
                    No {cat.toLowerCase()} examples available yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {byDifficulty[cat].map((ex, i) => (
                      <ApiExampleCard key={ex.id} example={ex} index={i} />
                    ))}
                  </div>
                )}
              </TabPanel>
            ))}
          </Tabs>
        </>
      )}

      {/* API returned empty — show static examples as fallback content */}
      {!isLoading && !error && apiExamples.length === 0 && (
        <>
          <div className="mb-6 flex items-center gap-2 text-sm text-ink-soft">
            <Layers className="h-4 w-4" />
            <span>Showing built-in examples — live examples will appear here once published.</span>
          </div>

          <Tabs
            tabs={CATEGORY_TAB_DEFS.map((t) => ({
              value: t.value,
              label: (
                <>
                  {t.label}
                  {byCategory[t.value as Category].length > 0 && (
                    <span className="ml-1.5 rounded-full bg-rule px-1.5 text-[10px] font-semibold text-ink-soft">
                      {byCategory[t.value as Category].length}
                    </span>
                  )}
                </>
              ),
            }))}
            value={activeTab}
            onChange={setActiveTab}
            className="mb-6"
          >
            {CATEGORY_TABS.map((cat) => (
              <TabPanel key={cat} value={cat} activeValue={activeTab}>
                {byCategory[cat].length === 0 ? (
                  <div className="py-12 text-center text-sm text-ink-faint">
                    No {cat.toLowerCase()} examples available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {byCategory[cat].map((ex, i) => (
                      <StaticExampleCard key={ex.id} example={ex} index={i} />
                    ))}
                  </div>
                )}
              </TabPanel>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
