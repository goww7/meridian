import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { stageColors } from '../../lib/utils';

export function PoliciesPage() {
  const { data: policies, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => api.get<any[]>('/policies'),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Policies</h1>
      {isLoading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="space-y-2">
          {(policies || []).map((p: any) => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium font-mono text-sm">{p.name}</p>
                <p className="text-sm text-slate-500 mt-0.5">{p.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={stageColors[p.stage]}>{p.stage}</Badge>
                <Badge className={p.severity === 'blocking' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                  {p.severity}
                </Badge>
                <Badge className={p.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                  {p.enabled ? 'active' : 'disabled'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
