import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Zap, ChevronRight, Layers, ArrowRight } from 'lucide-react';
import { examplesAPI } from '../api/endpoints/examples';
import { ROUTES, generateRoute } from '../config/routes';
import {
  Button,
  Badge,
  Card,
  CardBody,
  CardFooter,
  Alert,
  Spinner,
  Tabs,
  TabPanel,
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

const DIFFICULTY_VARIANT: Record<Difficulty, 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

const CATEGORY_TABS: Category[] = ['Simple', 'Medium', 'Complex'];

function difficultyVariant(d: string) {
  return DIFFICULTY_VARIANT[d as Difficulty] ?? 'secondary';
}

function StatCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// ── Static card (offline / fallback) ────────────────────────────────────────

function StaticExampleCard({ example }: { example: StaticExample }) {
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col rounded-xl">
      <CardBody className="pt-5 flex-1">
        {/* Title + difficulty */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-tight">{example.name}</h3>
          <Badge variant={difficultyVariant(example.difficulty)} className="flex-shrink-0 capitalize">
            {example.difficulty}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 line-clamp-3 mb-4">{example.description}</p>

        {/* Stats */}
        <div className="flex justify-around rounded-lg bg-gray-50 py-3 mb-3">
          <StatCount label="States" value={example.stateCount} />
          <div className="w-px bg-gray-200" />
          <StatCount label="Transitions" value={example.transitionCount} />
          <div className="w-px bg-gray-200" />
          <div className="text-center">
            <p className="text-xs font-semibold text-gray-700">{example.fsmType}</p>
            <p className="text-xs text-gray-500">Type</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {example.tags.map((tag) => (
            <span key={tag} className="rounded px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700">
              {tag}
            </span>
          ))}
        </div>
      </CardBody>

      <CardFooter className="pt-0 pb-5">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => navigate(`${ROUTES.EDITOR_NEW}?example=${example.id}`)}
          data-testid={`example-try-${example.id}`}
        >
          Try it
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── API-sourced card ─────────────────────────────────────────────────────────

function ApiExampleCard({ example }: { example: Example }) {
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

  return (
    <Card
      className="flex flex-col rounded-xl"
      data-testid={`example-card-${example.id}`}
    >
      <CardBody className="pt-5 flex-1">
        {/* Title + difficulty */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-tight">{example.name}</h3>
          <Badge variant={difficultyVariant(example.difficulty)} className="flex-shrink-0 capitalize">
            {example.difficulty}
          </Badge>
        </div>

        {/* Category */}
        <p className="text-xs text-blue-600 font-medium mb-1">{example.category}</p>

        {/* Description */}
        <p className="text-xs text-gray-500 line-clamp-3 mb-4">{example.description}</p>

        {/* Stats */}
        {(stateCount > 0 || transitionCount > 0) && (
          <div className="flex justify-around rounded-lg bg-gray-50 py-3 mb-3">
            {stateCount > 0 && <StatCount label="States" value={stateCount} />}
            {stateCount > 0 && transitionCount > 0 && <div className="w-px bg-gray-200" />}
            {transitionCount > 0 && <StatCount label="Transitions" value={transitionCount} />}
          </div>
        )}

        {/* Tags */}
        {example.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {example.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700">
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardBody>

      <CardFooter className="pt-0 pb-5 gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => navigate(generateRoute(ROUTES.EXAMPLE_DETAIL, { id: example.id }))}
          data-testid={`example-try-${example.id}`}
        >
          Try it
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(generateRoute(ROUTES.EXAMPLE_DETAIL, { id: example.id }))}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="examples-page">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <Link to={ROUTES.HOME} className="hover:text-gray-700 dark:hover:text-gray-300">Home</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">Examples</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-gray-900">Example FSMs</h1>
          </div>
          <p className="text-sm text-gray-500">
            Learn from built-in examples. Open any in the editor and explore how it works.
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
          <p className="text-sm text-gray-500">Loading examples…</p>
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
                    <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold text-gray-600">
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
                  <div className="py-12 text-center text-sm text-gray-400">
                    No {cat.toLowerCase()} examples available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {byCategory[cat].map((ex) => (
                      <StaticExampleCard key={ex.id} example={ex} />
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
            <p className="text-xs text-gray-400">
              {apiExamples.length} example{apiExamples.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <Tabs
            tabs={CATEGORY_TAB_DEFS.map((t) => ({
              value: t.value,
              label: (
                <>
                  {t.label}
                  {byDifficulty[t.value].length > 0 && (
                    <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold text-gray-600">
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
                  <div className="py-12 text-center text-sm text-gray-400">
                    No {cat.toLowerCase()} examples available yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {byDifficulty[cat].map((ex) => (
                      <ApiExampleCard key={ex.id} example={ex} />
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
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
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
                    <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold text-gray-600">
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
                  <div className="py-12 text-center text-sm text-gray-400">
                    No {cat.toLowerCase()} examples available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {byCategory[cat].map((ex) => (
                      <StaticExampleCard key={ex.id} example={ex} />
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
