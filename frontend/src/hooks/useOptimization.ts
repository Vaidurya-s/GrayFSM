import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { algorithmAPI } from '../api/endpoints/algorithms';
import type { OptimizationRequest } from '../types/fsm';
import { fsmKeys } from './useFSM';

export const optimizationKeys = {
  all: ['optimization'] as const,
  results: (fsmId: string) => [...optimizationKeys.all, 'results', fsmId] as const,
  result: (fsmId: string, algorithm?: string) =>
    [...optimizationKeys.results(fsmId), algorithm] as const,
};

export function useOptimize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fsmId,
      request,
    }: {
      fsmId: string;
      request: OptimizationRequest;
    }) => algorithmAPI.optimize(fsmId, request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: optimizationKeys.results(variables.fsmId),
      });
      queryClient.invalidateQueries({
        queryKey: fsmKeys.detail(variables.fsmId),
      });
    },
  });
}

export function useOptimizationResults(fsmId: string | undefined, algorithm?: string) {
  return useQuery({
    queryKey: optimizationKeys.result(fsmId!, algorithm),
    queryFn: () => algorithmAPI.getResults(fsmId!, algorithm),
    enabled: !!fsmId,
  });
}

export function useCompareAlgorithms() {
  return useMutation({
    mutationFn: ({
      fsmId,
      algorithms,
      options,
    }: {
      fsmId: string;
      algorithms: string[];
      options?: Record<string, unknown>;
    }) => algorithmAPI.compare(fsmId, algorithms, options),
  });
}
