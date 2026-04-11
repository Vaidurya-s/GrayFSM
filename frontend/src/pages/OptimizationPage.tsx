import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { useFSM } from '../hooks/useFSM';
import { useOptimize } from '../hooks/useOptimization';
import { useFSMStore } from '../store/fsmStore';
import OptimizationForm from '../components/forms/OptimizationForm';
import HammingChart from '../components/visualization/HammingChart';
import FSMCanvas from '../components/fsm/FSMCanvas';
import ComparisonView from '../components/visualization/ComparisonView';
import MetricsDashboard from '../components/visualization/MetricsDashboard';
import Hypercube3D from '../components/visualization/Hypercube3D';
import { ROUTES, generateRoute } from '../config/routes';
import { fsmAPI } from '../api/endpoints/fsms';
import type { OptimizationRequest, OptimizationResponse, FSM } from '../types/fsm';
import type { APIResponse } from '../api/client';
import type { AxiosResponse } from 'axios';
import { Button, Card, Spinner, Alert, Badge } from '../components/ui';

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
  const [activeTab, setActiveTab] = useState<ResultTab>('comparison');

  // Load FSM into store for the canvas and capture it as originalFSM
  useEffect(() => {
    if (fsmResponse) {
      // At runtime fsmResponse is AxiosResponse<APIResponse<FSM>>, so .data.data is the FSM
      const axiosResp = fsmResponse as unknown as AxiosResponse<APIResponse<FSM>>;
      const fsm = axiosResp.data?.data ?? (fsmResponse as unknown as FSM);
      if (fsm && typeof fsm === 'object' && 'id' in fsm) {
        loadFSMIntoDraft(fsm);
        setOriginalFSM(fsm);
      }
    }
  }, [fsmResponse, loadFSMIntoDraft]);

  const handleOptimize = async (request: OptimizationRequest) => {
    if (!id) return;
    try {
      const response = await optimizeMutation.mutateAsync({
        fsmId: id,
        request,
      });
      // At runtime response is AxiosResponse<APIResponse<OptimizationResponse>>,
      // so response.data is { success: true, data: OptimizationResponse }
      // and response.data.data is the actual OptimizationResponse
      const axiosResp = response as unknown as AxiosResponse<APIResponse<OptimizationResponse>>;
      const optimizationResult = axiosResp.data?.data ?? (response as unknown as OptimizationResponse);
      setResult(optimizationResult);

      // Fetch optimized FSM immediately so ComparisonView has both sides ready
      if (optimizationResult?.optimized_fsm_id) {
        try {
          const fsmResp = await fsmAPI.get(optimizationResult.optimized_fsm_id);
          const fsmAxiosResp = fsmResp as unknown as AxiosResponse<APIResponse<FSM>>;
          const optFSM = fsmAxiosResp.data?.data ?? (fsmResp as unknown as FSM);
          if (optFSM && typeof optFSM === 'object' && 'id' in optFSM) {
            setOptimizedFSM(optFSM);
          }
        } catch {
          // Silently fail — ComparisonView tab will show a loading fallback
        }
      }

      // Default to the comparison tab when results arrive
      setActiveTab('comparison');
      toastSuccess('Optimization complete');
    } catch {
      toastError('Optimization failed');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Spinner size="lg" className="mx-auto" />
            <p className="mt-4 text-sm text-gray-600">Loading FSM...</p>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="optimization-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link to={ROUTES.HOME} className="hover:text-gray-700">
            Home
          </Link>
          <span>/</span>
          <Link
            to={generateRoute(ROUTES.EDITOR_EDIT, { id })}
            className="hover:text-gray-700"
          >
            Editor
          </Link>
          <span>/</span>
          <span className="text-gray-900">Optimize</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Optimize FSM</h1>
        <p className="text-sm text-gray-600 mt-1">
          Apply Gray code optimization to minimize glitches and race conditions.
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
            /* After optimization: tabbed interface */
            <div className="bg-white rounded-lg shadow border border-gray-200 flex flex-col">
              {/* Tab bar */}
              <div className="flex border-b border-gray-200 shrink-0">
                {(
                  [
                    { id: 'comparison', label: 'Comparison' },
                    { id: 'metrics', label: 'Metrics' },
                    { id: 'hypercube', label: 'Hypercube' },
                  ] as { id: ResultTab; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`optimization-tab-${tab.id}`}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
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
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-400">
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
                      <Hypercube3D
                        numBits={computeNumBits(result.total_states)}
                        highlightedStates={
                          result.encoding_map
                            ? Object.values(result.encoding_map)
                            : (originalFSM?.states ?? [])
                        }
                        transitions={originalFSM?.transitions ?? []}
                      />
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
              <h2 className="text-lg font-semibold text-gray-900">
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
              header={<h2 className="text-lg font-semibold text-gray-900">Results</h2>}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Algorithm:</span>
                <Badge variant="info" size="sm">{result.algorithm}</Badge>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Execution time:</span>
                <span className="text-xs font-medium text-gray-900">
                  {result.execution_time_ms}ms
                </span>
              </div>
              <HammingChart
                avgBefore={result.metrics.avg_hamming_before}
                avgAfter={result.metrics.avg_hamming_after}
                statesBefore={result.total_states - result.dummy_states_added}
                statesAfter={result.total_states}
                dummyStatesAdded={result.dummy_states_added}
                improvementPct={result.improvement_percentage}
              />

              {/* Export button */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  to={`/export/${id}?optimized=true`}
                  data-testid="optimization-export-link"
                >
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 focus:ring-green-500"
                  >
                    Export Optimized FSM
                  </Button>
                </Link>
              </div>
            </Card>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
