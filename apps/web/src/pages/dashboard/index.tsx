import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useFlows } from '../../hooks/use-flows';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { StatCard } from '../../components/ui/stat-card';
import { Card } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { stageColors, priorityColors, stageDotColors, cn } from '../../lib/utils';
import { GitBranch, Activity, Clock, FileCheck, ArrowRight, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STAGES = ['assess', 'plan', 'build', 'release', 'done'] as const;
const STAGE_CHART_COLORS: Record<string, string> = {
  assess: '#c4b5fd', plan: '#60a5fa', build: '#fbbf24', release: '#4ade80', done: '#a1a1aa',
};

export function DashboardPage() {
  const { data: flowsData, isLoading: flowsLoading } = useFlows();
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<any>('/analytics/overview'),
  });

  const flows = flowsData?.data || [];
  const loading = flowsLoading || analyticsLoading;

  const byStageCounts = flows.reduce((acc: Record<string, number>, f: any) => {
    acc[f.current_stage] = (acc[f.current_stage] || 0) + 1;
    return acc;
  }, {});

  const totalFlows = flows.length;
  const activeFlows = flows.filter((f: any) => f.current_stage !== 'done').length;
  const pendingApprovals = analytics?.pending_approvals ?? 0;
  const evidenceItems = analytics?.evidence_count ?? 0;

  const stageChartData = STAGES.map((s) => ({ name: s, count: byStageCounts[s] || 0 }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your delivery operations"
        actions={
          <Link to="/flows"><Button size="sm"><Plus className="w-3.5 h-3.5" /> New Flow</Button></Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 md:mb-6">
        <Link to="/flows"><StatCard label="Total Flows" value={totalFlows} icon={GitBranch} loading={loading} /></Link>
        <Link to="/flows"><StatCard label="Active" value={activeFlows} icon={Activity} accent="text-accent-cyan" loading={loading} /></Link>
        <Link to="/approvals"><StatCard label="Pending Approvals" value={pendingApprovals} icon={Clock} accent="text-amber-400" loading={loading} /></Link>
        <Link to="/analytics"><StatCard label="Evidence" value={evidenceItems} icon={FileCheck} accent="text-green-400" loading={loading} /></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Pipeline chart */}
        <Card className="lg:col-span-3 p-4 md:p-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-4">Pipeline Distribution</h2>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="animate-pulse h-32 w-full bg-surface-3 rounded" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stageChartData} barSize={32}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} width={24} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ background: '#1c1c20', border: '1px solid #363640', borderRadius: '6px', fontSize: '12px', color: '#fafafa' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stageChartData.map((entry) => (
                    <Cell key={entry.name} fill={STAGE_CHART_COLORS[entry.name] || '#71717a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Stage breakdown */}
        <Card className="lg:col-span-2 p-4 md:p-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-4">By Stage</h2>
          <div className="space-y-3">
            {STAGES.map((stage) => {
              const count = byStageCounts[stage] || 0;
              const pct = totalFlows ? Math.round((count / totalFlows) * 100) : 0;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className={cn('w-2 h-2 rounded-full', stageDotColors[stage])} />
                  <span className="text-xs text-text-secondary capitalize w-14">{stage}</span>
                  <div className="flex-1 bg-surface-3 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: STAGE_CHART_COLORS[stage] }}
                    />
                  </div>
                  <span className="text-xs font-mono text-text-muted w-6 text-right tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent Flows */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Recent Flows</h2>
          <Link to="/flows" className="text-[10px] text-accent-cyan hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-surface-1 border border-edge animate-pulse" />
            ))}
          </div>
        ) : flows.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-xs text-text-muted">
              No flows yet.{' '}
              <Link to="/flows" className="text-accent-cyan hover:text-cyan-300">Create your first flow</Link>
            </p>
          </Card>
        ) : (
          <div className="space-y-1">
            {flows.slice(0, 7).map((flow: any) => (
              <Link key={flow.id} to={`/flows/${flow.id}`}>
                <Card hover className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', stageDotColors[flow.current_stage])} />
                    <span className="text-sm text-text-primary truncate">{flow.title}</span>
                    <span className="text-xs text-text-muted truncate hidden sm:block">{flow.owner_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={priorityColors[flow.priority]}>{flow.priority}</Badge>
                    <Badge className={stageColors[flow.current_stage]}>{flow.current_stage}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
