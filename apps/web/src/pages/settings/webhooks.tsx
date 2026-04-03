import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { statusColors, cn, formatDateTime } from '../../lib/utils';
import { Webhook, Plus, X, Power, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';

const ALL_EVENTS = [
  'flow.created', 'flow.updated', 'flow.stage_changed',
  'artifact.generated', 'artifact.approved',
  'evidence.collected', 'task.updated',
  'policy.evaluated', 'approval.requested', 'approval.granted', 'approval.rejected',
];

const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

export function WebhooksSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [form, setForm] = useState({ url: '', description: '', events: [] as string[], secret: '' });

  const { data: webhooks } = useQuery({ queryKey: ['webhooks'], queryFn: () => api.get<any[]>('/webhooks') });
  const { data: deliveries } = useQuery({
    queryKey: ['webhooks', selectedWebhook, 'deliveries'],
    queryFn: () => api.get<any[]>(`/webhooks/${selectedWebhook}/deliveries`),
    enabled: !!selectedWebhook,
  });

  const create = useMutation({
    mutationFn: () => api.post('/webhooks', { url: form.url, description: form.description || undefined, events: form.events, secret: form.secret || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowForm(false);
      setForm({ url: '', description: '', events: [], secret: '' });
      toast.success('Webhook created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/webhooks/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/webhooks/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setSelectedWebhook(null); toast.success('Deleted'); },
  });

  const toggleEvent = (event: string) => {
    setForm((f) => ({ ...f, events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event] }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-text-primary">Outbound Webhooks</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Webhook</>}
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 mb-4 animate-slide-up">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">URL</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={inputClass} placeholder="https://example.com/webhook" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Secret <span className="text-text-muted">(HMAC)</span></label>
                <input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} className={inputClass} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Events</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_EVENTS.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-medium transition-all',
                      form.events.includes(event)
                        ? 'bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/30'
                        : 'bg-surface-3 text-text-muted hover:text-text-secondary',
                    )}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={() => create.mutate()} disabled={!form.url || form.events.length === 0 || create.isPending}>
              Create Webhook
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {!webhooks?.length ? (
            <EmptyState icon={Webhook} title="No webhooks" description="Set up webhooks to notify external systems." action={{ label: 'Add', onClick: () => setShowForm(true) }} />
          ) : (
            <div className="space-y-1">
              {webhooks.map((w: any) => (
                <Card key={w.id} hover active={selectedWebhook === w.id} className="px-4 py-3" onClick={() => setSelectedWebhook(w.id)}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-text-primary truncate">{w.url}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{w.description || `${w.events?.length || 0} events`}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      {w.failure_count > 0 && <Badge className={statusColors.failing}>{w.failure_count} fails</Badge>}
                      <Badge className={w.enabled ? statusColors.active : statusColors.disabled}>{w.enabled ? 'Active' : 'Off'}</Badge>
                      <button onClick={(e) => { e.stopPropagation(); toggle.mutate({ id: w.id, enabled: !w.enabled }); }}
                        className={cn('p-1 rounded transition-colors', w.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-text-muted hover:bg-surface-3')}>
                        <Power className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); remove.mutate(w.id); }}
                        className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          {selectedWebhook && deliveries ? (
            <Card className="p-4 lg:sticky lg:top-4 animate-slide-in-right">
              <h3 className="text-xs font-medium text-text-primary mb-3 flex items-center gap-1.5">
                <Send className="w-3 h-3 text-text-muted" /> Recent Deliveries
              </h3>
              {deliveries.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">No deliveries yet</p>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {deliveries.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between text-[10px] py-1.5 border-b border-edge last:border-0">
                      <div>
                        <p className="text-text-secondary font-medium">{d.event_type}</p>
                        <p className="text-text-muted font-mono">{formatDateTime(d.attempted_at)}</p>
                      </div>
                      <Badge className={d.success ? statusColors.passing : statusColors.failing}>
                        {d.success ? d.status_code : 'Fail'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-xs text-text-muted">Select a webhook to see deliveries</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
