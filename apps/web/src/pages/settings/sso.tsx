import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { statusColors, cn } from '../../lib/utils';
import { ShieldCheck, Plus, X, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const SSO_PROVIDERS: Record<string, { label: string; fields: string[] }> = {
  saml: { label: 'SAML 2.0', fields: ['idp_entity_id', 'idp_sso_url', 'idp_certificate'] },
  oidc: { label: 'OpenID Connect', fields: ['client_id', 'client_secret', 'issuer_url'] },
};

const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

export function SsoSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState<'saml' | 'oidc'>('saml');
  const [displayName, setDisplayName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [metadataUrl, setMetadataUrl] = useState('');

  const { data: configs } = useQuery({ queryKey: ['sso', 'configs'], queryFn: () => api.get<any[]>('/sso/configs') });

  const create = useMutation({
    mutationFn: () => api.post('/sso/configs', { provider, display_name: displayName, config, metadata_url: metadataUrl || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso'] });
      setShowForm(false);
      setDisplayName('');
      setConfig({});
      toast.success('SSO configuration created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/sso/configs/${id}`, { enabled }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sso'] }); toast.success('Updated'); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/sso/configs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sso'] }); toast.success('Removed'); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-text-primary">Single Sign-On (SSO)</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Provider</>}
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 mb-4 animate-slide-up">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Provider</label>
                <select value={provider} onChange={(e) => { setProvider(e.target.value as 'saml' | 'oidc'); setConfig({}); }} className={inputClass}>
                  <option value="saml">SAML 2.0</option>
                  <option value="oidc">OpenID Connect (OIDC)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Display Name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="Company SSO" />
              </div>
            </div>

            {provider === 'saml' && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Metadata URL <span className="text-text-muted">(optional)</span></label>
                <input value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} className={inputClass} placeholder="https://idp.example.com/metadata" />
              </div>
            )}

            {(SSO_PROVIDERS[provider]?.fields || []).map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </label>
                {field.includes('certificate') ? (
                  <textarea value={config[field] || ''} onChange={(e) => setConfig({ ...config, [field]: e.target.value })}
                    className={cn(inputClass, 'font-mono text-xs resize-none')} rows={4} placeholder="-----BEGIN CERTIFICATE-----" />
                ) : (
                  <input type={field.includes('secret') ? 'password' : 'text'} value={config[field] || ''}
                    onChange={(e) => setConfig({ ...config, [field]: e.target.value })} className={inputClass} />
                )}
              </div>
            ))}

            <Button size="sm" onClick={() => create.mutate()} disabled={!displayName || create.isPending}>Save Configuration</Button>
          </div>
        </Card>
      )}

      {!configs?.length ? (
        <EmptyState icon={ShieldCheck} title="No SSO configured" description="Configure SAML or OIDC for enterprise single sign-on." action={{ label: 'Add Provider', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="space-y-1">
          {configs.map((c: any) => (
            <Card key={c.id} className="px-4 py-3 flex items-center justify-between group">
              <div>
                <p className="text-sm text-text-primary">{c.display_name}</p>
                <p className="text-xs text-text-muted mt-0.5">{SSO_PROVIDERS[c.provider]?.label || c.provider}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={c.enabled ? statusColors.active : statusColors.disabled}>
                  {c.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <button onClick={() => toggle.mutate({ id: c.id, enabled: !c.enabled })}
                  className={cn('p-1 rounded transition-colors', c.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-text-muted hover:bg-surface-3')}>
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove.mutate(c.id)}
                  className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
