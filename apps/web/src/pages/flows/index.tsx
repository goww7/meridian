import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFlows, useCreateFlow } from '../../hooks/use-flows';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { stageColors, priorityColors } from '../../lib/utils';
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Flows</h1>
        <Button onClick={() => setShowCreate(true)}>New Flow</Button>
      </div>

      {showCreate && (
        <Card className="p-6 mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-md" placeholder="e.g. Payment API v2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md" rows={3} />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Sensitivity</label>
                <select value={form.sensitivity} onChange={(e) => setForm({ ...form, sensitivity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createFlow.isPending}>
                {createFlow.isPending ? 'Creating...' : 'Create Flow'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <p className="text-slate-500">Loading flows...</p>
      ) : (
        <div className="space-y-2">
          {flows.map((flow: any) => (
            <Link key={flow.id} to={`/flows/${flow.id}`}>
              <Card className="p-4 hover:border-blue-300 transition-colors flex items-center justify-between">
                <div>
                  <p className="font-medium">{flow.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{flow.description?.slice(0, 100)}</p>
                </div>
                <div className="flex items-center gap-2">
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
