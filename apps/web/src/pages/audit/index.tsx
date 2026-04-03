import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { cn, formatDateTime } from '../../lib/utils';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';

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

  const inputClass = 'px-3 py-1.5 text-xs bg-surface-2 border border-edge rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 transition-colors';

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Complete event history across all entities"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
              className={inputClass}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'All entities' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-edge">
                <th className="px-4 py-2.5 font-medium text-text-muted text-left uppercase tracking-wider text-[10px]">Time</th>
                <th className="px-4 py-2.5 font-medium text-text-muted text-left uppercase tracking-wider text-[10px]">Actor</th>
                <th className="px-4 py-2.5 font-medium text-text-muted text-left uppercase tracking-wider text-[10px]">Event</th>
                <th className="px-4 py-2.5 font-medium text-text-muted text-left uppercase tracking-wider text-[10px]">Entity</th>
                <th className="px-4 py-2.5 font-medium text-text-muted text-left uppercase tracking-wider text-[10px]">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Spinner className="mx-auto h-4 w-4" />
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={ScrollText} title="No audit events" description="Events will appear here as actions are performed." />
                  </td>
                </tr>
              ) : (
                events.map((evt: any, i: number) => (
                  <tr key={evt.id || i} className="border-b border-edge hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap font-mono text-[11px]">
                      {formatDateTime(evt.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{evt.actor_name || 'System'}</td>
                    <td className="px-4 py-2.5">
                      <Badge>{evt.event}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-text-muted">{evt.entity_type}</span>
                      {evt.entity_id && evt.entity_type === 'flow' ? (
                        <Link to={`/flows/${evt.entity_id}`} className="ml-1.5 font-mono text-accent-cyan text-[10px] hover:underline">{evt.entity_id.slice(0, 8)}</Link>
                      ) : evt.entity_id && evt.flow_id ? (
                        <Link to={`/flows/${evt.flow_id}`} className="ml-1.5 font-mono text-accent-cyan text-[10px] hover:underline">{evt.entity_id.slice(0, 8)}</Link>
                      ) : evt.entity_id ? (
                        <span className="ml-1.5 font-mono text-text-muted text-[10px]">{evt.entity_id.slice(0, 8)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted max-w-xs truncate font-mono text-[10px]">
                      {evt.details ? JSON.stringify(evt.details) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-edge">
            <p className="text-[10px] text-text-muted font-mono tabular-nums">
              Page {pagination.page} of {pagination.total_pages}
            </p>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-3 h-3" />
                Prev
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.total_pages} onClick={() => setPage((p) => p + 1)}>
                Next
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
