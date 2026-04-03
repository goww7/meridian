import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';
import { statusColors, cn, formatDate } from '../../lib/utils';
import { ShieldCheck, Plus, X, FileBarChart } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const FRAMEWORK_LABELS: Record<string, string> = {
  soc2: 'SOC 2 Type II',
  iso27001: 'ISO 27001',
  hipaa: 'HIPAA',
  pci_dss: 'PCI-DSS',
};

export function CompliancePage() {
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ framework: 'soc2', title: '', period_start: '', period_end: '' });

  const { data: reports, isLoading } = useQuery({
    queryKey: ['compliance', 'reports'],
    queryFn: () => api.get<any[]>('/compliance/reports'),
  });

  const { data: score } = useQuery({
    queryKey: ['compliance', 'score'],
    queryFn: () => api.get<{ score: number; by_framework: Record<string, number> }>('/compliance/score'),
  });

  const { data: detail } = useQuery({
    queryKey: ['compliance', 'reports', selectedReport],
    queryFn: () => api.get<any>(`/compliance/reports/${selectedReport}`),
    enabled: !!selectedReport,
  });

  const create = useMutation({
    mutationFn: () => api.post('/compliance/reports', {
      ...form,
      period_start: new Date(form.period_start).toISOString(),
      period_end: new Date(form.period_end).toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      setShowForm(false);
      setForm({ framework: 'soc2', title: '', period_start: '', period_end: '' });
      toast.success('Report generation started');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const summary = detail?.summary && typeof detail.summary === 'string' ? JSON.parse(detail.summary) : detail?.summary;
  const overallScore = score?.score ? Math.round(score.score * 100) : 0;
  const scoreColor = overallScore >= 80 ? '#22c55e' : overallScore >= 50 ? '#f59e0b' : '#ef4444';

  const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Track compliance posture across frameworks"
        actions={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Generate Report</>}
          </Button>
        }
      />

      {/* Score overview */}
      {score && score.score > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-5">
          <Card className="p-4 flex items-center gap-4">
            <ResponsiveContainer width={56} height={56}>
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: overallScore }]} startAngle={90} endAngle={-270}>
                <RadialBar background={{ fill: '#1f1f23' }} dataKey="value" fill={scoreColor} cornerRadius={4} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Overall</p>
              <p className="text-xl font-semibold font-mono tabular-nums" style={{ color: scoreColor }}>{overallScore}%</p>
            </div>
          </Card>
          {Object.entries(score.by_framework).map(([fw, s]) => (
            <StatCard
              key={fw}
              label={FRAMEWORK_LABELS[fw] || fw}
              value={`${Math.round(s * 100)}%`}
              accent={s >= 0.8 ? 'text-green-400' : s >= 0.5 ? 'text-amber-400' : 'text-red-400'}
            />
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <Card className="p-5 mb-5 animate-slide-up">
          <h3 className="text-sm font-medium text-text-primary mb-4">Generate Compliance Report</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Framework</label>
              <select value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })} className={inputClass}>
                {Object.entries(FRAMEWORK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Q1 2026 SOC 2 Report" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Period Start</label>
              <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Period End</label>
              <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className={inputClass} />
            </div>
          </div>
          <Button size="sm" className="mt-4" onClick={() => create.mutate()} disabled={!form.title || !form.period_start || !form.period_end || create.isPending}>
            Generate
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Reports */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner className="h-5 w-5" /></div>
          ) : !reports?.length ? (
            <EmptyState icon={FileBarChart} title="No reports" description="Generate your first compliance report." action={{ label: 'Generate', onClick: () => setShowForm(true) }} />
          ) : (
            <div className="space-y-1">
              {reports.map((r: any) => (
                <Card key={r.id} hover active={selectedReport === r.id} className="px-4 py-3" onClick={() => setSelectedReport(r.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-primary">{r.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {FRAMEWORK_LABELS[r.framework]} &middot; {formatDate(r.period_start)} - {formatDate(r.period_end)}
                      </p>
                    </div>
                    <Badge className={statusColors[r.status]}>{r.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div>
          {selectedReport && summary ? (
            <Card className="p-4 lg:sticky lg:top-4 animate-slide-in-right">
              <h3 className="text-xs font-medium text-text-primary mb-4">Report Summary</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                  {[
                    { label: 'Met', value: summary.controls_met, color: 'text-green-400 bg-green-500/10' },
                    { label: 'Partial', value: summary.controls_partial, color: 'text-amber-400 bg-amber-500/10' },
                    { label: 'Unmet', value: summary.controls_unmet, color: 'text-red-400 bg-red-500/10' },
                    { label: 'Evidence', value: summary.evidence_count, color: 'text-blue-400 bg-blue-500/10' },
                  ].map((s) => (
                    <div key={s.label} className={cn('rounded-md p-2.5 text-center', s.color.split(' ')[1])}>
                      <p className={cn('text-lg font-semibold font-mono tabular-nums', s.color.split(' ')[0])}>{s.value}</p>
                      <p className="text-[10px] text-text-muted">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Policy Pass Rate</p>
                  <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-accent-cyan h-1.5 rounded-full transition-all" style={{ width: `${Math.round(summary.policy_pass_rate * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-right text-text-muted mt-1 font-mono tabular-nums">{Math.round(summary.policy_pass_rate * 100)}%</p>
                </div>

                {summary.findings?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Findings</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {summary.findings.map((f: any) => (
                        <div key={f.control_id} className="flex items-center justify-between text-xs py-1">
                          <span className="text-text-secondary truncate mr-2">{f.control_id}: {f.control_name}</span>
                          <Badge className={statusColors[f.status]}>{f.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-xs text-text-muted">Select a report to view details</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
