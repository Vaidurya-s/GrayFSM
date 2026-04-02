import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examplesAPI } from '../api/endpoints/examples';
import { ROUTES, generateRoute } from '../config/routes';
import { cn } from '../utils/cn';
import type { Example } from '../types/api';

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
};

export default function ExamplesPage() {
  const {
    data: examplesResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['examples'],
    queryFn: () => examplesAPI.list(),
  });

  const examples: Example[] = (() => {
    if (!examplesResponse) return [];
    if (Array.isArray(examplesResponse)) return examplesResponse;
    if (Array.isArray((examplesResponse as unknown as { data: Example[] })?.data))
      return (examplesResponse as unknown as { data: Example[] }).data;
    return [];
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="examples-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Example FSMs</h1>
        <p className="text-sm text-gray-600 mt-1">
          Learn from pre-built examples. Click any example to open it in the editor.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-sm text-red-800">Failed to load examples</p>
          <p className="text-xs text-red-600 mt-1">
            {error instanceof Error ? error.message : 'The examples endpoint may not be available yet.'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && examples.length === 0 && (
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No examples yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Example FSMs will be available soon. In the meantime, try creating your own!
          </p>

          {/* Static example cards for common FSMs */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            {[
              {
                name: 'Traffic Light Controller',
                description: 'A Moore machine that controls traffic lights with green, yellow, and red states.',
                category: 'Control Systems',
                difficulty: 'beginner',
              },
              {
                name: 'Elevator Controller',
                description: 'A Mealy machine modeling an elevator with floor states and up/down transitions.',
                category: 'Control Systems',
                difficulty: 'intermediate',
              },
              {
                name: '101 Sequence Detector',
                description: 'Detects the binary pattern 101 in a stream of input bits.',
                category: 'Sequence Detectors',
                difficulty: 'beginner',
              },
              {
                name: 'Vending Machine',
                description: 'A Moore machine modeling a vending machine that accepts coins.',
                category: 'Digital Logic',
                difficulty: 'intermediate',
              },
            ].map((ex, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">{ex.name}</h4>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      difficultyColors[ex.difficulty] || 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {ex.difficulty}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{ex.description}</p>
                <span className="text-xs text-gray-400">{ex.category}</span>
              </div>
            ))}
          </div>

          <Link
            to={ROUTES.EDITOR_NEW}
            className="mt-6 inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Create Your Own FSM
          </Link>
        </div>
      )}

      {/* Example cards */}
      {examples.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {examples.map((example) => (
            <Link
              key={example.id}
              to={generateRoute(ROUTES.EXAMPLE_DETAIL, { id: example.id })}
              data-testid={`example-card-${example.id}`}
              className="bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow p-6 block"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">{example.name}</h3>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    difficultyColors[example.difficulty] || 'bg-gray-100 text-gray-800'
                  )}
                >
                  {example.difficulty}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{example.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{example.category}</span>
                <div className="flex flex-wrap gap-1">
                  {example.tags.slice(0, 2).map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
