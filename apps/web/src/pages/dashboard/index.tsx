import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useFlows } from '../../hooks/use-flows';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { stageColors, priorityColors } from '../../lib/utils';

const STAGES = ['assess', 'plan', 'build', 'release', 'done'] as const;

const STAGE_BAR_COLORS: Record<string, string> = {
  assess: 'bg-purple-500',
  plan: 'bg-blue-500',
  build: 'bg-amber-500',
  release: 'bg-green-500',
  done: 'bg-slate-400',
};

export function DashboardPage() {
  const { data: flowsData, isLoading: flowsLoading } = useFlows();
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<any>('/analytics/overview'),
  });

  const flows = flowsData?.data || [];

  const byStageCounts = flows.reduce((acc: Record<string, number>, f: any) => {
    acc[f.current_stage] = (acc[f.current_stage] || 0) + 1;
    return acc;
  }, {});

  const totalFlows = flows.length;
  const activeFlows = flows.filter((f: any) => f.current_stage !== 'done').length;
  const pendingApprovals = analytics?.pending_approvals ?? 0;
  const evidenceItems = analytics?.evidence_count ?? 0;

  const statCards = [
    { label: 'Total Flows', value: totalFlows, color: 'text-slate-900' },
    { label: 'Active Flows', value: activeFlows, color: 'text-blue-600' },
    { label: 'Pending Approvals', value: pendingApprovals, color: 'text-amber-600' },
    { label: 'Evidence Items', value: evidenceItems, color: 'text-green-600' },
  ];

  const maxStageCount = Math.max(...STAGES.map((s) => byStageCounts[s] || 0), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-5">
            {flowsLoading || analyticsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Flows by Stage */}
      <Card className="p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Flows by Stage</h2>
        {flowsLoading ? (
          <div className="space-y-3">
            {STAGES.map((s) => (
              <Skeleton key={s} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {STAGES.map((stage) => {
              const count = byStageCounts[stage] || 0;
              const pct = (count / maxStageCount) * 100;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-16 capitalize text-slate-600">{stage}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                    <div className={`${STAGE_BAR_COLORS[stage]} h-5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent Flows */}
      <h2 className="text-lg font-semibold mb-4">Recent Flows</h2>
      {flowsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : flows.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          No flows yet. <Link to="/flows" className="text-blue-600 hover:underline">Create your first flow</Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {flows.slice(0, 5).map((flow: any) => (
            <Link key={flow.id} to={`/flows/${flow.id}`}>
              <Card className="p-4 hover:border-blue-300 transition-colors flex items-center justify-between">
                <div>
                  <p className="font-medium">{flow.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{flow.owner_name || 'Unassigned'}</p>
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
