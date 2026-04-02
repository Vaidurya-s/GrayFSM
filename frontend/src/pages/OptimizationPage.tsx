import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFSM } from '../hooks/useFSM';
import { useOptimize } from '../hooks/useOptimization';
import { useFSMStore } from '../store/fsmStore';
import OptimizationForm from '../components/forms/OptimizationForm';
import HammingChart from '../components/visualization/HammingChart';
import FSMCanvas from '../components/fsm/FSMCanvas';
import { ROUTES, generateRoute } from '../config/routes';
import { fsmAPI } from '../api/endpoints/fsms';
import type { OptimizationRequest, OptimizationResponse, FSM } from '../types/fsm';
import type { APIResponse } from '../api/client';
import type { AxiosResponse } from 'axios';

export default function OptimizationPage() {
  const { id } = useParams<{ id: string }>();

  const { data: fsmResponse, isLoading, error } = useFSM(id);
  const optimizeMutation = useOptimize();
  const { loadFSMIntoDraft } = useFSMStore();

  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [showOptimized, setShowOptimized] = useState(false);

  // Load FSM into store for the canvas
  useEffect(() => {
    if (fsmResponse) {
      // At runtime fsmResponse is AxiosResponse<APIResponse<FSM>>, so .data.data is the FSM
      const axiosResp = fsmResponse as unknown as AxiosResponse<APIResponse<FSM>>;
      const fsm = axiosResp.data?.data ?? (fsmResponse as unknown as FSM);
      if (fsm && typeof fsm === 'object' && 'id' in fsm) {
        loadFSMIntoDraft(fsm);
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
    } catch {
      // Error handled by React Query
    }
  };

  const handleViewOptimized = async () => {
    if (!result?.optimized_fsm_id) return;
    try {
      const fsmResp = await fsmAPI.get(result.optimized_fsm_id);
      const axiosResp = fsmResp as unknown as AxiosResponse<APIResponse<FSM>>;
      const optimizedFSM = axiosResp.data?.data ?? (fsmResp as unknown as FSM);
      if (optimizedFSM && typeof optimizedFSM === 'object' && 'id' in optimizedFSM) {
        loadFSMIntoDraft(optimizedFSM);
        setShowOptimized(true);
      }
    } catch {
      // Silently fail — user can retry
    }
  };

  const handleViewOriginal = () => {
    if (fsmResponse) {
      const axiosResp = fsmResponse as unknown as AxiosResponse<APIResponse<FSM>>;
      const fsm = axiosResp.data?.data ?? (fsmResponse as unknown as FSM);
      if (fsm && typeof fsm === 'object' && 'id' in fsm) {
        loadFSMIntoDraft(fsm);
      }
      setShowOptimized(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-sm text-gray-600">Loading FSM...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !id) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800">
            {!id ? 'No FSM ID provided' : 'Failed to load FSM'}
          </h2>
          <p className="text-sm text-red-600 mt-2">
            {error instanceof Error ? error.message : 'Please select an FSM to optimize.'}
          </p>
          <Link
            to={ROUTES.HOME}
            className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Go Home
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
        {/* Left: FSM Visualization */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow border border-gray-200">
            {/* Toggle bar */}
            {result && (
              <div className="flex border-b border-gray-200">
                <button
                  onClick={handleViewOriginal}
                  data-testid="optimization-view-original"
                  className={`flex-1 px-4 py-2 text-sm font-medium ${
                    !showOptimized
                      ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={handleViewOptimized}
                  data-testid="optimization-view-optimized"
                  className={`flex-1 px-4 py-2 text-sm font-medium ${
                    showOptimized
                      ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Optimized
                </button>
              </div>
            )}
            <div className="h-[500px]">
              <FSMCanvas readOnly />
            </div>
          </div>
        </div>

        {/* Right: Controls & Results */}
        <div className="space-y-6">
          {/* Optimization Form */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Optimization Settings
            </h2>
            <OptimizationForm
              onSubmit={handleOptimize}
              isLoading={optimizeMutation.isPending}
            />
            {optimizeMutation.isError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-800">
                  Optimization failed.{' '}
                  {optimizeMutation.error instanceof Error
                    ? optimizeMutation.error.message
                    : 'The backend may not support this operation yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Results</h2>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Algorithm:</span>
                <span className="text-xs font-medium text-gray-900">
                  {result.algorithm}
                </span>
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
                  className="block w-full text-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Export Optimized FSM
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
