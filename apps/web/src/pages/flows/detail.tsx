import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFlow, useTransitionFlow, useFlowReadiness } from '../../hooks/use-flows';
import { useArtifacts, useGenerateArtifact, useApproveArtifact } from '../../hooks/use-artifacts';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { Tabs } from '../../components/ui/tabs';
import { stageColors, priorityColors, statusColors, stageDotColors, cn, formatDate } from '../../lib/utils';
import { VALID_TRANSITIONS } from '@meridian/shared';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Check, FileText, ListChecks,
  Target, TestTube, ShieldCheck, User, Calendar, Plus, X, Trash2,
  Pencil, Sparkles, ThumbsUp, ThumbsDown, Save, Upload,
  Flag, Crosshair, RefreshCw, Eye, ChevronDown, ChevronUp,
  AlertTriangle, Zap, GitBranch, Link2, CheckCircle, Circle, AlertCircle,
  Network, List,
} from 'lucide-react';
import { SpecGraph } from '../../components/graph/spec-graph';

const STAGES = ['assess', 'plan', 'build', 'release', 'done'] as const;

const TAB_DEFS = [
  { id: 'overview', label: 'Overview' },
  { id: 'traceability', label: 'Traceability' },
  { id: 'planning', label: 'Planning' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'readiness', label: 'Readiness' },
];

const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

const ARTIFACT_TYPES = ['prd', 'architecture', 'test_plan', 'runbook', 'release_notes', 'assessment', 'technical_spec', 'rfc', 'adr', 'custom'];

export function FlowDetailPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { data: flow, isLoading } = useFlow(flowId!);
  const transition = useTransitionFlow();
  const [activeTab, setActiveTab] = useState('overview');
  const [showTransitionConfirm, setShowTransitionConfirm] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;
  if (!flow) return <p className="text-text-muted text-sm py-8 text-center">Flow not found</p>;

  const nextStages = VALID_TRANSITIONS[flow.current_stage as keyof typeof VALID_TRANSITIONS] || [];

  async function handleTransition(toStage: string) {
    try {
      await transition.mutateAsync({ flowId: flowId!, to_stage: toStage });
      toast.success(`Transitioned to ${toStage}`);
      setShowTransitionConfirm(null);
    } catch (err: any) {
      const gateResult = err.data?.gate_result;
      if (gateResult?.blocking_failures?.length) {
        const failures = gateResult.blocking_failures as Array<{ policy_name: string; details: { message: string } }>;
        toast.error(
          `Blocked by ${failures.length} policy${failures.length > 1 ? ' failures' : ' failure'}:\n${failures.map((f: { policy_name: string; details: { message: string } }) => `• ${f.policy_name} — ${f.details?.message || 'not met'}`).join('\n')}`,
          { duration: 8000 },
        );
      } else {
        toast.error(err.message || 'Gate check failed — check Readiness tab');
      }
      setShowTransitionConfirm(null);
    }
  }

  const currentStageIdx = STAGES.indexOf(flow.current_stage);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
        <Link to="/flows" className="hover:text-text-secondary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Flows
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-text-secondary truncate">{flow.title}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{flow.title}</h1>
          {flow.description && <p className="text-xs text-text-tertiary mt-1 max-w-2xl">{flow.description}</p>}
          <div className="flex items-center gap-2 mt-2.5">
            <Badge className={stageColors[flow.current_stage]}>{flow.current_stage}</Badge>
            <Badge className={priorityColors[flow.priority]}>{flow.priority}</Badge>
            {flow.sensitivity !== 'low' && (
              <Badge className="bg-orange-500/20 text-orange-400">sensitivity: {flow.sensitivity}</Badge>
            )}
            {flow.tags?.length > 0 && flow.tags.map((t: string) => (
              <Badge key={t} className="bg-surface-3 text-text-tertiary">{t}</Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2 relative">
          <KickstartButton flowId={flowId!} hasData={(flow.counts?.initiatives || 0) > 0} />
          {nextStages.filter((s: string) => s !== flow.current_stage).map((stage: string) => (
            <div key={stage} className="relative">
              <Button size="sm" onClick={() => setShowTransitionConfirm(stage)} disabled={transition.isPending}>
                {stage === 'done' ? 'Complete' : `Advance to ${stage}`}
                <ChevronRight className="w-3 h-3" />
              </Button>
              {showTransitionConfirm === stage && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-surface-1 border border-edge rounded-lg shadow-xl shadow-black/40 z-50 p-3 animate-slide-down">
                  <p className="text-xs text-text-primary font-medium mb-1">Confirm transition</p>
                  <p className="text-[10px] text-text-muted mb-3">
                    Move this flow to <span className="text-accent-cyan font-medium">{stage}</span>? Policy gates will be evaluated.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleTransition(stage)} disabled={transition.isPending}>
                      {transition.isPending ? 'Evaluating...' : 'Confirm'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowTransitionConfirm(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="flex items-center gap-0.5 mb-4 sm:mb-6 p-2 sm:p-3 bg-surface-1 rounded-lg border border-edge overflow-x-auto">
        {STAGES.map((stage, i) => {
          const isActive = stage === flow.current_stage;
          const isPast = i < currentStageIdx;
          return (
            <div key={stage} className="flex items-center flex-1">
              <div className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium flex-1 transition-all',
                isActive && 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
                isPast && 'bg-green-500/10 text-green-400',
                !isActive && !isPast && 'bg-surface-3 text-text-muted',
              )}>
                {isPast ? <Check className="w-3 h-3" /> : isActive ? <span className={cn('w-1.5 h-1.5 rounded-full', stageDotColors[stage])} /> : null}
                <span className="capitalize">{stage}</span>
              </div>
              {i < STAGES.length - 1 && <div className={cn('w-4 h-px mx-0.5', isPast ? 'bg-green-500/30' : 'bg-edge')} />}
            </div>
          );
        })}
      </div>

      {/* Counts row */}
      {flow.counts && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2 mb-4 sm:mb-5">
          {Object.entries(flow.counts).map(([key, val]) => (
            <div key={key} className="bg-surface-1 border border-edge rounded-md px-3 py-2 text-center">
              <p className="text-lg font-semibold font-mono tabular-nums text-text-primary">{val as number}</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider capitalize">{key}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs tabs={TAB_DEFS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && <OverviewTab flow={flow} flowId={flowId!} />}
      {activeTab === 'traceability' && <TraceabilityTab flowId={flowId!} />}
      {activeTab === 'planning' && <PlanningTab flowId={flowId!} />}
      {activeTab === 'requirements' && <RequirementsTab flowId={flowId!} />}
      {activeTab === 'tasks' && <TasksTab flowId={flowId!} />}
      {activeTab === 'artifacts' && <ArtifactsTab flowId={flowId!} />}
      {activeTab === 'evidence' && <EvidenceTab flowId={flowId!} />}
      {activeTab === 'readiness' && <ReadinessTab flowId={flowId!} />}
    </div>
  );
}

/* ═══════ OVERVIEW TAB ═══════ */

function OverviewTab({ flow, flowId }: { flow: any; flowId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: flow.title, description: flow.description || '', priority: flow.priority, sensitivity: flow.sensitivity });

  const update = useMutation({
    mutationFn: (data: any) => api.patch(`/flows/${flowId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows'] }); setEditing(false); toast.success('Updated'); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteFlow = useMutation({
    mutationFn: () => api.del(`/flows/${flowId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows'] }); toast.success('Flow deleted'); navigate('/flows'); },
    onError: (err: any) => toast.error(err.message),
  });

  // Stage history
  const stageHistory = flow.stage_history || [];

  if (editing) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-primary">Edit Flow</h3>
          <button onClick={() => setEditing(false)} className="text-text-muted hover:text-text-secondary"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} /></div>
          <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cn(inputClass, 'resize-none')} rows={3} /></div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="block text-xs font-medium text-text-secondary mb-1.5">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="flex-1"><label className="block text-xs font-medium text-text-secondary mb-1.5">Sensitivity</label><select value={form.sensitivity} onChange={(e) => setForm({ ...form, sensitivity: e.target.value })} className={inputClass}>{['low', 'medium', 'high'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => update.mutate(form)} disabled={update.isPending}><Save className="w-3 h-3" /> Save</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Flow Details</h3>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="w-3 h-3" /> Edit</Button>
            <Button size="sm" variant="danger" onClick={() => { if (confirm('Delete this flow?')) deleteFlow.mutate(); }}><Trash2 className="w-3 h-3" /> Delete</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-text-secondary leading-relaxed">{flow.description || 'No description.'}</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-text-muted" /><div><p className="text-[10px] text-text-muted uppercase tracking-wider">Owner</p><p className="text-sm text-text-primary">{flow.owner_name || 'Unassigned'}</p></div></div>
            <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-text-muted" /><div><p className="text-[10px] text-text-muted uppercase tracking-wider">Created</p><p className="text-sm text-text-primary">{formatDate(flow.created_at)}</p></div></div>
          </div>
        </div>
      </Card>

      {/* Stage history */}
      {stageHistory.length > 0 && (
        <Card className="p-5">
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-3">Stage History</h3>
          <div className="space-y-2">
            {stageHistory.map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className={cn('w-2 h-2 rounded-full', stageDotColors[t.to_stage] || 'bg-text-muted')} />
                <span className="text-text-secondary capitalize">{t.from_stage || 'start'} → {t.to_stage}</span>
                <span className="text-text-muted font-mono">{formatDate(t.transitioned_at || t.created_at)}</span>
                {t.actor_name && <span className="text-text-muted">by {t.actor_name}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════ PLANNING TAB — Initiatives & Objectives ═══════ */

function PlanningTab({ flowId }: { flowId: string }) {
  const queryClient = useQueryClient();
  const [showInitForm, setShowInitForm] = useState(false);
  const [initForm, setInitForm] = useState({ title: '', description: '' });
  const [expandedInit, setExpandedInit] = useState<string | null>(null);
  const [showObjForm, setShowObjForm] = useState<string | null>(null);
  const [objForm, setObjForm] = useState({ title: '', description: '' });

  const { data: initData, isLoading } = useQuery({
    queryKey: ['flows', flowId, 'initiatives'],
    queryFn: () => api.get<any>(`/flows/${flowId}/initiatives`),
  });

  const createInit = useMutation({
    mutationFn: (data: any) => api.post(`/flows/${flowId}/initiatives`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'initiatives'] }); setShowInitForm(false); setInitForm({ title: '', description: '' }); toast.success('Initiative created'); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteInit = useMutation({
    mutationFn: (id: string) => api.del(`/flows/${flowId}/initiatives/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'initiatives'] }); toast.success('Deleted'); },
  });

  const createObj = useMutation({
    mutationFn: ({ initId, ...data }: any) => api.post(`/initiatives/${initId}/objectives`, data),
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['initiatives', vars.initId, 'objectives'] }); setShowObjForm(null); setObjForm({ title: '', description: '' }); toast.success('Objective created'); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteObj = useMutation({
    mutationFn: (id: string) => api.del(`/objectives/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['initiatives'] }); toast.success('Deleted'); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const initiatives = initData?.data || initData || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Initiatives & Objectives</p>
          <p className="text-[10px] text-text-muted mt-0.5">Define the strategic hierarchy: Initiative → Objective → Requirement</p>
        </div>
        <Button size="sm" onClick={() => setShowInitForm(!showInitForm)}>
          {showInitForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Initiative</>}
        </Button>
      </div>

      {showInitForm && (
        <Card className="p-4 mb-3 animate-slide-up">
          <div className="space-y-3">
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Initiative Title</label><input value={initForm.title} onChange={(e) => setInitForm({ ...initForm, title: e.target.value })} className={inputClass} placeholder="e.g. Improve Authentication Security" /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label><textarea value={initForm.description} onChange={(e) => setInitForm({ ...initForm, description: e.target.value })} className={cn(inputClass, 'resize-none')} rows={2} /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowInitForm(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createInit.mutate(initForm)} disabled={!initForm.title || createInit.isPending}>Create</Button>
            </div>
          </div>
        </Card>
      )}

      {!Array.isArray(initiatives) || initiatives.length === 0 ? (
        <EmptyState icon={Flag} title="No initiatives" description="Start by creating an initiative to organize your delivery objectives and requirements." action={{ label: 'Add Initiative', onClick: () => setShowInitForm(true) }} />
      ) : (
        <div className="space-y-2">
          {initiatives.map((init: any) => (
            <Card key={init.id} className="overflow-hidden">
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
                onClick={() => setExpandedInit(expandedInit === init.id ? null : init.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {expandedInit === init.id ? <ChevronUp className="w-3.5 h-3.5 text-text-muted shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />}
                  <Flag className="w-3.5 h-3.5 text-accent-purple shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">{init.title}</p>
                    {init.description && <p className="text-xs text-text-muted truncate">{init.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge>{init.status || 'active'}</Badge>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete initiative?')) deleteInit.mutate(init.id); }}
                    className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>

              {expandedInit === init.id && (
                <ObjectivesPanel initiativeId={init.id} showObjForm={showObjForm} setShowObjForm={setShowObjForm} objForm={objForm} setObjForm={setObjForm} createObj={createObj} deleteObj={deleteObj} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectivesPanel({ initiativeId, showObjForm, setShowObjForm, objForm, setObjForm, createObj, deleteObj }: any) {
  const { data: objData, isLoading } = useQuery({
    queryKey: ['initiatives', initiativeId, 'objectives'],
    queryFn: () => api.get<any>(`/initiatives/${initiativeId}/objectives`),
  });

  const objectives = objData?.data || objData || [];

  return (
    <div className="border-t border-edge bg-surface-2/50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1"><Crosshair className="w-3 h-3" /> Objectives</p>
        <Button size="sm" variant="ghost" onClick={() => setShowObjForm(showObjForm === initiativeId ? null : initiativeId)}>
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>

      {showObjForm === initiativeId && (
        <div className="p-3 bg-surface-1 rounded-md border border-edge mb-2 animate-slide-up">
          <div className="space-y-2">
            <input value={objForm.title} onChange={(e: any) => setObjForm({ ...objForm, title: e.target.value })} className={inputClass} placeholder="Objective title" />
            <textarea value={objForm.description} onChange={(e: any) => setObjForm({ ...objForm, description: e.target.value })} className={cn(inputClass, 'resize-none')} rows={2} placeholder="Description (optional)" />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowObjForm(null)}>Cancel</Button>
              <Button size="sm" onClick={() => createObj.mutate({ initId: initiativeId, ...objForm })} disabled={!objForm.title || createObj.isPending}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? <Spinner className="h-3 w-3" /> : !Array.isArray(objectives) || objectives.length === 0 ? (
        <p className="text-xs text-text-muted py-2">No objectives yet. Add one to start creating requirements.</p>
      ) : (
        <div className="space-y-1">
          {objectives.map((obj: any) => (
            <div key={obj.id} className="flex items-center justify-between py-1.5 px-2 bg-surface-1 rounded text-xs group">
              <div className="flex items-center gap-2 min-w-0">
                <Crosshair className="w-3 h-3 text-accent-blue shrink-0" />
                <span className="text-text-secondary truncate">{obj.title}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge>{obj.status || 'active'}</Badge>
                <span className="text-[10px] text-text-muted font-mono">{obj.id.slice(0, 8)}</span>
                <button onClick={() => { if (confirm('Delete objective?')) deleteObj.mutate(obj.id); }}
                  className="p-0.5 rounded text-text-muted hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════ REQUIREMENTS TAB ═══════ */

function RequirementsTab({ flowId }: { flowId: string }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState('');
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: '' });

  const { data, isLoading } = useQuery({ queryKey: ['flows', flowId, 'requirements'], queryFn: () => api.get<any>(`/flows/${flowId}/requirements`) });
  const { data: initData } = useQuery({ queryKey: ['flows', flowId, 'initiatives'], queryFn: () => api.get<any>(`/flows/${flowId}/initiatives`) });

  const initList = initData?.data || initData || [];
  // Gather all objectives from all initiatives
  const [allObjectives, setAllObjectives] = useState<any[]>([]);
  const { data: objDataAll } = useQuery({
    queryKey: ['flows', flowId, 'all-objectives'],
    queryFn: async () => {
      const objs: any[] = [];
      for (const init of initList) {
        try {
          const res = await api.get<any>(`/initiatives/${init.id}/objectives`);
          const list = res?.data || res || [];
          if (Array.isArray(list)) objs.push(...list.map((o: any) => ({ ...o, initiative_title: init.title })));
        } catch { /* skip */ }
      }
      return objs;
    },
    enabled: initList.length > 0,
  });

  useEffect(() => { if (objDataAll) setAllObjectives(objDataAll); }, [objDataAll]);
  useEffect(() => { if (allObjectives.length > 0 && !selectedObjective) setSelectedObjective(allObjectives[0].id); }, [allObjectives, selectedObjective]);

  const create = useMutation({
    mutationFn: (data: any) => api.post(`/objectives/${selectedObjective}/requirements`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId] }); setShowCreate(false); setForm({ title: '', description: '', priority: 'medium' }); toast.success('Requirement created'); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateReq = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/requirements/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'requirements'] }); setEditingId(null); toast.success('Updated'); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteReq = useMutation({
    mutationFn: (id: string) => api.del(`/requirements/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId] }); toast.success('Deleted'); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const requirements = data?.data || data || [];
  const canCreate = allObjectives.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{Array.isArray(requirements) ? requirements.length : 0} requirements</p>
        {canCreate ? (
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add</>}
          </Button>
        ) : (
          <p className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Create initiatives & objectives in Planning tab first</p>
        )}
      </div>

      {showCreate && (
        <Card className="p-4 mb-3 animate-slide-up">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Parent Objective</label>
              <select value={selectedObjective} onChange={(e) => setSelectedObjective(e.target.value)} className={inputClass}>
                {allObjectives.map((o) => <option key={o.id} value={o.id}>{o.initiative_title} → {o.title}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="e.g. User authentication must support MFA" /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cn(inputClass, 'resize-none')} rows={2} /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={!form.title || !selectedObjective || create.isPending}>Create</Button>
            </div>
          </div>
        </Card>
      )}

      {!Array.isArray(requirements) || requirements.length === 0 ? (
        <EmptyState icon={Target} title="No requirements" description={canCreate ? 'Add requirements to track what this flow needs to deliver.' : 'Go to the Planning tab to create initiatives and objectives first.'} />
      ) : (
        <div className="space-y-1">
          {requirements.map((req: any) => (
            <Card key={req.id} className="px-4 py-3 group">
              {editingId === req.id ? (
                <div className="space-y-2">
                  <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className={inputClass} />
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={cn(inputClass, 'resize-none')} rows={2} />
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputClass}>
                    {['open', 'in_progress', 'done'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" onClick={() => updateReq.mutate({ id: req.id, ...editForm })} disabled={updateReq.isPending}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">{req.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {req.description && <p className="text-xs text-text-tertiary">{req.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {req.objective_title && <span className="text-[10px] text-accent-blue flex items-center gap-0.5"><Crosshair className="w-2.5 h-2.5" />{req.objective_title}</span>}
                      {req.type && req.type !== 'functional' && <Badge className="text-[9px] py-0 px-1 bg-surface-3 text-text-muted">{req.type}</Badge>}
                      {req.priority && req.priority !== 'must' && <Badge className="text-[9px] py-0 px-1 bg-surface-3 text-text-muted">{req.priority}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge className={statusColors[req.status] || statusColors.todo}>{req.status || 'open'}</Badge>
                    <button onClick={() => { setEditingId(req.id); setEditForm({ title: req.title, description: req.description || '', status: req.status || 'open' }); }} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => { if (confirm('Delete?')) deleteReq.mutate(req.id); }} className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════ TASKS TAB ═══════ */

function TasksTab({ flowId }: { flowId: string }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', requirement_id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: '', priority: '', requirement_id: '' });

  const { data, isLoading } = useQuery({ queryKey: ['flows', flowId, 'tasks'], queryFn: () => api.get<any>(`/flows/${flowId}/tasks`) });
  const { data: reqData } = useQuery({ queryKey: ['flows', flowId, 'requirements'], queryFn: () => api.get<any>(`/flows/${flowId}/requirements`) });
  const requirements = reqData?.data || reqData || [];

  const create = useMutation({
    mutationFn: (data: any) => api.post(`/flows/${flowId}/tasks`, { ...data, requirement_id: data.requirement_id || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId] }); setShowCreate(false); setForm({ title: '', description: '', priority: 'medium', requirement_id: '' }); toast.success('Task created'); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/tasks/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'tasks'] }); setEditingId(null); toast.success('Updated'); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.del(`/tasks/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId] }); toast.success('Deleted'); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const tasks = data?.data || data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{Array.isArray(tasks) ? tasks.length : 0} tasks</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Task</>}
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 mb-3 animate-slide-up">
          <div className="space-y-3">
            {requirements.length > 0 && (
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Linked Requirement <span className="text-text-muted">(optional)</span></label>
                <select value={form.requirement_id} onChange={(e) => setForm({ ...form, requirement_id: e.target.value })} className={inputClass}>
                  <option value="">None — standalone task</option>
                  {requirements.map((r: any) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            )}
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="e.g. Implement login endpoint" /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cn(inputClass, 'resize-none')} rows={2} /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={!form.title || create.isPending}>Create</Button>
            </div>
          </div>
        </Card>
      )}

      {!Array.isArray(tasks) || tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks" description="Break down work into tasks." action={{ label: 'Add Task', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="space-y-1">
          {tasks.map((task: any) => (
            <Card key={task.id} className="px-4 py-3 group">
              {editingId === task.id ? (
                <div className="space-y-2">
                  <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className={inputClass} />
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={cn(inputClass, 'resize-none')} rows={2} />
                  <div className="flex gap-2">
                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputClass}>{['todo', 'in_progress', 'done', 'blocked'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
                    <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} className={inputClass}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  </div>
                  {requirements.length > 0 && (
                    <select value={editForm.requirement_id} onChange={(e) => setEditForm({ ...editForm, requirement_id: e.target.value })} className={inputClass}>
                      <option value="">No linked requirement</option>
                      {requirements.map((r: any) => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" onClick={() => updateTask.mutate({ id: task.id, ...editForm })} disabled={updateTask.isPending}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.assignee_name && <span className="text-xs text-text-tertiary">{task.assignee_name}</span>}
                      {task.requirement_title && <span className="text-[10px] text-accent-cyan flex items-center gap-0.5"><Link2 className="w-2.5 h-2.5" />{task.requirement_title}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                    <Badge className={statusColors[task.status] || statusColors.todo}>{task.status || 'todo'}</Badge>
                    <button onClick={() => { setEditingId(task.id); setEditForm({ title: task.title, description: task.description || '', status: task.status || 'todo', priority: task.priority || 'medium', requirement_id: task.requirement_id || '' }); }} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => { if (confirm('Delete?')) deleteTask.mutate(task.id); }} className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════ ARTIFACTS TAB — Generate, View, Approve, Reject, Regenerate ═══════ */

function ArtifactsTab({ flowId }: { flowId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useArtifacts(flowId);
  const generateArtifact = useGenerateArtifact();
  const approveArtifact = useApproveArtifact();
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ type: 'prd', context: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [regenFeedback, setRegenFeedback] = useState('');

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.post(`/artifacts/${id}/reject`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['artifacts'] }); toast.success('Rejected'); },
    onError: (err: any) => toast.error(err.message),
  });

  const regenMut = useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback: string }) => api.post(`/artifacts/${id}/regenerate`, { feedback }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['artifacts'] }); setRegenId(null); setRegenFeedback(''); toast.success('Regeneration started'); },
    onError: (err: any) => toast.error(err.message),
  });

  const artifacts = Array.isArray(data) ? data : (data as any)?.data || [];

  // Fetch expanded artifact detail
  const { data: expandedArtifact, isLoading: isLoadingArtifact } = useQuery({
    queryKey: ['artifacts', expandedId],
    queryFn: () => api.get<any>(`/artifacts/${expandedId}`),
    enabled: !!expandedId,
  });

  async function handleGenerate() {
    try {
      await generateArtifact.mutateAsync({ flowId, type: genForm.type, context: genForm.context ? { notes: genForm.context } : undefined });
      setShowGenerate(false); setGenForm({ type: 'prd', context: '' });
      toast.success('Generation started — refresh shortly');
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{artifacts.length} artifacts</p>
        <Button size="sm" onClick={() => setShowGenerate(!showGenerate)}>
          {showGenerate ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Sparkles className="w-3.5 h-3.5" /> Generate with AI</>}
        </Button>
      </div>

      {showGenerate && (
        <Card className="p-4 mb-3 animate-slide-up border-accent-cyan/20">
          <h4 className="text-xs font-medium text-text-primary mb-3 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-accent-cyan" /> AI Generation</h4>
          <div className="space-y-3">
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Type</label><select value={genForm.type} onChange={(e) => setGenForm({ ...genForm, type: e.target.value })} className={inputClass}>{ARTIFACT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Context <span className="text-text-muted">(optional)</span></label><textarea value={genForm.context} onChange={(e) => setGenForm({ ...genForm, context: e.target.value })} className={cn(inputClass, 'resize-none')} rows={3} placeholder="Additional notes for the AI..." /></div>
            <Button size="sm" onClick={handleGenerate} disabled={generateArtifact.isPending}>{generateArtifact.isPending ? 'Generating...' : 'Generate'}</Button>
          </div>
        </Card>
      )}

      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : artifacts.length === 0 ? (
        <EmptyState icon={FileText} title="No artifacts" description="Generate AI documents for this flow." action={{ label: 'Generate', onClick: () => setShowGenerate(true) }} />
      ) : (
        <div className="space-y-1">
          {artifacts.map((a: any) => (
            <Card key={a.id} className="overflow-hidden group">
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                <div className="flex items-center gap-2 min-w-0">
                  {expandedId === a.id ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
                  <div><p className="text-sm text-text-primary">{a.title || a.type}</p><p className="text-xs text-text-tertiary mt-0.5">v{a.version || 1} &middot; {a.type?.replace(/_/g, ' ')}</p></div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={statusColors[a.status] || statusColors.draft}>{a.status || 'draft'}</Badge>
                  {(a.status === 'pending' || a.status === 'draft') && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); approveArtifact.mutate(a.id); }} className="p-1 rounded text-green-400 hover:bg-green-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all" title="Approve"><ThumbsUp className="w-3 h-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); rejectMut.mutate(a.id); }} className="p-1 rounded text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all" title="Reject"><ThumbsDown className="w-3 h-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setRegenId(a.id); }} className="p-1 rounded text-accent-cyan hover:bg-accent-cyan/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all" title="Regenerate"><RefreshCw className="w-3 h-3" /></button>
                    </>
                  )}
                </div>
              </div>

              {/* Artifact content viewer */}
              {expandedId === a.id && (
                <div className="border-t border-edge bg-surface-2/30 px-4 py-3">
                  {isLoadingArtifact ? (
                    <div className="flex items-center gap-2 py-3">
                      <Spinner className="w-3.5 h-3.5" />
                      <p className="text-xs text-text-muted">Loading artifact content...</p>
                    </div>
                  ) : expandedArtifact?.content ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-xs text-text-secondary font-sans leading-relaxed max-h-96 overflow-y-auto bg-surface-1 p-4 rounded-md border border-edge">{expandedArtifact.content}</pre>
                    </div>
                  ) : a.status === 'generating' ? (
                    <div className="flex items-center gap-2 py-3">
                      <Spinner className="w-3.5 h-3.5" />
                      <p className="text-xs text-text-muted">AI is generating this {a.type?.replace(/_/g, ' ') || 'artifact'} — this may take a moment.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted py-3">No content yet. {a.status === 'draft' ? 'This artifact is a draft — generate content using AI or add it manually.' : `Status: ${a.status}`}</p>
                  )}
                </div>
              )}

              {/* Regenerate with feedback */}
              {regenId === a.id && (
                <div className="border-t border-edge bg-surface-2/50 px-4 py-3 animate-slide-up">
                  <p className="text-xs font-medium text-text-primary mb-2 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 text-accent-cyan" /> Regenerate with feedback</p>
                  <textarea value={regenFeedback} onChange={(e) => setRegenFeedback(e.target.value)} className={cn(inputClass, 'resize-none')} rows={3} placeholder="What should be different? e.g. 'Add more detail on security requirements'" />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => regenMut.mutate({ id: a.id, feedback: regenFeedback })} disabled={!regenFeedback || regenMut.isPending}>Regenerate</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setRegenId(null); setRegenFeedback(''); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════ EVIDENCE TAB ═══════ */

function EvidenceTab({ flowId }: { flowId: string }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ type: 'test_result', title: '', source: '', status: 'passing', details: '', requirement_id: '' });

  const { data, isLoading } = useQuery({ queryKey: ['flows', flowId, 'evidence'], queryFn: () => api.get<any>(`/flows/${flowId}/evidence`) });
  const { data: reqData } = useQuery({ queryKey: ['flows', flowId, 'requirements'], queryFn: () => api.get<any>(`/flows/${flowId}/requirements`) });
  const requirements = reqData?.data || reqData || [];

  const create = useMutation({
    mutationFn: (data: any) => api.post(`/flows/${flowId}/evidence`, { ...data, requirement_id: data.requirement_id || undefined, data: data.details ? { notes: data.details } : {} }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId] }); setShowCreate(false); setForm({ type: 'test_result', title: '', source: '', status: 'passing', details: '', requirement_id: '' }); toast.success('Evidence added'); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteEv = useMutation({
    mutationFn: (id: string) => api.del(`/evidence/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId] }); toast.success('Removed'); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const evidence = data?.data || data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{Array.isArray(evidence) ? evidence.length : 0} evidence items</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Upload className="w-3.5 h-3.5" /> Add Evidence</>}
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 mb-3 animate-slide-up">
          <div className="space-y-3">
            {requirements.length > 0 && (
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Linked Requirement <span className="text-text-muted">(optional)</span></label>
                <select value={form.requirement_id} onChange={(e) => setForm({ ...form, requirement_id: e.target.value })} className={inputClass}>
                  <option value="">None — standalone evidence</option>
                  {requirements.map((r: any) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>{['test_result', 'code_review', 'scan_result', 'approval', 'deployment', 'manual'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>{['passing', 'failing', 'pending'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="e.g. Unit test suite run #42" /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Source</label><input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputClass} placeholder="e.g. GitHub Actions, SonarQube" /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Details <span className="text-text-muted">(optional)</span></label><textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className={cn(inputClass, 'resize-none')} rows={2} /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={!form.title || create.isPending}>Add</Button>
            </div>
          </div>
        </Card>
      )}

      {!Array.isArray(evidence) || evidence.length === 0 ? (
        <EmptyState icon={TestTube} title="No evidence" description="Add test results, scan reports, and approvals." action={{ label: 'Add Evidence', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="space-y-1">
          {evidence.map((ev: any) => (
            <Card key={ev.id} className="px-4 py-3 group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{ev.title || ev.type}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-tertiary">{ev.source || ev.type?.replace(/_/g, ' ')}</span>
                    {ev.requirement_title && <span className="text-[10px] text-accent-cyan flex items-center gap-0.5"><Link2 className="w-2.5 h-2.5" />{ev.requirement_title}</span>}
                    {ev.created_at && <span className="text-[10px] text-text-muted">{formatDate(ev.created_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge className={statusColors[ev.status] || statusColors.pending}>{ev.status || 'pending'}</Badge>
                  <button onClick={() => { if (confirm('Delete?')) deleteEv.mutate(ev.id); }} className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════ READINESS TAB ═══════ */

function ReadinessTab({ flowId }: { flowId: string }) {
  const { data, isLoading } = useFlowReadiness(flowId);
  const queryClient = useQueryClient();

  const evaluate = useMutation({
    mutationFn: () => api.post('/policies/evaluate', { flow_id: flowId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'readiness'] }); toast.success('Re-evaluated'); },
    onError: (err: any) => toast.error(err.message),
  });

  // Also fetch gaps
  const { data: gaps } = useQuery({
    queryKey: ['flows', flowId, 'gaps'],
    queryFn: () => api.get<any>(`/flows/${flowId}/gaps`),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (!data) return <EmptyState icon={ShieldCheck} title="No readiness data" description="Configure policies to see gate evaluations." />;

  const gates = data?.gate_results || data?.gates || data?.checks || [];
  const gapsList = gaps?.gaps || gaps?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Gate evaluation</p>
        <Button size="sm" variant="secondary" onClick={() => evaluate.mutate()} disabled={evaluate.isPending}>
          <RefreshCw className={cn('w-3 h-3', evaluate.isPending && 'animate-spin')} />
          {evaluate.isPending ? 'Evaluating...' : 'Re-evaluate'}
        </Button>
      </div>

      {data.ready !== undefined && (
        <Card className={cn('p-4 mb-4 border', data.ready ? 'border-green-500/20 bg-green-500/5' : 'border-amber-500/20 bg-amber-500/5')}>
          <div className="flex items-center gap-3">
            <ShieldCheck className={cn('w-5 h-5', data.ready ? 'text-green-400' : 'text-amber-400')} />
            <div>
              <span className={cn('text-sm font-medium', data.ready ? 'text-green-400' : 'text-amber-400')}>{data.ready ? 'Ready to advance' : 'Not yet ready'}</span>
              {data.score !== undefined && <span className="text-xs text-text-muted ml-2">{data.score}% complete</span>}
            </div>
          </div>
        </Card>
      )}

      {Array.isArray(gates) && gates.length > 0 && (
        <div className="space-y-1 mb-4">
          {gates.map((gate: any, i: number) => (
            <Card key={gate.id || gate.policy_id || i} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">{gate.name || gate.policy_name || `Gate ${i + 1}`}</p>
                {gate.severity && <span className={cn('text-[10px] uppercase font-medium', gate.severity === 'blocking' ? 'text-red-400' : gate.severity === 'warning' ? 'text-amber-400' : 'text-text-muted')}>{gate.severity}</span>}
                {(gate.details?.message || gate.message || gate.description) && (
                  <p className="text-xs text-text-muted mt-0.5">{gate.details?.message || gate.message || gate.description}</p>
                )}
              </div>
              <Badge className={(gate.passed ?? (gate.result === 'pass')) ? statusColors.passing : statusColors.failing}>{(gate.passed ?? (gate.result === 'pass')) ? 'Passed' : gate.result === 'skip' ? 'Skipped' : 'Failed'}</Badge>
            </Card>
          ))}
        </div>
      )}

      {/* Coverage gaps */}
      {Array.isArray(gapsList) && gapsList.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> Coverage Gaps</p>
          <div className="space-y-1">
            {gapsList.map((gap: any, i: number) => (
              <Card key={i} className="px-4 py-2.5 border-amber-500/10">
                <p className="text-xs text-text-secondary">{gap.description || gap.message || `${gap.type}: ${gap.entity_type || ''}`}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════ AI KICKSTART BUTTON ═══════ */

function KickstartButton({ flowId, hasData }: { flowId: string; hasData: boolean }) {
  const queryClient = useQueryClient();
  const [polling, setPolling] = useState(false);
  const [showRepoInput, setShowRepoInput] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');

  function startPolling(jobId: string, message: string) {
    toast.success(message);
    setPolling(true);
    setShowRepoInput(false);
    const interval = setInterval(async () => {
      try {
        const status = await api.get<{ status: string }>(`/jobs/${jobId}`);
        if (status.status === 'completed') {
          clearInterval(interval);
          setPolling(false);
          queryClient.invalidateQueries({ queryKey: ['flows', flowId] });
          queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'trace'] });
          queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'traceability'] });
          toast.success('Generation complete! Check Traceability tab for the full picture.');
        } else if (status.status === 'failed') {
          clearInterval(interval);
          setPolling(false);
          toast.error('AI generation failed. Try again.');
        }
      } catch { /* keep polling */ }
    }, 3000);
    setTimeout(() => { clearInterval(interval); setPolling(false); }, 300_000);
  }

  const kickstart = useMutation({
    mutationFn: () => api.post<{ job_id: string }>(`/flows/${flowId}/kickstart`),
    onSuccess: (data) => startPolling(data.job_id, 'AI is generating your flow breakdown...'),
    onError: (err: any) => toast.error(err.message),
  });

  const repoKickstart = useMutation({
    mutationFn: (url: string) => api.post<{ job_id: string }>(`/flows/${flowId}/kickstart-from-repo`, { repo_url: url }),
    onSuccess: (data) => startPolling(data.job_id, 'Analyzing repository and generating full breakdown with artifacts... This may take a minute.'),
    onError: (err: any) => toast.error(err.message),
  });

  if (hasData) return null;

  const busy = kickstart.isPending || repoKickstart.isPending || polling;

  return (
    <div className="flex items-center gap-2 relative">
      {/* Standard kickstart */}
      <Button
        size="sm"
        onClick={() => kickstart.mutate()}
        disabled={busy}
        className="bg-gradient-to-r from-accent-cyan/20 to-accent-blue/20 border-accent-cyan/30 hover:from-accent-cyan/30 hover:to-accent-blue/30 text-accent-cyan"
      >
        {polling ? (
          <><Spinner className="w-3 h-3" /> AI generating...</>
        ) : kickstart.isPending ? (
          <><Spinner className="w-3 h-3" /> Starting...</>
        ) : (
          <><Zap className="w-3.5 h-3.5" /> AI Kickstart</>
        )}
      </Button>

      {/* GitHub repo kickstart */}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setShowRepoInput(!showRepoInput)}
        disabled={busy}
      >
        <GitBranch className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">From Repo</span>
      </Button>

      {showRepoInput && (
        <div className="absolute top-full right-0 mt-1.5 w-80 sm:w-96 bg-surface-1 border border-edge rounded-lg shadow-xl shadow-black/40 z-50 p-3 animate-slide-down">
          <p className="text-xs font-medium text-text-primary mb-1">Import from GitHub Repository</p>
          <p className="text-[10px] text-text-muted mb-3">
            AI will analyze the codebase, README, issues, and structure to generate initiatives, requirements, tasks, and artifacts.
          </p>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className={inputClass}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && repoUrl.includes('github.com')) repoKickstart.mutate(repoUrl);
              if (e.key === 'Escape') setShowRepoInput(false);
            }}
          />
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => repoKickstart.mutate(repoUrl)}
              disabled={!repoUrl.includes('github.com') || repoKickstart.isPending}
              className="flex-1"
            >
              {repoKickstart.isPending ? <><Spinner className="w-3 h-3" /> Analyzing...</> : <><Zap className="w-3.5 h-3.5" /> Generate</>}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowRepoInput(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════ TRACEABILITY TAB ═══════ */

function TraceabilityTab({ flowId }: { flowId: string }) {
  const [view, setView] = useState<'graph' | 'tree'>('graph');

  const { data, isLoading } = useQuery({
    queryKey: ['flows', flowId, 'traceability'],
    queryFn: () => api.get<any>(`/flows/${flowId}/traceability`),
  });

  const { data: graphData, isLoading: graphLoading } = useQuery({
    queryKey: ['flows', flowId, 'trace'],
    queryFn: () => api.get<any>(`/flows/${flowId}/trace`),
    enabled: view === 'graph',
  });

  const hasTreeData = data && data.initiatives?.length;
  const hasGraphData = graphData && graphData.nodes?.length;

  if (isLoading && graphLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  if (!hasTreeData && !hasGraphData) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No traceability data"
        description="Use AI Kickstart to generate the full flow breakdown, or create initiatives in the Planning tab."
      />
    );
  }

  // Compute stats from tree data
  let totalReqs = 0, totalTasks = 0, totalEvidence = 0, completedTasks = 0, passingEvidence = 0;
  if (hasTreeData) {
    for (const init of data.initiatives) {
      for (const obj of init.objectives) {
        for (const req of obj.requirements) {
          totalReqs++;
          totalTasks += req.tasks.length;
          totalEvidence += req.evidence.length;
          completedTasks += req.tasks.filter((t: any) => t.status === 'done').length;
          passingEvidence += req.evidence.filter((e: any) => e.status === 'passing').length;
        }
      }
    }
  }

  return (
    <div>
      {/* View toggle + stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 sm:mr-4">
          <div className="bg-surface-1 border border-edge rounded-md px-3 py-2 text-center">
            <p className="text-lg font-semibold font-mono text-text-primary">{totalReqs}</p>
            <p className="text-[10px] text-text-muted uppercase">Requirements</p>
          </div>
          <div className="bg-surface-1 border border-edge rounded-md px-3 py-2 text-center">
            <p className="text-lg font-semibold font-mono text-text-primary">{completedTasks}<span className="text-text-muted">/{totalTasks}</span></p>
            <p className="text-[10px] text-text-muted uppercase">Tasks Done</p>
          </div>
          <div className="bg-surface-1 border border-edge rounded-md px-3 py-2 text-center">
            <p className="text-lg font-semibold font-mono text-text-primary">{passingEvidence}<span className="text-text-muted">/{totalEvidence}</span></p>
            <p className="text-[10px] text-text-muted uppercase">Evidence Passing</p>
          </div>
          <div className="bg-surface-1 border border-edge rounded-md px-3 py-2 text-center">
            <p className="text-lg font-semibold font-mono text-text-primary">{totalReqs > 0 ? Math.round((completedTasks / Math.max(totalTasks, 1)) * 100) : 0}%</p>
            <p className="text-[10px] text-text-muted uppercase">Completion</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-surface-1 border border-edge rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setView('graph')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all',
              view === 'graph'
                ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            <Network className="w-3 h-3" />
            Graph
          </button>
          <button
            onClick={() => setView('tree')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all',
              view === 'tree'
                ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            <List className="w-3 h-3" />
            Tree
          </button>
        </div>
      </div>

      {/* Graph view */}
      {view === 'graph' && (
        <div className="relative w-full rounded-lg border border-edge overflow-hidden bg-surface-0" style={{ height: 'calc(100vh - 420px)', minHeight: 360 }}>
          {graphLoading ? (
            <div className="flex items-center justify-center h-full"><Spinner className="h-5 w-5" /></div>
          ) : hasGraphData ? (
            <SpecGraph graph={graphData} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-text-muted">No graph data available. Add entities to see the spec graph.</p>
            </div>
          )}
        </div>
      )}

      {/* Tree view */}
      {view === 'tree' && hasTreeData && (
        <>
          <div className="space-y-3">
            {data.initiatives.map((init: any) => (
              <Card key={init.id} className="overflow-hidden">
                <div className="px-4 py-2.5 bg-surface-2/50 border-b border-edge">
                  <div className="flex items-center gap-2">
                    <Flag className="w-3.5 h-3.5 text-accent-cyan" />
                    <span className="text-sm font-medium text-text-primary">{init.title}</span>
                    <Badge>{init.status || 'active'}</Badge>
                  </div>
                </div>
                <div className="px-4 py-2">
                  {init.objectives.map((obj: any) => (
                    <div key={obj.id} className="mb-3 last:mb-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Crosshair className="w-3 h-3 text-accent-blue" />
                        <span className="text-xs font-medium text-text-secondary">{obj.title}</span>
                      </div>
                      <div className="ml-5 space-y-1.5">
                        {obj.requirements.map((req: any) => {
                          const tasksDone = req.tasks.filter((t: any) => t.status === 'done').length;
                          const evidencePassing = req.evidence.filter((e: any) => e.status === 'passing').length;
                          const isComplete = req.tasks.length > 0 && tasksDone === req.tasks.length && req.evidence.length > 0 && evidencePassing === req.evidence.length;
                          const hasIssues = req.evidence.some((e: any) => e.status === 'failing') || req.tasks.some((t: any) => t.status === 'blocked');

                          return (
                            <div key={req.id} className="bg-surface-1 rounded-md border border-edge px-3 py-2">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-2 min-w-0">
                                  {isComplete ? <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> : hasIssues ? <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />}
                                  <div className="min-w-0">
                                    <p className="text-xs text-text-primary">{req.title}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-[10px] text-text-muted">{req.type} · {req.priority}</span>
                                      <Badge className={statusColors[req.status] || 'bg-surface-3 text-text-muted'}>{req.status}</Badge>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  {req.tasks.length > 0 && (
                                    <span className={cn('text-[10px] font-mono', tasksDone === req.tasks.length ? 'text-green-400' : 'text-text-muted')}>
                                      {tasksDone}/{req.tasks.length} tasks
                                    </span>
                                  )}
                                  {req.evidence.length > 0 && (
                                    <span className={cn('text-[10px] font-mono', evidencePassing === req.evidence.length ? 'text-green-400' : 'text-text-muted')}>
                                      {evidencePassing}/{req.evidence.length} evidence
                                    </span>
                                  )}
                                </div>
                              </div>
                              {req.tasks.length > 0 && (
                                <div className="mt-2 ml-5 space-y-0.5">
                                  {req.tasks.map((t: any) => (
                                    <div key={t.id} className="flex items-center gap-2 text-[11px]">
                                      <ListChecks className="w-2.5 h-2.5 text-text-muted shrink-0" />
                                      <span className={cn('text-text-tertiary', t.status === 'done' && 'line-through text-text-muted')}>{t.title}</span>
                                      <Badge className={cn('text-[9px] py-0 px-1', statusColors[t.status])}>{t.status}</Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {req.evidence.length > 0 && (
                                <div className="mt-1.5 ml-5 space-y-0.5">
                                  {req.evidence.map((e: any) => (
                                    <div key={e.id} className="flex items-center gap-2 text-[11px]">
                                      <TestTube className="w-2.5 h-2.5 text-text-muted shrink-0" />
                                      <span className="text-text-tertiary">{e.type.replace(/_/g, ' ')}</span>
                                      <Badge className={cn('text-[9px] py-0 px-1', statusColors[e.status])}>{e.status}</Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {req.tasks.length === 0 && req.evidence.length === 0 && (
                                <p className="text-[10px] text-text-muted mt-1.5 ml-5 italic">No tasks or evidence linked yet</p>
                              )}
                            </div>
                          );
                        })}
                        {obj.requirements.length === 0 && (
                          <p className="text-[10px] text-text-muted italic">No requirements yet</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Unlinked items */}
          {((data.unlinked_tasks?.length || 0) > 0 || (data.unlinked_evidence?.length || 0) > 0) && (
            <div className="mt-5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Unlinked Items (not tied to any requirement)
              </p>
              <div className="space-y-1">
                {data.unlinked_tasks?.map((t: any) => (
                  <Card key={t.id} className="px-4 py-2 border-amber-500/10">
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-3 h-3 text-text-muted" />
                      <span className="text-xs text-text-secondary">Task: {t.title}</span>
                      <Badge className={statusColors[t.status]}>{t.status}</Badge>
                    </div>
                  </Card>
                ))}
                {data.unlinked_evidence?.map((e: any) => (
                  <Card key={e.id} className="px-4 py-2 border-amber-500/10">
                    <div className="flex items-center gap-2">
                      <TestTube className="w-3 h-3 text-text-muted" />
                      <span className="text-xs text-text-secondary">Evidence: {e.type.replace(/_/g, ' ')}</span>
                      <Badge className={statusColors[e.status]}>{e.status}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
