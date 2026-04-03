import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { statusColors, cn, formatDate } from '../../lib/utils';
import { Key, Plus, X, Copy, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

export function ApiKeysSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', scopes: ['read'], expires_in_days: 90 });

  const { data: keys, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: () => api.get<any[]>('/api-keys') });

  const create = useMutation({
    mutationFn: () => api.post<any>('/api-keys', form),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKey(data.key);
      setShowForm(false);
      setForm({ name: '', scopes: ['read'], expires_in_days: 90 });
      toast.success('API key created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const revoke = useMutation({
    mutationFn: (keyId: string) => api.del(`/api-keys/${keyId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Revoked'); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-text-primary">API Keys</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Create Key</>}
        </Button>
      </div>

      {newKey && (
        <Card className="p-4 mb-4 border-accent-cyan/20 bg-accent-cyan/5">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <p className="text-xs text-text-primary">Copy this key now. It won't be shown again.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-surface-2 px-3 py-1.5 rounded text-xs font-mono text-accent-cyan break-all border border-edge">{newKey}</code>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied'); }}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="p-4 mb-4 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="CI/CD Key" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Scopes</label>
              <select value={form.scopes[0]} onChange={(e) => setForm({ ...form, scopes: [e.target.value] })} className={inputClass}>
                <option value="read">Read Only</option>
                <option value="write">Read/Write</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Expires (days)</label>
              <input type="number" value={form.expires_in_days} onChange={(e) => setForm({ ...form, expires_in_days: parseInt(e.target.value) })} className={inputClass} />
            </div>
          </div>
          <Button size="sm" className="mt-3" onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create</Button>
        </Card>
      )}

      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : !keys?.length ? (
        <EmptyState icon={Key} title="No API keys" description="Create a key for programmatic access." action={{ label: 'Create Key', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="space-y-1">
          {keys.map((k: any) => (
            <Card key={k.id} className="px-4 py-3 flex items-center justify-between group">
              <div>
                <p className="text-sm text-text-primary">{k.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-text-muted">{k.key_prefix}...</span>
                  <span className="text-[10px] text-text-muted">Scopes: {k.scopes?.join(', ')}</span>
                  {k.last_used_at && <span className="text-[10px] text-text-muted">Last used: {formatDate(k.last_used_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {k.revoked_at ? (
                  <Badge className={statusColors.rejected}>Revoked</Badge>
                ) : k.expires_at && new Date(k.expires_at) < new Date() ? (
                  <Badge className={statusColors.pending}>Expired</Badge>
                ) : (
                  <>
                    <Badge className={statusColors.active}>Active</Badge>
                    <button onClick={() => revoke.mutate(k.id)} className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
