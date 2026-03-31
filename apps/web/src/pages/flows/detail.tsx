import { useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useFlow, useTransitionFlow, useFlowReadiness } from '../../hooks/use-flows';
import { useArtifacts } from '../../hooks/use-artifacts';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { stageColors, priorityColors, cn } from '../../lib/utils';
import { VALID_TRANSITIONS } from '@meridian/shared';
import { toast } from 'sonner';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'readiness', label: 'Readiness' },
];

export function FlowDetailPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const { data: flow, isLoading } = useFlow(flowId!);
  const transition = useTransitionFlow();
  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;
  if (!flow) return <p className="text-slate-500">Flow not found</p>;

  const nextStages = VALID_TRANSITIONS[flow.current_stage as keyof typeof VALID_TRANSITIONS] || [];

  async function handleTransition(toStage: string) {
    try {
      await transition.mutateAsync({ flowId: flowId!, to_stage: toStage });
      toast.success(`Flow advanced to ${toStage}`);
    } catch (err: any) {
      toast.error(err.message || 'Gate evaluation failed');
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{flow.title}</h1>
          <p className="text-slate-500 mt-1">{flow.description}</p>
          <div className="flex items-center gap-2 mt-3">
            <Badge className={stageColors[flow.current_stage]}>{flow.current_stage}</Badge>
            <Badge className={priorityColors[flow.priority]}>{flow.priority}</Badge>
            {flow.sensitivity !== 'low' && (
              <Badge className="bg-orange-100 text-orange-700">sensitivity: {flow.sensitivity}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {nextStages.filter((s: string) => s !== flow.current_stage).map((stage: string) => (
            <Button
              key={stage}
              size="sm"
              onClick={() => handleTransition(stage)}
              disabled={transition.isPending}
            >
              {stage === 'done' ? 'Complete' : `Advance to ${stage}`}
            </Button>
          ))}
        </div>
      </div>

      {/* Stage timeline */}
      <div className="flex items-center gap-1 mb-6">
        {['assess', 'plan', 'build', 'release', 'done'].map((stage, i) => {
          const stageIndex = ['assess', 'plan', 'build', 'release', 'done'].indexOf(flow.current_stage);
          const isActive = stage === flow.current_stage;
          const isPast = i < stageIndex;
          return (
            <div key={stage} className="flex items-center">
              <div className={cn(
                'px-3 py-1 rounded text-xs font-medium',
                isActive ? stageColors[stage] : isPast ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400',
              )}>
                {stage}
              </div>
              {i < 4 && <div className={cn('w-6 h-0.5', isPast ? 'bg-green-300' : 'bg-slate-200')} />}
            </div>
          );
        })}
      </div>

      {/* Counts */}
      {flow.counts && (
        <div className="grid grid-cols-6 gap-3 mb-6">
          {Object.entries(flow.counts).map(([key, val]) => (
            <Card key={key} className="p-3 text-center">
              <p className="text-2xl font-bold">{val as number}</p>
              <p className="text-xs text-slate-500 capitalize">{key}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab flow={flow} />}
      {activeTab === 'requirements' && <RequirementsTab flowId={flowId!} />}
      {activeTab === 'tasks' && <TasksTab flowId={flowId!} />}
      {activeTab === 'artifacts' && <ArtifactsTab flowId={flowId!} />}
      {activeTab === 'evidence' && <EvidenceTab flowId={flowId!} />}
      {activeTab === 'readiness' && <ReadinessTab flowId={flowId!} />}
    </div>
  );
}

function OverviewTab({ flow }: { flow: any }) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-500">Description</h3>
          <p className="mt-1 text-sm text-slate-900">{flow.description || 'No description provided.'}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-500">Owner</h3>
            <p className="mt-1 text-sm text-slate-900">{flow.owner_name || 'Unassigned'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500">Created</h3>
            <p className="mt-1 text-sm text-slate-900">{new Date(flow.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500">Priority</h3>
            <p className="mt-1"><Badge className={priorityColors[flow.priority]}>{flow.priority}</Badge></p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500">Sensitivity</h3>
            <p className="mt-1 text-sm text-slate-900 capitalize">{flow.sensitivity}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RequirementsTab({ flowId }: { flowId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['flows', flowId, 'requirements'],
    queryFn: () => api.get<any>(`/flows/${flowId}/requirements`),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const requirements = data?.data || data || [];

  if (!Array.isArray(requirements) || requirements.length === 0) {
    return <EmptyState icon="📋" title="No requirements" description="Requirements will appear here once added to this flow." />;
  }

  return (
    <div className="space-y-2">
      {requirements.map((req: any) => (
        <Card key={req.id} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{req.title}</p>
              <p className="text-sm text-slate-500 mt-1">{req.description}</p>
            </div>
            <Badge className={req.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
              {req.status || 'open'}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TasksTab({ flowId }: { flowId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['flows', flowId, 'tasks'],
    queryFn: () => api.get<any>(`/flows/${flowId}/tasks`),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const tasks = data?.data || data || [];

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return <EmptyState icon="✅" title="No tasks" description="Tasks will appear here once created for this flow." />;
  }

  const statusColors: Record<string, string> = {
    todo: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    blocked: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-2">
      {tasks.map((task: any) => (
        <Card key={task.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{task.title}</p>
              {task.assignee_name && <p className="text-sm text-slate-500 mt-0.5">{task.assignee_name}</p>}
            </div>
            <Badge className={statusColors[task.status] || 'bg-slate-100 text-slate-600'}>
              {task.status || 'todo'}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ArtifactsTab({ flowId }: { flowId: string }) {
  const { data, isLoading } = useArtifacts(flowId);

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const artifacts = Array.isArray(data) ? data : (data as any)?.data || [];

  if (artifacts.length === 0) {
    return <EmptyState icon="📄" title="No artifacts" description="AI-generated artifacts will appear here." />;
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-2">
      {artifacts.map((artifact: any) => (
        <Card key={artifact.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{artifact.title || artifact.type}</p>
              <p className="text-sm text-slate-500 mt-0.5">v{artifact.version || 1} - {artifact.type}</p>
            </div>
            <Badge className={statusColors[artifact.status] || 'bg-slate-100 text-slate-600'}>
              {artifact.status || 'draft'}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EvidenceTab({ flowId }: { flowId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['flows', flowId, 'evidence'],
    queryFn: () => api.get<any>(`/flows/${flowId}/evidence`),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const evidence = data?.data || data || [];

  if (!Array.isArray(evidence) || evidence.length === 0) {
    return <EmptyState icon="🔍" title="No evidence" description="Evidence items will appear here as they are collected." />;
  }

  const statusColors: Record<string, string> = {
    passing: 'bg-green-100 text-green-700',
    failing: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-2">
      {evidence.map((ev: any) => (
        <Card key={ev.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{ev.title || ev.type}</p>
              <p className="text-sm text-slate-500 mt-0.5">{ev.source || ev.type}</p>
            </div>
            <Badge className={statusColors[ev.status] || 'bg-slate-100 text-slate-600'}>
              {ev.status || 'pending'}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ReadinessTab({ flowId }: { flowId: string }) {
  const { data, isLoading } = useFlowReadiness(flowId);

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  if (!data) {
    return <EmptyState icon="📊" title="No readiness data" description="Readiness checks will appear here." />;
  }

  const gates = data?.gates || data?.checks || [];

  return (
    <div>
      {data.ready !== undefined && (
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${data.ready ? 'text-green-600' : 'text-amber-600'}`}>
              {data.ready ? 'Ready to advance' : 'Not yet ready'}
            </span>
            {data.score !== undefined && (
              <Badge className="bg-slate-100 text-slate-600">{data.score}% complete</Badge>
            )}
          </div>
        </Card>
      )}
      {Array.isArray(gates) && gates.length > 0 && (
        <div className="space-y-2">
          {gates.map((gate: any, i: number) => (
            <Card key={gate.id || i} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{gate.name || gate.policy_name || `Gate ${i + 1}`}</p>
                  {gate.description && <p className="text-sm text-slate-500 mt-0.5">{gate.description}</p>}
                </div>
                <Badge className={gate.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {gate.passed ? 'Passed' : 'Failed'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
