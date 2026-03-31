import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useFlows(params?: Record<string, string>) {
  const searchParams = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['flows', params],
    queryFn: () => api.get<{ data: any[]; pagination: any }>(`/flows${searchParams}`),
  });
}

export function useFlow(flowId: string) {
  return useQuery({
    queryKey: ['flows', flowId],
    queryFn: () => api.get<any>(`/flows/${flowId}`),
    enabled: !!flowId,
  });
}

export function useCreateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/flows', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });
}

export function useTransitionFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, ...data }: { flowId: string; to_stage: string; reason?: string }) =>
      api.post(`/flows/${flowId}/transition`, data),
    onSuccess: (_, { flowId }) => {
      qc.invalidateQueries({ queryKey: ['flows', flowId] });
      qc.invalidateQueries({ queryKey: ['flows'] });
    },
  });
}

export function useFlowReadiness(flowId: string) {
  return useQuery({
    queryKey: ['flows', flowId, 'readiness'],
    queryFn: () => api.get<any>(`/flows/${flowId}/readiness`),
    enabled: !!flowId,
  });
}

export function useFlowTrace(flowId: string) {
  return useQuery({
    queryKey: ['flows', flowId, 'trace'],
    queryFn: () => api.get<any>(`/flows/${flowId}/trace`),
    enabled: !!flowId,
  });
}

export function useFlowGaps(flowId: string) {
  return useQuery({
    queryKey: ['flows', flowId, 'gaps'],
    queryFn: () => api.get<any>(`/flows/${flowId}/gaps`),
    enabled: !!flowId,
  });
}
