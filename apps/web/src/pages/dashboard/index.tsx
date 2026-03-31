import { useFlows } from '../../hooks/use-flows';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Link } from 'react-router-dom';
import { stageColors, priorityColors } from '../../lib/utils';

export function DashboardPage() {
  const { data, isLoading } = useFlows();
  const flows = data?.data || [];

  const byStageCounts = flows.reduce((acc: Record<string, number>, f: any) => {
    acc[f.current_stage] = (acc[f.current_stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stage summary */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {['assess', 'plan', 'build', 'release', 'done'].map((stage) => (
          <Card key={stage} className="p-4 text-center">
            <Badge className={stageColors[stage]}>{stage}</Badge>
            <p className="text-3xl font-bold mt-2">{byStageCounts[stage] || 0}</p>
          </Card>
        ))}
      </div>

      {/* Recent flows */}
      <h2 className="text-lg font-semibold mb-4">Recent Flows</h2>
      {isLoading ? (
        <p className="text-slate-500">Loading...</p>
      ) : flows.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          No flows yet. <Link to="/flows" className="text-blue-600 hover:underline">Create your first flow</Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {flows.slice(0, 10).map((flow: any) => (
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
