import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useArtifacts(flowId: string) {
  return useQuery({
    queryKey: ['artifacts', { flowId }],
    queryFn: () => api.get<any[]>(`/flows/${flowId}/artifacts`),
    enabled: !!flowId,
  });
}

export function useArtifact(artifactId: string) {
  return useQuery({
    queryKey: ['artifacts', artifactId],
    queryFn: () => api.get<any>(`/artifacts/${artifactId}`),
    enabled: !!artifactId,
  });
}

export function useGenerateArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, ...data }: { flowId: string; type: string; context?: any }) =>
      api.post(`/flows/${flowId}/artifacts/generate`, data),
    onSuccess: (_, { flowId }) => qc.invalidateQueries({ queryKey: ['artifacts', { flowId }] }),
  });
}

export function useApproveArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (artifactId: string) => api.post(`/artifacts/${artifactId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['artifacts'] }),
  });
}
