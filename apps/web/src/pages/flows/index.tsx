import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFlows, useCreateFlow } from '../../hooks/use-flows';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { PageHeader } from '../../components/ui/page-header';
import { EmptyState } from '../../components/ui/empty-state';
import { stageColors, priorityColors, stageDotColors, cn, formatDate } from '../../lib/utils';
import { Plus, X, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

export function FlowListPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', sensitivity: 'low' });
  const { data, isLoading } = useFlows();
  const createFlow = useCreateFlow();
  const flows = data?.data || [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createFlow.mutateAsync(form);
      setShowCreate(false);
      setForm({ title: '', description: '', priority: 'medium', sensitivity: 'low' });
      toast.success('Flow created');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

  return (
    <div>
      <PageHeader
        title="Flows"
        description={`${flows.length} delivery flows`}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Flow
          </Button>
        }
      />

      {showCreate && (
        <Card className="p-5 mb-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-primary">Create Flow</h3>
            <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className={inputClass} placeholder="e.g. Payment API v2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={cn(inputClass, 'resize-none')} rows={2} placeholder="Brief description..." />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Sensitivity</label>
                <select value={form.sensitivity} onChange={(e) => setForm({ ...form, sensitivity: e.target.value })} className={inputClass}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="secondary" size="sm" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={createFlow.isPending}>
                {createFlow.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-1 border border-edge animate-pulse" />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <EmptyState icon={GitBranch} title="No flows yet" description="Create your first delivery flow to get started." action={{ label: 'Create Flow', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="space-y-1">
          {flows.map((flow: any) => (
            <Link key={flow.id} to={`/flows/${flow.id}`}>
              <Card hover className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', stageDotColors[flow.current_stage])} />
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">{flow.title}</p>
                    {flow.description && (
                      <p className="text-xs text-text-muted truncate mt-0.5">{flow.description.slice(0, 80)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2 sm:ml-4">
                  <span className="text-[10px] text-text-muted font-mono hidden sm:inline">{formatDate(flow.created_at)}</span>
                  <Badge className={priorityColors[flow.priority]}>{flow.priority}</Badge>
                  <Badge className={stageColors[flow.current_stage]}>{flow.current_stage}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
