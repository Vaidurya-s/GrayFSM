import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fsmAPI } from '../api/endpoints/fsms';
import type { FSMCreate, FSMUpdate } from '../types/fsm';
import type { FSMListParams } from '../types/api';

export const fsmKeys = {
  all: ['fsms'] as const,
  lists: () => [...fsmKeys.all, 'list'] as const,
  list: (params?: FSMListParams) => [...fsmKeys.lists(), params] as const,
  details: () => [...fsmKeys.all, 'detail'] as const,
  detail: (id: string) => [...fsmKeys.details(), id] as const,
};

export function useFSMs(params?: FSMListParams) {
  return useQuery({
    queryKey: fsmKeys.list(params),
    queryFn: () => fsmAPI.list(params),
  });
}

export function useFSM(id: string | undefined) {
  return useQuery({
    queryKey: fsmKeys.detail(id!),
    queryFn: () => fsmAPI.get(id!),
    enabled: !!id,
  });
}

export function useCreateFSM() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FSMCreate) => fsmAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fsmKeys.lists() });
    },
  });
}

export function useUpdateFSM() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FSMUpdate }) =>
      fsmAPI.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: fsmKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: fsmKeys.lists() });
    },
  });
}

export function useDeleteFSM() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fsmAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fsmKeys.lists() });
    },
  });
}

export function useForkFSM() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      fsmAPI.fork(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fsmKeys.lists() });
    },
  });
}
