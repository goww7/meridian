import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';

const ENTITY_TYPES = ['all', 'flow', 'artifact', 'requirement', 'task', 'evidence', 'policy'] as const;

export function AuditPage() {
  const [entityType, setEntityType] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 25;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (entityType !== 'all') params.set('entity_type', entityType);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', entityType, page],
    queryFn: () => api.get<{ data: any[]; pagination: any }>(`/audit?${params.toString()}`),
  });

  const events = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All Entities' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">Actor</th>
                <th className="px-4 py-3 font-medium text-slate-500">Event</th>
                <th className="px-4 py-3 font-medium text-slate-500">Entity</th>
                <th className="px-4 py-3 font-medium text-slate-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No audit events" description="Audit events will appear here as actions are performed." />
                  </td>
                </tr>
              ) : (
                events.map((evt: any, i: number) => (
                  <tr key={evt.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(evt.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{evt.actor_name || evt.actor_id || 'System'}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-slate-100 text-slate-700">{evt.event}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">{evt.entity_type}</span>
                      {evt.entity_id && (
                        <span className="ml-1 text-xs font-mono text-slate-400">{evt.entity_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">
                      {evt.details ? JSON.stringify(evt.details) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.total_pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Load more
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
