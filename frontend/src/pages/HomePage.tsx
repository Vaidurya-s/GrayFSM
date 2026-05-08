import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { FSM } from '../types/fsm'
import { Button, Card, Badge } from '../components/ui'

export default function HomePage() {
  const [selectedFSM, setSelectedFSM] = useState<FSM | null>(null)

  // The axios response interceptor in api/client.ts already unwraps
  // `response.data` from the AxiosResponse envelope at runtime, but TS's
  // axios typings still claim AxiosResponse<T>. These narrowing helpers
  // accept either shape and return the actual payload.
  const unwrapList = <T,>(r: unknown): T[] => {
    if (Array.isArray(r)) return r as T[]
    if (r && typeof r === 'object' && 'data' in r && Array.isArray((r as { data: unknown }).data)) {
      return (r as { data: T[] }).data
    }
    return []
  }
  const unwrap = <T,>(r: unknown, fallback: T): T => {
    if (r && typeof r === 'object' && 'data' in r) return (r as { data: T }).data
    return (r as T) ?? fallback
  }

  const { data: fsms, isLoading, error } = useQuery({
    queryKey: ['fsms'],
    queryFn: async () => unwrapList<FSM>(await api.get('/fsms?limit=10')),
    retry: 1,
  })

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => unwrap<{ status: string; message: string }>(
      await api.get('/health'),
      { status: 'unknown', message: '' },
    ),
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold">Optimize Your FSMs</h1>
          <p className="mt-2 text-blue-100 max-w-2xl">
            Design finite state machines and apply Gray code optimization to minimize
            glitches and race conditions in hardware implementations.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link to="/editor/new">
              <Button
                variant="secondary"
                size="lg"
                className="bg-white text-blue-700 hover:bg-blue-50 border-transparent"
              >
                Create New FSM
              </Button>
            </Link>
            <Link to="/examples">
              <Button
                variant="outline"
                size="lg"
                className="border-blue-300 text-white hover:bg-blue-700 bg-transparent"
              >
                View Examples
              </Button>
            </Link>
            {healthData && (
              <span className="ml-auto flex items-center gap-2 text-sm text-blue-200">
                <Badge
                  variant={healthData.status === 'healthy' ? 'success' : 'danger'}
                  size="sm"
                  className="bg-opacity-80"
                >
                  {healthData.status === 'healthy' ? 'API Connected' : 'API Offline'}
                </Badge>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* FSM List */}
          <div className="lg:col-span-1">
            <Card header={<h2 className="text-lg font-semibold text-gray-900">Your FSMs</h2>}>
              <div>

              {isLoading && (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-gray-200 h-16 rounded" />
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center">
                  <p className="text-sm text-gray-600">Backend not connected</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Start the API server to manage FSMs
                  </p>
                </div>
              )}

              {fsms && fsms.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No FSMs found</p>
                  <p className="text-xs mt-2">Create your first FSM to get started</p>
                </div>
              )}

              {fsms && fsms.length > 0 && (
                <div className="space-y-2">
                  {fsms.map((fsm: FSM) => (
                    <button
                      key={fsm.id}
                      onClick={() => setSelectedFSM(fsm)}
                      className={`w-full text-left p-3 rounded border-2 transition-colors ${
                        selectedFSM?.id === fsm.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{fsm.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {fsm.state_count} states • {fsm.transition_count} transitions
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="default" size="sm">{fsm.fsm_type}</Badge>
                        {fsm.is_optimized && (
                          <Badge variant="success" size="sm">Optimized</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              </div>
            </Card>
          </div>

          {/* FSM Details */}
          <div className="lg:col-span-2">
            <Card>
              {!selectedFSM ? (
                <div className="text-center py-12 text-gray-500">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-4 text-sm">Select an FSM to view details</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedFSM.name}</h2>
                      {selectedFSM.description && (
                        <p className="text-sm text-gray-600 mt-1">{selectedFSM.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedFSM.state_count}</div>
                      <div className="text-sm text-gray-600">States</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedFSM.transition_count}</div>
                      <div className="text-sm text-gray-600">Transitions</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedFSM.bit_width}</div>
                      <div className="text-sm text-gray-600">Bit Width</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedFSM.is_optimized ? selectedFSM.dummy_state_count : 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Dummy States</div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">FSM Details</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <dt className="text-gray-600">Type:</dt>
                        <dd className="text-gray-900 font-medium">{selectedFSM.fsm_type}</dd>
                      </div>
                      <div className="flex justify-between text-sm">
                        <dt className="text-gray-600">Initial State:</dt>
                        <dd className="text-gray-900 font-medium">{selectedFSM.initial_state}</dd>
                      </div>
                      <div className="flex justify-between text-sm">
                        <dt className="text-gray-600">Encoding:</dt>
                        <dd className="text-gray-900 font-medium">{selectedFSM.encoding_type}</dd>
                      </div>
                      {selectedFSM.is_optimized && selectedFSM.optimization_algorithm && (
                        <div className="flex justify-between text-sm">
                          <dt className="text-gray-600">Algorithm:</dt>
                          <dd className="text-gray-900 font-medium">{selectedFSM.optimization_algorithm}</dd>
                        </div>
                      )}
                      {selectedFSM.avg_hamming_distance && (
                        <div className="flex justify-between text-sm">
                          <dt className="text-gray-600">Avg Hamming Distance:</dt>
                          <dd className="text-gray-900 font-medium">{selectedFSM.avg_hamming_distance}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {selectedFSM.tags && selectedFSM.tags.length > 0 && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedFSM.tags.map((tag, index) => (
                          <Badge key={index} variant="info">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="bordered">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Visual Editor</h3>
            <p className="text-xs text-gray-500">
              Drag-and-drop FSM designer with real-time state and transition editing.
            </p>
          </Card>
          <Card variant="bordered">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Gray Code Optimization</h3>
            <p className="text-xs text-gray-500">
              Minimize glitches with single-bit state transitions via hypercube pathfinding.
            </p>
          </Card>
          <Card variant="bordered">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">HDL Export</h3>
            <p className="text-xs text-gray-500">
              Export optimized FSMs to synthesizable Verilog, VHDL, or testbench formats.
            </p>
          </Card>
        </div>
      </main>
    </div>
  )
}
