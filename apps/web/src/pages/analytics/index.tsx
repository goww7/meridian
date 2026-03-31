import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';

const STAGE_BAR_COLORS: Record<string, string> = {
  assess: 'bg-purple-500',
  plan: 'bg-blue-500',
  build: 'bg-amber-500',
  release: 'bg-green-500',
  done: 'bg-slate-400',
};

const EVIDENCE_TYPE_COLORS: Record<string, string> = {
  test_result: 'bg-blue-500',
  code_review: 'bg-indigo-500',
  scan_result: 'bg-violet-500',
  approval: 'bg-green-500',
  deployment: 'bg-amber-500',
  manual: 'bg-slate-500',
};

const STATUS_COLORS: Record<string, string> = {
  passing: 'bg-green-500',
  failing: 'bg-red-500',
  pending: 'bg-yellow-500',
};

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<any>('/analytics/overview'),
  });

  const flowsByStage: Record<string, number> = data?.flows_by_stage || {};
  const evidenceByType: Record<string, number> = data?.evidence_by_type || {};
  const evidenceByStatus: Record<string, number> = data?.evidence_by_status || {};
  const completedLast30 = data?.completed_last_30_days ?? 0;

  const maxStage = Math.max(...Object.values(flowsByStage), 1);
  const maxEvType = Math.max(...Object.values(evidenceByType), 1);
  const maxEvStatus = Math.max(...Object.values(evidenceByStatus), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* Top stat */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-12" />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">Completed (Last 30 Days)</p>
              <p className="text-3xl font-bold mt-1 text-green-600">{completedLast30}</p>
            </>
          )}
        </Card>
        <Card className="p-5">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-12" />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">Total Evidence</p>
              <p className="text-3xl font-bold mt-1 text-blue-600">{data?.evidence_count ?? 0}</p>
            </>
          )}
        </Card>
        <Card className="p-5">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-12" />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">Pending Approvals</p>
              <p className="text-3xl font-bold mt-1 text-amber-600">{data?.pending_approvals ?? 0}</p>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Flows by Stage */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Flows by Stage</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {['assess', 'plan', 'build', 'release', 'done'].map((stage) => {
                const count = flowsByStage[stage] || 0;
                const pct = (count / maxStage) * 100;
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

        {/* Evidence by Type */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Evidence by Type</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : Object.keys(evidenceByType).length === 0 ? (
            <p className="text-sm text-slate-500">No evidence collected yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(evidenceByType).map(([type, count]) => {
                const pct = (count / maxEvType) * 100;
                const color = EVIDENCE_TYPE_COLORS[type] || 'bg-slate-400';
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-24 text-slate-600 truncate">{type.replace(/_/g, ' ')}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div className={`${color} h-5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Evidence by Status */}
        <Card className="p-6 col-span-2">
          <h2 className="text-lg font-semibold mb-4">Evidence by Status</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : Object.keys(evidenceByStatus).length === 0 ? (
            <p className="text-sm text-slate-500">No evidence collected yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(evidenceByStatus).map(([status, count]) => {
                const pct = (count / maxEvStatus) * 100;
                const color = STATUS_COLORS[status] || 'bg-slate-400';
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-20 capitalize text-slate-600">{status}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div className={`${color} h-5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
