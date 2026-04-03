import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { stageColors, statusColors, cn } from '../../lib/utils';
import { Shield, Plus, X, Code, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function PoliciesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', stage: 'assess', severity: 'warning', source: '' });
  const [createMode, setCreateMode] = useState<'json' | 'dsl'>('json');

  const { data: policies, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => api.get<any[]>('/policies'),
  });

  const create = useMutation({
    mutationFn: () => {
      if (createMode === 'dsl' && form.source) {
        return api.post('/policies/from-dsl', { source: form.source });
      }
      return api.post('/policies', { name: form.name, description: form.description, stage: form.stage, severity: form.severity, rules: [] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      setShowCreate(false);
      setForm({ name: '', description: '', stage: 'assess', severity: 'warning', source: '' });
      toast.success('Policy created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/policies/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policies'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/policies/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['policies'] }); toast.success('Policy deleted'); },
  });

  const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Governance gates evaluated during stage transitions"
        actions={
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> New Policy</>}
          </Button>
        }
      />

      {showCreate && (
        <Card className="p-5 mb-5 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setCreateMode('json')} className={cn('text-xs px-2.5 py-1 rounded transition-colors', createMode === 'json' ? 'bg-surface-3 text-text-primary' : 'text-text-muted hover:text-text-secondary')}>
              Manual
            </button>
            <button onClick={() => setCreateMode('dsl')} className={cn('text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1', createMode === 'dsl' ? 'bg-surface-3 text-text-primary' : 'text-text-muted hover:text-text-secondary')}>
              <Code className="w-3 h-3" /> DSL
            </button>
          </div>

          {createMode === 'dsl' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Policy DSL Source</label>
                <textarea value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={cn(inputClass, 'font-mono text-xs resize-none h-32')} placeholder={'policy "deploy-gate" on release blocking {\n  require evidence.test_result >= 1\n  require tasks.done_ratio >= 0.9\n}'} />
              </div>
              <Button size="sm" onClick={() => create.mutate()} disabled={!form.source || create.isPending}>Compile & Create</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="deploy-gate" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Stage</label>
                  <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className={inputClass}>
                    {['assess', 'plan', 'build', 'release'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Ensure tests pass before deploy" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Severity</label>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className={inputClass}>
                  <option value="warning">Warning</option>
                  <option value="blocking">Blocking</option>
                </select>
              </div>
              <Button size="sm" onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create Policy</Button>
            </div>
          )}
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="h-5 w-5" /></div>
      ) : !policies?.length ? (
        <EmptyState icon={Shield} title="No policies" description="Create governance policies to enforce quality gates on stage transitions." action={{ label: 'Create Policy', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="space-y-1">
          {policies.map((p: any) => (
            <Card key={p.id} className="px-3 sm:px-4 py-3 flex items-center justify-between gap-2 group">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className={cn('w-2 h-2 rounded-full shrink-0', p.enabled ? 'bg-green-400' : 'bg-zinc-500')} />
                <div className="min-w-0">
                  <p className="text-sm font-mono text-text-primary truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-text-muted mt-0.5 truncate hidden sm:block">{p.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Badge className={cn(stageColors[p.stage], 'hidden sm:inline-flex')}>{p.stage}</Badge>
                <Badge className={p.severity === 'blocking' ? statusColors.failing : statusColors.pending}>
                  {p.severity}
                </Badge>
                <button
                  onClick={() => toggle.mutate({ id: p.id, enabled: !p.enabled })}
                  className={cn('p-1.5 rounded transition-colors', p.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-text-muted hover:bg-surface-3')}
                  title={p.enabled ? 'Disable' : 'Enable'}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remove.mutate(p.id)}
                  className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
