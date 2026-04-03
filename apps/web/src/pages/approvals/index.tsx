import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { statusColors, cn, timeAgo } from '../../lib/utils';
import { CheckCircle2, XCircle, Clock, Users, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const WORKFLOW_LABELS: Record<string, string> = {
  sequential: 'Sequential',
  parallel: 'Parallel',
  any: 'Any One',
};

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const { data: pending, isLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => api.get<any[]>('/approvals/pending'),
  });

  const { data: detail } = useQuery({
    queryKey: ['approvals', selectedId],
    queryFn: () => api.get<any>(`/approvals/${selectedId}`),
    enabled: !!selectedId,
  });

  const respond = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      api.post(`/approvals/${id}/respond`, { decision, comment: comment || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setSelectedId(null);
      setComment('');
      toast.success('Response submitted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      <PageHeader title="Approvals" description="Review and respond to pending approval requests" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="lg:col-span-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">Pending Your Review</p>
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner className="h-5 w-5" /></div>
          ) : !pending?.length ? (
            <EmptyState icon={CheckCircle2} title="All caught up" description="No pending approvals." />
          ) : (
            <div className="space-y-1">
              {pending.map((a: any) => (
                <Card
                  key={a.id}
                  hover
                  active={selectedId === a.id}
                  className="px-4 py-3"
                  onClick={() => setSelectedId(a.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Link to={`/flows/${a.flow_id}`} onClick={(e) => e.stopPropagation()} className="text-sm text-text-primary hover:text-accent-cyan transition-colors">{a.flow_title || a.flow_id}</Link>
                      <p className="text-xs text-text-muted mt-0.5">
                        {a.entity_type} &middot; {a.requester_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{WORKFLOW_LABELS[a.workflow_type] || a.workflow_type}</Badge>
                      <span className="text-xs text-text-muted font-mono tabular-nums">{a.current_approvals}/{a.required_approvers}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted mt-1.5">{timeAgo(a.created_at)}</p>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selectedId && detail ? (
            <Card className="p-4 lg:sticky lg:top-4 animate-slide-in-right">
              <h3 className="text-xs font-medium text-text-primary mb-4">Approval Detail</h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-text-muted" />
                  <span className="text-text-muted">Type:</span>
                  <span className="text-text-secondary">{detail.entity_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3 text-text-muted" />
                  <span className="text-text-muted">Progress:</span>
                  <span className="text-text-secondary font-mono">{detail.current_approvals}/{detail.required_approvers}</span>
                </div>

                {detail.assignees?.length > 0 && (
                  <div className="pt-2 border-t border-edge">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Approvers</p>
                    <div className="space-y-1.5">
                      {detail.assignees.map((a: any) => {
                        const response = detail.responses?.find((r: any) => r.user_id === a.user_id);
                        return (
                          <div key={a.id} className="flex items-center justify-between">
                            <span className="text-text-secondary">{a.user_name || a.user_email}</span>
                            {response ? (
                              <Badge className={statusColors[response.decision]}>{response.decision}</Badge>
                            ) : (
                              <Badge>waiting</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-edge">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="w-3 h-3 text-text-muted" />
                    <span className="text-text-muted">Comment</span>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional comment..."
                    className="w-full px-2.5 py-2 bg-surface-2 border border-edge rounded-md text-xs text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent-cyan/40"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => respond.mutate({ id: selectedId, decision: 'approved' })}
                    disabled={respond.isPending}
                    className="flex-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => respond.mutate({ id: selectedId, decision: 'rejected' })}
                    disabled={respond.isPending}
                    className="flex-1"
                  >
                    <XCircle className="w-3 h-3" />
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-xs text-text-muted">Select an approval to review</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
