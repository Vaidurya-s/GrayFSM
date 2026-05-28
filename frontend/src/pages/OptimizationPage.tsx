import { Suspense, useState, useEffect } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../components/ui';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { useFSM } from '../hooks/useFSM';
import { useOptimize, useOptimizationResults } from '../hooks/useOptimization';
import { useFSMStore } from '../store/fsmStore';
import OptimizationForm from '../components/forms/OptimizationForm';
import HammingChart from '../components/visualization/HammingChart';
import FSMCanvas from '../components/fsm/FSMCanvas';
import ComparisonView from '../components/visualization/ComparisonView';
import MetricsDashboard from '../components/visualization/MetricsDashboard';
// Hypercube3D pulls in three.js + @react-three/* (~933 KB minified). The
// component only renders on the "Hypercube" tab of the optimization
// results page — almost no users hit this path on first load. Lazy-load
// it so three.js doesn't bloat the initial bundle.
const Hypercube3D = lazyWithRetry(() => import('../components/visualization/Hypercube3D'));
import { ROUTES, generateRoute } from '../config/routes';
import { fsmAPI } from '../api/endpoints/fsms';
import { normalizeAlgorithmResultToOptimizationResponse } from '../api/normalize';
import type {
  AlgorithmResult,
  OptimizationRequest,
  OptimizationResponse,
  FSM,
} from '../types/fsm';
import type { APIResponse } from '../api/client';
import {
  Button,
  Card,
  Spinner,
  Alert,
  Kicktitle,
  CommandKey,
  CommandKeyRow,
  DataBlock,
} from '../components/ui';

type ResultTab = 'comparison' | 'metrics' | 'hypercube';

function computeNumBits(totalStates: number): number {
  if (totalStates <= 1) return 2;
  return Math.min(5, Math.max(2, Math.ceil(Math.log2(totalStates))));
}

export default function OptimizationPage() {
  const { id } = useParams<{ id: string }>();

  const { data: fsmResponse, isLoading, error } = useFSM(id);
  const optimizeMutation = useOptimize();
  const { loadFSMIntoDraft } = useFSMStore();
  const { success: toastSuccess, error: toastError } = useToast();

  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [originalFSM, setOriginalFSM] = useState<FSM | null>(null);
  const [optimizedFSM, setOptimizedFSM] = useState<FSM | null>(null);
  // Surfaces the failure mode when the post-optimization fetch of the
  // derived FSM fails (used by the comparison panel to render an error
  // instead of an infinite "Loading optimized FSM..." spinner).
  const [optimizedFSMError, setOptimizedFSMError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('comparison');

  // Load FSM into store for the canvas and capture it as originalFSM.
  // The apiClient interceptor already returns `response.data` (the wrapped
  // body), so fsmResponse IS `{ success, data: FSM, ... }` — pull off
  // `.data` once. The previous `response.data.data` indirection produced
  // an undefined FSM and silently broke the optimization flow.
  useEffect(() => {
    if (fsmResponse) {
      const wrapped = fsmResponse as unknown as APIResponse<FSM>;
      const fsm = wrapped?.data ?? (fsmResponse as unknown as FSM);
      if (fsm && typeof fsm === 'object' && 'id' in fsm) {
        loadFSMIntoDraft(fsm);
        setOriginalFSM(fsm);
      }
    }
  }, [fsmResponse, loadFSMIntoDraft]);

  // ----- Lab-report persistence ------------------------------------- //
  // After a user runs Optimize and navigates away, the local `result` /
  // `optimizedFSM` state is lost. On revisit we restore the most recent
  // past run from GET /fsms/:id/results so the report is always viewable
  // — no "re-run to see again" or empty graphs. The AlgorithmResult →
  // OptimizationResponse conversion lives in the normalization layer so
  // this component stays focused on render concerns.
  const { data: pastResultsResp } = useOptimizationResults(id);
  useEffect(() => {
    if (result || !pastResultsResp) return;
    const wrapped = pastResultsResp as unknown as APIResponse<AlgorithmResult[]>;
    const list = wrapped?.data ?? [];
    // Prefer a row with an optimized_fsm_id (so ComparisonView can render);
    // fall back to the most recent row otherwise so the metrics + charts
    // still come back even if the derived FSM was deleted.
    const latest = list.find((r) => r.optimized_fsm_id) ?? list[0];
    if (!latest) return;
    setResult(normalizeAlgorithmResultToOptimizationResponse(latest));
    if (latest.optimized_fsm_id) {
      fsmAPI
        .get(latest.optimized_fsm_id)
        .then((fsmResp) => {
          const w = fsmResp as unknown as APIResponse<FSM>;
          const optFSM = w?.data ?? (fsmResp as unknown as FSM);
          if (optFSM && typeof optFSM === 'object' && 'id' in optFSM) {
            setOptimizedFSM(optFSM);
          } else {
            setOptimizedFSMError('Optimized FSM response was empty.');
          }
        })
        .catch((e: unknown) => {
          const status = (e as { response?: { status?: number } })?.response?.status;
          const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail;
          setOptimizedFSMError(
            detail
              ? `Failed to load optimized FSM (${status ?? 'network'}): ${detail}`
              : `Failed to load optimized FSM${status ? ` (HTTP ${status})` : ''}.`,
          );
        });
    }
  }, [pastResultsResp, result]);

  const handleOptimize = async (request: OptimizationRequest) => {
    if (!id) return;
    try {
      const response = await optimizeMutation.mutateAsync({
        fsmId: id,
        request,
      });
      // apiClient interceptor returned response.data already, so `response`
      // IS { success, data: OptimizationResponse, ... }. Pull `.data` off
      // once — the previous double-unwrap left optimizationResult as the
      // outer envelope, so optimized_fsm_id/metrics were undefined and the
      // page stuck on "Loading optimized FSM…" with empty charts.
      const wrapped = response as unknown as APIResponse<OptimizationResponse>;
      const optimizationResult =
        wrapped?.data ?? (response as unknown as OptimizationResponse);
      setResult(optimizationResult);

      // Fetch optimized FSM immediately so ComparisonView has both sides ready
      setOptimizedFSM(null);
      setOptimizedFSMError(null);
      if (optimizationResult?.optimized_fsm_id) {
        const targetId = optimizationResult.optimized_fsm_id;
        try {
          const fsmResp = await fsmAPI.get(targetId);
          const fsmWrapped = fsmResp as unknown as APIResponse<FSM>;
          const optFSM = fsmWrapped?.data ?? (fsmResp as unknown as FSM);
          if (optFSM && typeof optFSM === 'object' && 'id' in optFSM) {
            setOptimizedFSM(optFSM);
          } else {
            // Dump the actual shape we received so the user (and we) can
            // see whether the body was null, double-wrapped, missing id,
            // etc. Capped at 240 chars to stay inside the Alert.
            const shape = (() => {
              try {
                return JSON.stringify(fsmResp).slice(0, 240);
              } catch {
                return String(fsmResp);
              }
            })();
            setOptimizedFSMError(
              `Optimized FSM response was empty for id=${targetId}. ` +
                `Body: ${shape}`,
            );
          }
        } catch (e) {
          // Surface the error in the comparison panel so a stuck fetch
          // doesn't leave the user staring at an infinite spinner.
          const status = (e as { response?: { status?: number } })?.response?.status;
          const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail;
          setOptimizedFSMError(
            detail
              ? `Failed to load optimized FSM (${status ?? 'network'}): ${detail}`
              : `Failed to load optimized FSM${status ? ` (HTTP ${status})` : ''}.`,
          );
        }
      } else {
        setOptimizedFSMError(
          'Optimization response did not include an optimized_fsm_id. ' +
            `Got: ${JSON.stringify(optimizationResult).slice(0, 240)}`,
        );
      }

      // Default to the comparison tab when results arrive
      setActiveTab('comparison');
      toastSuccess('Optimization complete');
    } catch (err) {
      // Surface the backend detail so the user can see why the run failed
      // (e.g. "column 'max_hamming_before' does not exist" after a missed
      // alembic upgrade, or a per-algorithm exception). Falls back to a
      // generic toast if no detail is present.
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toastError(detail ? `Optimization failed: ${detail}` : 'Optimization failed');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Spinner size="lg" className="mx-auto" />
            <p className="mt-4 text-sm text-ink-soft">Loading FSM...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !id) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="error" title={!id ? 'No FSM ID provided' : 'Failed to load FSM'}>
          {error instanceof Error ? error.message : 'Please select an FSM to optimize.'}
        </Alert>
        <div className="mt-4">
          <Link to={ROUTES.HOME}>
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-paper text-ink min-h-screen" data-testid="optimization-page">
      {/* Header */}
      <div className="mb-8">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint mb-3"
        >
          <Link to={ROUTES.HOME} className="hover:text-accent transition-colors">
            Catalog
          </Link>
          <span>›</span>
          <Link
            to={generateRoute(ROUTES.EDITOR_EDIT, { id })}
            className="hover:text-accent transition-colors"
          >
            Editor
          </Link>
          <span>›</span>
          <span className="text-ink">Optimise</span>
        </nav>
        <Kicktitle number="2" className="mb-2">
          Optimisation
        </Kicktitle>
        <h1 className="font-sans text-3xl sm:text-4xl font-semibold tracking-tight text-ink mb-2 pb-3 border-b-[2px] border-ink">
          A Lab Report.
        </h1>
        <p className="font-serif italic text-ink-soft text-base leading-relaxed mt-3 max-w-[44rem]">
          Apply Gray-code optimisation to minimise adjacent-state Hamming
          distance &mdash; eliminating output glitches caused by multi-bit
          register transitions during a single clock edge.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Main area */}
        <div className="lg:col-span-2">
          {!result ? (
            /* Before optimization: show the original FSM canvas */
            <Card variant="bordered" className="overflow-hidden">
              <div className="h-[500px]">
                <FSMCanvas readOnly />
              </div>
            </Card>
          ) : (
            /* After optimization: tabbed lab-report interface */
            <div className="bg-paper border border-ink flex flex-col">
              {/* Tab bar — datasheet aesthetic: mono uppercase, accent
               *  bottom rule on active, hairline divider below. */}
              <div className="flex border-b border-ink shrink-0">
                {(
                  [
                    { id: 'comparison', label: '2.1 · Comparison' },
                    { id: 'metrics',    label: '2.2 · Metrics' },
                    { id: 'hypercube',  label: '2.3 · Hypercube' },
                  ] as { id: ResultTab; label: string }[]
                ).map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      data-testid={`optimization-tab-${tab.id}`}
                      aria-current={active ? 'page' : undefined}
                      className={`flex-1 px-4 py-3 text-[0.78rem] font-mono font-medium uppercase tracking-[0.1em] transition-colors border-b-2 -mb-[1px] ${
                        active
                          ? 'text-ink border-accent bg-accent-tint'
                          : 'text-ink-soft border-transparent hover:text-ink hover:bg-paper-shade'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab panels */}
              <div className="flex-1 overflow-auto">
                {/* Comparison tab */}
                {activeTab === 'comparison' && (
                  <div className="h-[560px] p-4">
                    {originalFSM && optimizedFSM ? (
                      <ErrorBoundary>
                        <ComparisonView
                          originalFSM={originalFSM}
                          optimizedFSM={optimizedFSM}
                          metrics={result}
                        />
                      </ErrorBoundary>
                    ) : optimizedFSMError ? (
                      <div className="flex items-center justify-center h-full p-6">
                        <Alert variant="error" title="Optimized FSM unavailable">
                          {optimizedFSMError}{' '}
                          <span className="text-ink-soft">
                            Metrics, hypercube, and lab-report charts above are still
                            populated from the optimization result.
                          </span>
                        </Alert>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-ink-faint">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3" />
                          <p className="text-sm">Loading optimized FSM...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Metrics tab */}
                {activeTab === 'metrics' && (
                  <div className="p-6 overflow-y-auto max-h-[560px]">
                    <ErrorBoundary>
                      <MetricsDashboard metrics={result} />
                    </ErrorBoundary>
                  </div>
                )}

                {/* Hypercube tab */}
                {activeTab === 'hypercube' && (
                  <div className="h-[560px] p-4">
                    <ErrorBoundary>
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-full">
                            <Spinner />
                            <p className="ml-3 text-sm text-ink-soft">Loading 3D visualization…</p>
                          </div>
                        }
                      >
                        <Hypercube3D
                          numBits={computeNumBits(result.total_states)}
                          highlightedStates={
                            result.encoding_map
                              ? Object.values(result.encoding_map)
                              : (originalFSM?.states ?? [])
                          }
                          transitions={originalFSM?.transitions ?? []}
                        />
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls & Results */}
        <div className="space-y-6">
          {/* Optimization Form */}
          <Card
            variant="bordered"
            header={
              <h2 className="text-lg font-semibold text-ink">
                Optimization Settings
              </h2>
            }
          >
            <OptimizationForm
              onSubmit={handleOptimize}
              isLoading={optimizeMutation.isPending}
            />
            {optimizeMutation.isError && (
              <Alert variant="error" className="mt-4">
                Optimization failed.{' '}
                {optimizeMutation.error instanceof Error
                  ? optimizeMutation.error.message
                  : 'The backend may not support this operation yet.'}
              </Alert>
            )}
          </Card>

          {/* Results — aria-live so screen readers announce optimization completion */}
          <div aria-live="polite" aria-atomic="true">
          {result && (
            <Card
              variant="bordered"
              header={
                <div className="flex items-baseline justify-between gap-3">
                  <Kicktitle number="2.4">Lab report</Kicktitle>
                  <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-faint">
                    just now
                  </span>
                </div>
              }
            >
              {/* Run parameters — datasheet key/value */}
              <DataBlock
                items={[
                  {
                    label: 'Algorithm',
                    value: result.algorithm?.toUpperCase() ?? '—',
                    tone: 'accent',
                  },
                  {
                    label: 'Execution',
                    value: (
                      <>
                        <span className="font-tabular">
                          {result.execution_time_ms}
                        </span>
                        <span className="text-ink-faint ml-1">ms</span>
                      </>
                    ),
                  },
                  {
                    label: 'Total states',
                    value: (
                      <span className="font-tabular">{result.total_states}</span>
                    ),
                  },
                  {
                    label: 'Dummy added',
                    value: (
                      <span className="font-tabular">
                        {result.dummy_states_added}
                      </span>
                    ),
                    tone: result.dummy_states_added > 0 ? 'warn' : 'ok',
                  },
                ]}
                className="mb-5"
              />

              <HammingChart
                avgBefore={result.metrics?.avg_hamming_before ?? 0}
                avgAfter={result.metrics?.avg_hamming_after ?? 0}
                statesBefore={result.total_states - result.dummy_states_added}
                statesAfter={result.total_states}
                dummyStatesAdded={result.dummy_states_added}
                improvementPct={result.improvement_percentage}
              />

              {/* Actions — datasheet command keys */}
              <div
                className="mt-5 pt-4 border-t border-rule"
                data-testid="optimization-actions"
              >
                <CommandKeyRow>
                  <CommandKey
                    primary
                    keyGlyph="↳"
                    to={`/export/${id}?optimized=true`}
                  >
                    Export
                  </CommandKey>
                  <CommandKey
                    keyGlyph="←"
                    to={generateRoute(ROUTES.EDITOR_EDIT, { id: id! })}
                  >
                    Editor
                  </CommandKey>
                </CommandKeyRow>
              </div>
              {/* Backwards-compat data-testid anchors so existing tests still
               *  resolve the export / back-to-editor links by id. */}
              <Link
                to={`/export/${id}?optimized=true`}
                data-testid="optimization-export-link"
                aria-hidden
                className="sr-only"
              />
              <Link
                to={generateRoute(ROUTES.EDITOR_EDIT, { id: id! })}
                data-testid="optimization-back-to-editor"
                aria-hidden
                className="sr-only"
              />
            </Card>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
