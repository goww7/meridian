import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { StatCard } from '../../components/ui/stat-card';
import { PageHeader } from '../../components/ui/page-header';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';
import { CheckCircle, FileCheck, Clock, TrendingUp, Gauge, Timer, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie,
} from 'recharts';

const STAGE_COLORS: Record<string, string> = {
  assess: '#c4b5fd', plan: '#60a5fa', build: '#fbbf24', release: '#4ade80', done: '#a1a1aa',
};

const EVIDENCE_TYPE_COLORS: Record<string, string> = {
  test_result: '#60a5fa', code_review: '#818cf8', scan_result: '#a78bfa',
  approval: '#4ade80', deployment: '#fbbf24', manual: '#a1a1aa',
};

const STATUS_CHART_COLORS: Record<string, string> = {
  passing: '#22c55e', failing: '#ef4444', pending: '#f59e0b',
};

const tooltipStyle = {
  contentStyle: { background: '#1c1c20', border: '1px solid #363640', borderRadius: '6px', fontSize: '11px', color: '#fafafa' },
};

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<any>('/analytics/overview'),
  });

  const { data: advanced } = useQuery({
    queryKey: ['analytics', 'advanced'],
    queryFn: () => api.get<any>('/analytics/advanced'),
  });

  const flowsByStage: Record<string, number> = data?.flows_by_stage || {};
  const evidenceByType: Record<string, number> = data?.evidence_by_type || {};
  const evidenceByStatus: Record<string, number> = data?.evidence_by_status || {};

  const stageData = ['assess', 'plan', 'build', 'release', 'done'].map((s) => ({
    name: s, count: flowsByStage[s] || 0,
  }));

  const evTypeData = Object.entries(evidenceByType).map(([type, count]) => ({
    name: type.replace(/_/g, ' '), count, fill: EVIDENCE_TYPE_COLORS[type] || '#71717a',
  }));

  const evStatusData = Object.entries(evidenceByStatus).map(([status, count]) => ({
    name: status, value: count, fill: STATUS_CHART_COLORS[status] || '#71717a',
  }));

  return (
    <div>
      <PageHeader title="Analytics" description="Delivery performance metrics and insights" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 md:mb-6">
        <StatCard label="Completed (30d)" value={data?.completed_last_30_days ?? 0} icon={CheckCircle} accent="text-green-400" loading={isLoading} />
        <StatCard label="Total Evidence" value={data?.evidence_count ?? 0} icon={FileCheck} accent="text-blue-400" loading={isLoading} />
        <StatCard label="Pending Approvals" value={data?.pending_approvals ?? 0} icon={Clock} accent="text-amber-400" loading={isLoading} />
        <StatCard
          label="Flow Velocity"
          value={advanced?.flow_velocity?.completed_per_week?.slice(-1)[0] ?? 0}
          icon={TrendingUp}
          accent="text-accent-cyan"
          trend={advanced?.flow_velocity?.trend ? { value: advanced.flow_velocity.trend, up: advanced.flow_velocity.trend === 'up' } : undefined}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-4">
        {/* Flows by stage */}
        <Card className="lg:col-span-2 p-4 md:p-5">
          <h2 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-4">Flows by Stage</h2>
          {isLoading ? (
            <div className="h-48 animate-pulse bg-surface-3 rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData} barSize={36}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} width={20} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} {...tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stageData.map((e) => <Cell key={e.name} fill={STAGE_COLORS[e.name] || '#71717a'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Evidence by status */}
        <Card className="p-4 md:p-5">
          <h2 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-4">Evidence Health</h2>
          {evStatusData.length === 0 ? (
            <p className="text-xs text-text-muted py-8 text-center">No evidence yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={evStatusData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} strokeWidth={0}>
                    {evStatusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {evStatusData.map((e) => (
                  <div key={e.name} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.fill }} />
                    <span className="capitalize">{e.name}</span>
                    <span className="font-mono text-text-secondary">{e.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Evidence by type */}
        <Card className="lg:col-span-2 p-4 md:p-5">
          <h2 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-4">Evidence by Type</h2>
          {evTypeData.length === 0 ? (
            <p className="text-xs text-text-muted py-8 text-center">No evidence collected yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={evTypeData} layout="vertical" barSize={14}>
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 10 }} width={80} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} {...tooltipStyle} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {evTypeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Delivery metrics */}
        {advanced && (
          <Card className="p-4 md:p-5">
            <h2 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-4">Delivery Metrics</h2>
            <div className="space-y-4">
              {[
                { icon: Timer, label: 'Avg Lead Time', value: `${advanced.lead_time?.avg_days || 0}d` },
                { icon: BarChart3, label: 'Avg Cycle Time', value: `${advanced.cycle_time?.avg_days || 0}d` },
                { icon: Clock, label: 'Approval Turnaround', value: `${advanced.approval_turnaround?.avg_hours || 0}h` },
                { icon: Gauge, label: 'Compliance Score', value: `${Math.round((advanced.compliance_score?.current || 0) * 100)}%`, accent: (advanced.compliance_score?.current || 0) >= 0.8 },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-surface-3 border border-edge flex items-center justify-center">
                    <m.icon className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-text-muted">{m.label}</p>
                    <p className={cn('text-sm font-semibold font-mono tabular-nums', m.accent ? 'text-green-400' : 'text-text-primary')}>{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
