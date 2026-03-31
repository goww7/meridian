import { useParams, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useFlow, useTransitionFlow } from '../../hooks/use-flows';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { stageColors, priorityColors, cn } from '../../lib/utils';
import { VALID_TRANSITIONS } from '@meridian/shared';
import { toast } from 'sonner';

const TABS = [
  { path: '', label: 'Overview' },
  { path: 'artifacts', label: 'Artifacts' },
  { path: 'requirements', label: 'Requirements' },
  { path: 'tasks', label: 'Tasks' },
  { path: 'evidence', label: 'Evidence' },
  { path: 'readiness', label: 'Readiness' },
];

export function FlowDetailPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const { data: flow, isLoading } = useFlow(flowId!);
  const transition = useTransitionFlow();
  const location = useLocation();

  if (isLoading) return <p className="text-slate-500">Loading...</p>;
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

  const basePath = `/flows/${flowId}`;
  const activeTab = location.pathname.replace(basePath, '').replace(/^\//, '') || '';

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
            <Link
              key={tab.path}
              to={tab.path ? `${basePath}/${tab.path}` : basePath}
              className={cn(
                'pb-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.path
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tab content placeholder */}
      <Card className="p-6">
        <p className="text-slate-500">Select a tab to view details. Full tab content is rendered per-route.</p>
      </Card>
    </div>
  );
}
