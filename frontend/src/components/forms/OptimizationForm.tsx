import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SUPPORTED_ALGORITHMS } from '../../config/constants';
import type { OptimizationRequest } from '../../types/fsm';

const optimizationSchema = z.object({
  algorithm: z.enum(['greedy', 'bfs_optimal', 'global_sa', 'global_ga']),
  timeout_ms: z.number().min(1000).max(60000).optional(),
  iterations: z.number().min(1).max(100000).optional(),
  temperature: z.number().min(0).max(10000).optional(),
  cooling_rate: z.number().min(0).max(1).optional(),
});

type OptFormValues = z.infer<typeof optimizationSchema>;

interface OptimizationFormProps {
  onSubmit: (request: OptimizationRequest) => void;
  isLoading: boolean;
}

export default function OptimizationForm({ onSubmit, isLoading }: OptimizationFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OptFormValues>({
    resolver: zodResolver(optimizationSchema),
    defaultValues: {
      algorithm: 'greedy',
      timeout_ms: 30000,
    },
  });

  const selectedAlgorithm = watch('algorithm');
  const showAdvanced = selectedAlgorithm === 'global_sa' || selectedAlgorithm === 'global_ga';

  const handleFormSubmit = (values: OptFormValues) => {
    const request: OptimizationRequest = {
      algorithm: values.algorithm,
      options: {
        timeout_ms: values.timeout_ms,
        ...(values.iterations ? { iterations: values.iterations } : {}),
        ...(values.temperature ? { temperature: values.temperature } : {}),
        ...(values.cooling_rate ? { cooling_rate: values.cooling_rate } : {}),
      },
    };
    onSubmit(request);
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-4"
      data-testid="optimization-form"
    >
      <div>
        <label htmlFor="algorithm" className="block text-sm font-medium text-ink-soft">
          Algorithm
        </label>
        <select
          {...register('algorithm')}
          id="algorithm"
          data-testid="optimization-algorithm-select"
          className="mt-1 block w-full px-3 py-2 border border-rule-strong rounded-md shadow-sm focus:ring-accent focus:border-accent text-sm"
        >
          {SUPPORTED_ALGORITHMS.map((algo) => (
            <option key={algo.value} value={algo.value}>
              {algo.label} -- {algo.description}
            </option>
          ))}
        </select>
        {errors.algorithm && (
          <p className="mt-1 text-xs text-red-600">{errors.algorithm.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="timeout_ms" className="block text-sm font-medium text-ink-soft">
          Timeout (ms)
        </label>
        <input
          {...register('timeout_ms', { valueAsNumber: true })}
          id="timeout_ms"
          type="number"
          data-testid="optimization-timeout"
          className="mt-1 block w-full px-3 py-2 border border-rule-strong rounded-md shadow-sm focus:ring-accent focus:border-accent text-sm"
        />
      </div>

      {showAdvanced && (
        <div className="border-t border-rule pt-4 space-y-3">
          <h4 className="text-sm font-medium text-ink-soft">Advanced Options</h4>
          {selectedAlgorithm === 'global_sa' && (
            <>
              <div>
                <label htmlFor="temperature" className="block text-xs text-ink-soft">
                  Initial Temperature
                </label>
                <input
                  {...register('temperature', { valueAsNumber: true })}
                  id="temperature"
                  type="number"
                  step="0.1"
                  data-testid="optimization-temperature"
                  className="mt-1 block w-full px-3 py-1.5 border border-rule-strong rounded-md text-sm"
                  placeholder="1000"
                />
              </div>
              <div>
                <label htmlFor="cooling_rate" className="block text-xs text-ink-soft">
                  Cooling Rate (0-1)
                </label>
                <input
                  {...register('cooling_rate', { valueAsNumber: true })}
                  id="cooling_rate"
                  type="number"
                  step="0.001"
                  data-testid="optimization-cooling-rate"
                  className="mt-1 block w-full px-3 py-1.5 border border-rule-strong rounded-md text-sm"
                  placeholder="0.995"
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor="iterations" className="block text-xs text-ink-soft">
              Max Iterations
            </label>
            <input
              {...register('iterations', { valueAsNumber: true })}
              id="iterations"
              type="number"
              data-testid="optimization-iterations"
              className="mt-1 block w-full px-3 py-1.5 border border-rule-strong rounded-md text-sm"
              placeholder="10000"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        data-testid="optimization-submit"
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Optimizing...
          </span>
        ) : (
          'Run Optimization'
        )}
      </button>
    </form>
  );
}
