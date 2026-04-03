import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { Tabs } from '../../components/ui/tabs';
import { cn, timeAgo, statusColors } from '../../lib/utils';
import {
  Brain, Plus, X, TestTube, Power, Trash2, Link2, Unlink, Upload,
  Download, FileText, Copy, ExternalLink, Plug, Search, GitBranch,
  Star, Lock, Globe, CheckCircle2, RefreshCw, Eye,
} from 'lucide-react';

// ─── Types ───

interface Connection { id: string; org_id: string; site_url: string; site_name: string; webhook_secret: string; status: string; created_at: string; }
interface ProjectLink { id: string; flow_id: string; connection_id: string; project_key: string; project_name: string; sync_issues: boolean; import_completed: boolean; site_url: string; site_name: string; created_at: string; }
interface SpaceLink { id: string; flow_id: string; connection_id: string; space_key: string; space_name: string; parent_page_id: string | null; sync_direction: string; site_url: string; site_name: string; created_at: string; }
interface PageLink { id: string; artifact_id: string; page_id: string; page_title: string; sync_direction: string; last_synced_at: string | null; last_synced_version: number | null; artifact_title: string; artifact_type: string; created_at: string; }
interface Flow { id: string; title: string; current_stage: string; }
interface LlmConn { id: string; provider: string; display_name: string; model: string; is_active: boolean; status: string; last_tested_at: string | null; created_at: string; }
interface ModelOption { id: string; name: string; tier: string; }

const PROVIDER_INFO: Record<string, { name: string; color: string; bg: string; letter: string }> = {
  anthropic: { name: 'Anthropic', color: 'text-orange-400', bg: 'bg-orange-500/15', letter: 'A' },
  openai: { name: 'OpenAI', color: 'text-emerald-400', bg: 'bg-emerald-500/15', letter: 'O' },
  google: { name: 'Google', color: 'text-blue-400', bg: 'bg-blue-500/15', letter: 'G' },
};

const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

// ─── LLM Panel ───

function LlmPanel() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { data: connections = [], isLoading } = useQuery<LlmConn[]>({ queryKey: ['llm', 'connections'], queryFn: () => api.get('/llm/connections') });
  const { data: availableModels = {} } = useQuery<Record<string, ModelOption[]>>({ queryKey: ['llm', 'models'], queryFn: () => api.get('/llm/models') });
  const [form, setForm] = useState({ provider: 'anthropic', display_name: '', api_key: '', model: '' });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const models = availableModels[form.provider] || [];

  const createMut = useMutation({
    mutationFn: () => api.post('/llm/connections', { provider: form.provider, display_name: form.display_name, api_key: form.api_key, model: form.model || models[0]?.id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['llm'] }); toast.success('Provider connected'); setShowForm(false); setForm({ provider: 'anthropic', display_name: '', api_key: '', model: '' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({ mutationFn: (id: string) => api.del(`/llm/connections/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['llm'] }); toast.success('Removed'); } });
  const activateMut = useMutation({ mutationFn: (id: string) => api.post(`/llm/connections/${id}/activate`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['llm'] }); toast.success('Activated'); } });

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await api.post<any>(`/llm/connections/${id}/test`);
      setTestResults((p) => ({ ...p, [id]: result }));
      result.success ? toast.success(`OK (${result.usage?.output_tokens || 0} tokens)`) : toast.error(`Failed: ${result.error}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setTestingId(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-text-primary">AI Providers</h3>
          <p className="text-xs text-text-muted mt-0.5">Active provider is used for artifact generation</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Provider</>}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-4 animate-slide-up border-accent-cyan/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Provider</label>
              <select className={inputClass} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value, model: '' })}>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Display Name</label>
              <input className={inputClass} placeholder={`My ${PROVIDER_INFO[form.provider]?.name}`} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">API Key</label>
              <input className={cn(inputClass, 'font-mono')} type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Model</label>
              <select className={inputClass} value={form.model || models[0]?.id} onChange={(e) => setForm({ ...form, model: e.target.value })}>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>)}
              </select>
            </div>
          </div>
          <Button size="sm" className="mt-3" onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.display_name || !form.api_key}>
            {createMut.isPending ? 'Connecting...' : 'Connect'}
          </Button>
        </Card>
      )}

      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : connections.length === 0 && !showForm ? (
        <EmptyState icon={Brain} title="No AI providers" description="Connect an API key to enable artifact generation." action={{ label: 'Add Provider', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="space-y-1">
          {connections.map((conn) => {
            const info = PROVIDER_INFO[conn.provider] || { name: conn.provider, color: 'text-text-secondary', bg: 'bg-surface-3', letter: '?' };
            return (
              <Card key={conn.id} className={cn('px-4 py-3 flex items-center justify-between', conn.is_active && 'border-accent-cyan/20')}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs', info.bg, info.color)}>
                    {info.letter}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary">{conn.display_name}</span>
                      <Badge className={cn(info.bg, info.color)}>{info.name}</Badge>
                      {conn.is_active && <Badge className="bg-accent-cyan/15 text-accent-cyan">active</Badge>}
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">{conn.model}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {testResults[conn.id] && <span className={cn('text-[10px] font-medium', testResults[conn.id].success ? 'text-green-400' : 'text-red-400')}>{testResults[conn.id].success ? 'OK' : 'Fail'}</span>}
                  <Button size="sm" variant="ghost" onClick={() => handleTest(conn.id)} disabled={testingId === conn.id}>
                    {testingId === conn.id ? <Spinner className="h-3 w-3" /> : <TestTube className="w-3 h-3" />}
                  </Button>
                  {!conn.is_active && <Button size="sm" variant="ghost" onClick={() => activateMut.mutate(conn.id)}><Power className="w-3 h-3" /></Button>}
                  <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(conn.id)} className="text-text-muted hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Atlassian Panel ───

function AtlassianPanel({ mode }: { mode: 'jira' | 'confluence' }) {
  const [showConnForm, setShowConnForm] = useState(false);
  const [connForm, setConnForm] = useState({ site_url: '', site_name: '', access_token: '', refresh_token: '' });
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading: loadingConn } = useQuery<Connection[]>({ queryKey: ['jira', 'connections'], queryFn: () => api.get('/jira/connections') });
  const { data: flowsData } = useQuery<{ data: Flow[] }>({ queryKey: ['flows', 'all'], queryFn: () => api.get('/flows?limit=100') });
  const flows = flowsData?.data || [];
  const selectedFlow = flows.find((f) => f.id === selectedFlowId);

  const createConn = useMutation({
    mutationFn: () => api.post('/jira/connections', { site_url: connForm.site_url, site_name: connForm.site_name, access_token: connForm.access_token, refresh_token: connForm.refresh_token || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jira'] }); toast.success('Connected'); setShowConnForm(false); setConnForm({ site_url: '', site_name: '', access_token: '', refresh_token: '' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteConn = useMutation({
    mutationFn: (id: string) => api.del(`/jira/connections/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jira'] }); toast.success('Disconnected'); },
  });

  return (
    <div className="space-y-6">
      {/* Connections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Atlassian Connections</h3>
            <p className="text-xs text-text-muted mt-0.5">Shared by Jira and Confluence</p>
          </div>
          <Button size="sm" onClick={() => setShowConnForm(!showConnForm)}>
            {showConnForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Connect Site</>}
          </Button>
        </div>

        {showConnForm && (
          <Card className="p-4 mb-3 animate-slide-up border-blue-500/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Site URL</label><input className={inputClass} placeholder="https://acme.atlassian.net" value={connForm.site_url} onChange={(e) => setConnForm({ ...connForm, site_url: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Site Name</label><input className={inputClass} placeholder="Acme Corp" value={connForm.site_name} onChange={(e) => setConnForm({ ...connForm, site_name: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Access Token</label><input className={cn(inputClass, 'font-mono')} type="password" value={connForm.access_token} onChange={(e) => setConnForm({ ...connForm, access_token: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Refresh Token <span className="text-text-muted">(optional)</span></label><input className={cn(inputClass, 'font-mono')} type="password" value={connForm.refresh_token} onChange={(e) => setConnForm({ ...connForm, refresh_token: e.target.value })} /></div>
            </div>
            <Button size="sm" className="mt-3" onClick={() => createConn.mutate()} disabled={createConn.isPending || !connForm.site_url || !connForm.site_name || !connForm.access_token}>Connect</Button>
          </Card>
        )}

        {loadingConn ? <div className="py-8 flex justify-center"><Spinner /></div> : connections.length === 0 && !showConnForm ? (
          <EmptyState icon={Link2} title="No sites connected" description="Connect your Atlassian Cloud site." action={{ label: 'Connect', onClick: () => setShowConnForm(true) }} />
        ) : (
          <div className="space-y-1">
            {connections.map((conn) => (
              <Card key={conn.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-blue-500/15 flex items-center justify-center text-blue-400 font-bold text-xs">{conn.site_name.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary">{conn.site_name}</span>
                      <Badge className={statusColors.active}>{conn.status}</Badge>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">{conn.site_url}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-text-muted">{conn.webhook_secret?.slice(0, 12)}...</span>
                  <button onClick={() => { navigator.clipboard.writeText(conn.webhook_secret); toast.success('Copied'); }} className="text-text-muted hover:text-text-secondary"><Copy className="w-3 h-3" /></button>
                  <Button size="sm" variant="danger" onClick={() => deleteConn.mutate(conn.id)}>Disconnect</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Flow selector */}
      {connections.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-1">{mode === 'jira' ? 'Jira Project Mapping' : 'Confluence Space Mapping'}</h3>
          <p className="text-xs text-text-muted mb-3">Select a flow to manage its integrations</p>
          <select className={cn(inputClass, 'max-w-md')} value={selectedFlowId} onChange={(e) => setSelectedFlowId(e.target.value)}>
            <option value="">Choose a flow...</option>
            {flows.map((f) => <option key={f.id} value={f.id}>{f.title} ({f.current_stage})</option>)}
          </select>

          {selectedFlow && (
            <div className="mt-4">
              <FlowIntegrationDetail flow={selectedFlow} connections={connections} mode={mode} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Flow Integration Detail ───

function FlowIntegrationDetail({ flow, connections, mode }: { flow: Flow; connections: Connection[]; mode: 'jira' | 'confluence' }) {
  const queryClient = useQueryClient();
  const [showLinkForm, setShowLinkForm] = useState(false);

  const { data: projectLinks = [] } = useQuery<ProjectLink[]>({ queryKey: ['jira', 'project-links', flow.id], queryFn: () => api.get(`/flows/${flow.id}/jira/links`) });
  const { data: spaceLinks = [] } = useQuery<SpaceLink[]>({ queryKey: ['confluence', 'space-links', flow.id], queryFn: () => api.get(`/flows/${flow.id}/confluence/spaces`) });
  const { data: pageLinks = [] } = useQuery<PageLink[]>({ queryKey: ['confluence', 'page-links', flow.id], queryFn: () => api.get(`/flows/${flow.id}/confluence/pages`) });

  // ─── Jira link form state ───
  const [jiraForm, setJiraForm] = useState({ connection_id: connections[0]?.id || '', project_key: '', project_name: '' });
  const linkJira = useMutation({
    mutationFn: () => api.post(`/flows/${flow.id}/jira/link`, jiraForm),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jira', 'project-links', flow.id] }); toast.success('Linked'); setShowLinkForm(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const unlinkJira = useMutation({ mutationFn: (id: string) => api.del(`/flows/${flow.id}/jira/link/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jira', 'project-links', flow.id] }); toast.success('Unlinked'); } });

  // ─── Confluence link form state ───
  const [confForm, setConfForm] = useState({ connection_id: connections[0]?.id || '', space_key: '', space_name: '', parent_page_id: '', sync_direction: 'publish' });
  const linkConf = useMutation({
    mutationFn: () => api.post(`/flows/${flow.id}/confluence/spaces`, { ...confForm, parent_page_id: confForm.parent_page_id || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['confluence', 'space-links', flow.id] }); toast.success('Linked'); setShowLinkForm(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const unlinkConf = useMutation({ mutationFn: (id: string) => api.del(`/flows/${flow.id}/confluence/spaces/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['confluence', 'space-links', flow.id] }); toast.success('Unlinked'); } });

  // ─── Jira import ───
  const [importLinkId, setImportLinkId] = useState(projectLinks[0]?.id || '');
  const importMut = useMutation({
    mutationFn: () => api.post(`/flows/${flow.id}/jira/import`, { project_link_id: importLinkId, include_done: false }),
    onSuccess: (data: any) => toast.success(`Imported ${data.imported?.tasks || 0} tasks`),
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Confluence publish ───
  const { data: artifacts } = useQuery<any[]>({ queryKey: ['artifacts', flow.id], queryFn: () => api.get(`/flows/${flow.id}/artifacts`), enabled: mode === 'confluence' });
  const [publishArtifactId, setPublishArtifactId] = useState('');
  const [publishSpaceId, setPublishSpaceId] = useState('');
  const publishMut = useMutation({
    mutationFn: () => api.post(`/artifacts/${publishArtifactId}/confluence/publish`, { space_link_id: publishSpaceId }),
    onSuccess: (data: any) => toast.success(`Published: ${data.page_title}`),
    onError: (e: Error) => toast.error(e.message),
  });
  const publishSpaces = spaceLinks.filter((s) => s.sync_direction === 'publish');

  if (mode === 'jira') {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-text-primary">{flow.title}</h4>
          <Button size="sm" variant="ghost" onClick={() => setShowLinkForm(!showLinkForm)}><Plus className="w-3 h-3" /> Link Project</Button>
        </div>

        {showLinkForm && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 p-3 bg-surface-2 rounded-md border border-edge animate-slide-up">
            <select className={inputClass} value={jiraForm.connection_id} onChange={(e) => setJiraForm({ ...jiraForm, connection_id: e.target.value })}>
              {connections.map((c) => <option key={c.id} value={c.id}>{c.site_name}</option>)}
            </select>
            <input className={cn(inputClass, 'font-mono uppercase')} placeholder="PROJ" value={jiraForm.project_key} onChange={(e) => setJiraForm({ ...jiraForm, project_key: e.target.value.toUpperCase() })} />
            <div className="flex gap-2">
              <input className={inputClass} placeholder="Project Name" value={jiraForm.project_name} onChange={(e) => setJiraForm({ ...jiraForm, project_name: e.target.value })} />
              <Button size="sm" onClick={() => linkJira.mutate()} disabled={linkJira.isPending || !jiraForm.project_key || !jiraForm.project_name}>Link</Button>
            </div>
          </div>
        )}

        {projectLinks.length === 0 ? <p className="text-xs text-text-muted">No projects linked</p> : (
          <div className="space-y-1 mb-4">
            {projectLinks.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-1.5 px-2.5 bg-surface-2 rounded group">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-400">{l.project_key}</span>
                  <span className="text-xs text-text-secondary">{l.project_name}</span>
                  {l.import_completed && <Badge className={statusColors.done}>imported</Badge>}
                </div>
                <button onClick={() => unlinkJira.mutate(l.id)} className="text-text-muted hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Unlink className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        {projectLinks.length > 0 && (
          <div className="p-3 bg-surface-2 rounded-md border border-edge">
            <p className="text-xs font-medium text-text-primary mb-2 flex items-center gap-1.5"><Download className="w-3 h-3" /> Import from Jira</p>
            <div className="flex items-center gap-2">
              <select className={inputClass} value={importLinkId} onChange={(e) => setImportLinkId(e.target.value)}>
                {projectLinks.map((l) => <option key={l.id} value={l.id}>{l.project_key}</option>)}
              </select>
              <Button size="sm" onClick={() => importMut.mutate()} disabled={importMut.isPending}>
                {importMut.isPending ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // Confluence mode
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-text-primary">{flow.title}</h4>
        <Button size="sm" variant="ghost" onClick={() => setShowLinkForm(!showLinkForm)}><Plus className="w-3 h-3" /> Link Space</Button>
      </div>

      {showLinkForm && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 p-3 bg-surface-2 rounded-md border border-edge animate-slide-up">
          <select className={inputClass} value={confForm.connection_id} onChange={(e) => setConfForm({ ...confForm, connection_id: e.target.value })}>
            {connections.map((c) => <option key={c.id} value={c.id}>{c.site_name}</option>)}
          </select>
          <select className={inputClass} value={confForm.sync_direction} onChange={(e) => setConfForm({ ...confForm, sync_direction: e.target.value })}>
            <option value="publish">Publish</option>
            <option value="pull">Pull</option>
          </select>
          <input className={cn(inputClass, 'font-mono uppercase')} placeholder="ENG" value={confForm.space_key} onChange={(e) => setConfForm({ ...confForm, space_key: e.target.value.toUpperCase() })} />
          <input className={inputClass} placeholder="Space Name" value={confForm.space_name} onChange={(e) => setConfForm({ ...confForm, space_name: e.target.value })} />
          <input className={cn(inputClass, 'font-mono col-span-2')} placeholder="Parent Page ID (optional)" value={confForm.parent_page_id} onChange={(e) => setConfForm({ ...confForm, parent_page_id: e.target.value })} />
          <Button size="sm" onClick={() => linkConf.mutate()} disabled={linkConf.isPending || !confForm.space_key || !confForm.space_name}>Link Space</Button>
        </div>
      )}

      {spaceLinks.length === 0 ? <p className="text-xs text-text-muted mb-4">No spaces linked</p> : (
        <div className="space-y-1 mb-4">
          {spaceLinks.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-1.5 px-2.5 bg-surface-2 rounded group">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-purple-400">{l.space_key}</span>
                <span className="text-xs text-text-secondary">{l.space_name}</span>
                <Badge className={l.sync_direction === 'publish' ? statusColors.active : 'bg-orange-500/15 text-orange-400'}>{l.sync_direction}</Badge>
              </div>
              <button onClick={() => unlinkConf.mutate(l.id)} className="text-text-muted hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Unlink className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {publishSpaces.length > 0 && artifacts && artifacts.length > 0 && (
        <div className="p-3 bg-surface-2 rounded-md border border-edge mb-4">
          <p className="text-xs font-medium text-text-primary mb-2 flex items-center gap-1.5"><Upload className="w-3 h-3" /> Publish to Confluence</p>
          <div className="flex items-center gap-2">
            <select className={inputClass} value={publishArtifactId} onChange={(e) => setPublishArtifactId(e.target.value)}>
              <option value="">Select artifact...</option>
              {artifacts.map((a: any) => <option key={a.id} value={a.id}>{a.title} ({a.type})</option>)}
            </select>
            <select className={inputClass} value={publishSpaceId} onChange={(e) => setPublishSpaceId(e.target.value)}>
              <option value="">Select space...</option>
              {publishSpaces.map((s) => <option key={s.id} value={s.id}>{s.space_key}</option>)}
            </select>
            <Button size="sm" onClick={() => publishMut.mutate()} disabled={publishMut.isPending || !publishArtifactId || !publishSpaceId}>Publish</Button>
          </div>
        </div>
      )}

      {pageLinks.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">Synced Pages</p>
          <div className="space-y-1">
            {pageLinks.map((pl) => (
              <div key={pl.id} className="flex items-center justify-between py-1.5 px-2.5 bg-surface-2 rounded text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-text-muted" />
                  <span className="text-text-secondary">{pl.page_title}</span>
                  <Badge className={pl.sync_direction === 'publish' ? statusColors.active : 'bg-orange-500/15 text-orange-400'}>{pl.sync_direction}</Badge>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  {pl.last_synced_version && <span className="font-mono">v{pl.last_synced_version}</span>}
                  {pl.last_synced_at && <span>{timeAgo(pl.last_synced_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── GitHub Panel ───

interface GhConnection { id: string; username: string; avatar_url: string; display_name: string; token_scopes: string; status: string; created_at: string; }
interface GhRepo { id: number; full_name: string; name: string; owner: string; owner_avatar: string; description: string | null; private: boolean; default_branch: string; language: string | null; stars: number; updated_at: string; html_url: string; linked_flow_id: string | null; }
interface GhRepoLink { id: string; flow_id: string; repo_full_name: string; repo_owner: string; repo_name: string; flow_title?: string; created_at: string; }

const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-400', JavaScript: 'bg-yellow-400', Python: 'bg-green-400', Go: 'bg-cyan-400',
  Rust: 'bg-orange-400', Java: 'bg-red-400', Ruby: 'bg-red-500', C: 'bg-gray-400', 'C++': 'bg-pink-400',
  Swift: 'bg-orange-500', Kotlin: 'bg-purple-400', PHP: 'bg-indigo-400', Shell: 'bg-emerald-400',
};

function GitHubPanel() {
  const queryClient = useQueryClient();
  const [showConnect, setShowConnect] = useState(false);
  const [token, setToken] = useState('');
  const [repoSearch, setRepoSearch] = useState('');
  const [linkingRepo, setLinkingRepo] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [view, setView] = useState<'repos' | 'links'>('repos');

  const { data: connection, isLoading } = useQuery<GhConnection | null>({ queryKey: ['github', 'connection'], queryFn: () => api.get('/github/connection') });
  const { data: repos = [], isLoading: loadingRepos, refetch: refetchRepos } = useQuery<GhRepo[]>({
    queryKey: ['github', 'repos', repoSearch],
    queryFn: () => api.get(`/github/repos${repoSearch ? `?search=${encodeURIComponent(repoSearch)}` : ''}`),
    enabled: !!connection,
  });
  const { data: repoLinks = [], refetch: refetchLinks } = useQuery<GhRepoLink[]>({ queryKey: ['github', 'links'], queryFn: () => api.get('/github/links'), enabled: !!connection });
  const { data: flowsData } = useQuery<{ data: Flow[] }>({ queryKey: ['flows', 'all'], queryFn: () => api.get('/flows?limit=100'), enabled: !!connection });
  const flows = flowsData?.data || [];

  const connectMut = useMutation({
    mutationFn: () => api.post('/github/connect', { access_token: token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github'] });
      toast.success('GitHub connected!');
      setShowConnect(false);
      setToken('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMut = useMutation({
    mutationFn: () => api.del('/github/disconnect'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['github'] }); toast.success('Disconnected'); },
  });

  const linkMut = useMutation({
    mutationFn: ({ flowId, repoFullName }: { flowId: string; repoFullName: string }) => api.post(`/flows/${flowId}/github/link`, { repo_full_name: repoFullName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github'] });
      toast.success('Repository linked to flow');
      setLinkingRepo(null);
      setSelectedFlowId('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkMut = useMutation({
    mutationFn: ({ flowId, linkId }: { flowId: string; linkId: string }) => api.del(`/flows/${flowId}/github/link/${linkId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['github'] }); toast.success('Unlinked'); },
  });

  if (isLoading) return <div className="py-12 flex justify-center"><Spinner /></div>;

  // ─── Not connected ───
  if (!connection) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-text-primary">GitHub</h3>
            <p className="text-xs text-text-muted mt-0.5">Connect with a Personal Access Token to browse and link repos</p>
          </div>
        </div>

        {!showConnect ? (
          <EmptyState
            icon={GitBranch}
            title="Connect GitHub"
            description="Use a Personal Access Token to sync repositories, issues, PRs, and CI status with your flows."
            action={{ label: 'Connect GitHub', onClick: () => setShowConnect(true) }}
          />
        ) : (
          <Card className="p-5 max-w-lg animate-slide-up border-accent-cyan/20">
            <h4 className="text-sm font-medium text-text-primary mb-1">Connect with Personal Access Token</h4>
            <p className="text-xs text-text-muted mb-4">
              Generate a token at{' '}
              <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline">
                github.com/settings/tokens
              </a>
              {' '}with <span className="font-mono text-text-secondary">repo</span> scope.
            </p>
            <input
              className={cn(inputClass, 'font-mono')}
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && token.length > 10) connectMut.mutate(); }}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => connectMut.mutate()} disabled={connectMut.isPending || token.length < 10}>
                {connectMut.isPending ? <><Spinner className="w-3 h-3" /> Connecting...</> : 'Connect'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setShowConnect(false); setToken(''); }}>Cancel</Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ─── Connected ───
  return (
    <div className="space-y-5">
      {/* Connection header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {connection.avatar_url ? (
            <img src={connection.avatar_url} alt={connection.username} className="w-9 h-9 rounded-full ring-2 ring-accent-cyan/30" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-surface-3 border border-edge flex items-center justify-center text-text-secondary font-mono text-xs">GH</div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">{connection.display_name}</span>
              <Badge className="bg-green-500/15 text-green-400">connected</Badge>
            </div>
            <p className="text-[10px] text-text-muted">@{connection.username} &middot; {connection.token_scopes || 'no scopes detected'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { refetchRepos(); refetchLinks(); }}><RefreshCw className="w-3 h-3" /></Button>
          <Button size="sm" variant="danger" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}>Disconnect</Button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 p-0.5 bg-surface-2 rounded-lg w-fit">
        <button onClick={() => setView('repos')} className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all', view === 'repos' ? 'bg-surface-3 text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary')}>
          Repositories ({repos.length})
        </button>
        <button onClick={() => setView('links')} className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all', view === 'links' ? 'bg-surface-3 text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary')}>
          Linked ({repoLinks.length})
        </button>
      </div>

      {/* Repos view */}
      {view === 'repos' && (
        <div>
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              className={cn(inputClass, 'pl-9')}
              placeholder="Search repositories..."
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
            />
          </div>

          {loadingRepos ? (
            <div className="py-8 flex justify-center"><Spinner /></div>
          ) : repos.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">No repositories found</div>
          ) : (
            <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
              {repos.map((repo) => (
                <Card key={repo.id} className="px-4 py-3 group hover:border-edge/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent-cyan hover:underline truncate">
                          {repo.full_name}
                        </a>
                        {repo.private ? <Lock className="w-3 h-3 text-text-muted flex-shrink-0" /> : <Globe className="w-3 h-3 text-text-muted flex-shrink-0" />}
                        {repo.linked_flow_id && <Badge className="bg-green-500/15 text-green-400 flex-shrink-0"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />linked</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {repo.language && (
                          <span className="flex items-center gap-1 text-[10px] text-text-muted">
                            <span className={cn('w-2 h-2 rounded-full', LANG_COLORS[repo.language] || 'bg-gray-500')} />
                            {repo.language}
                          </span>
                        )}
                        {repo.stars > 0 && <span className="flex items-center gap-0.5 text-[10px] text-text-muted"><Star className="w-2.5 h-2.5" />{repo.stars}</span>}
                        {repo.description && <span className="text-[10px] text-text-muted truncate">{repo.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {linkingRepo === repo.full_name ? (
                        <div className="flex items-center gap-2 animate-slide-up">
                          <select className={cn(inputClass, 'w-48 text-xs py-1.5')} value={selectedFlowId} onChange={(e) => setSelectedFlowId(e.target.value)}>
                            <option value="">Select flow...</option>
                            {flows.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
                          </select>
                          <Button size="sm" onClick={() => linkMut.mutate({ flowId: selectedFlowId, repoFullName: repo.full_name })} disabled={!selectedFlowId || linkMut.isPending}>
                            {linkMut.isPending ? <Spinner className="w-3 h-3" /> : 'Link'}
                          </Button>
                          <button onClick={() => setLinkingRepo(null)} className="p-1 text-text-muted hover:text-text-secondary"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <>
                          <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {!repo.linked_flow_id && (
                            <Button size="sm" variant="ghost" onClick={() => { setLinkingRepo(repo.full_name); setSelectedFlowId(''); }} className="sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                              <Link2 className="w-3 h-3" /> Link
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Linked repos view */}
      {view === 'links' && (
        <div>
          {repoLinks.length === 0 ? (
            <EmptyState icon={Link2} title="No linked repositories" description="Link repos to flows from the Repositories tab." action={{ label: 'Browse Repos', onClick: () => setView('repos') }} />
          ) : (
            <div className="space-y-1">
              {repoLinks.map((link) => (
                <Card key={link.id} className="px-4 py-3 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-surface-3 border border-edge flex items-center justify-center">
                      <GitBranch className="w-3.5 h-3.5 text-text-secondary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <a href={`https://github.com/${link.repo_full_name}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent-cyan hover:underline">{link.repo_full_name}</a>
                        <span className="text-[10px] text-text-muted">&rarr;</span>
                        <span className="text-xs text-text-secondary">{link.flow_title || link.flow_id}</span>
                      </div>
                      <p className="text-[10px] text-text-muted">Linked {timeAgo(link.created_at)}</p>
                    </div>
                  </div>
                  <button onClick={() => unlinkMut.mutate({ flowId: link.flow_id, linkId: link.id })} className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    <Unlink className="w-3 h-3" />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── GitLab Panel ───

function GitLabPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ instance_url: 'https://gitlab.com', personal_access_token: '', display_name: '' });

  const { data: connections = [], isLoading } = useQuery<any[]>({ queryKey: ['gitlab', 'connections'], queryFn: () => api.get('/gitlab/connections') });

  const create = useMutation({
    mutationFn: () => api.post('/gitlab/connections', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gitlab'] }); toast.success('GitLab connected'); setShowForm(false); setForm({ instance_url: 'https://gitlab.com', personal_access_token: '', display_name: '' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/gitlab/connections/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gitlab'] }); toast.success('Removed'); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="text-sm font-medium text-text-primary">GitLab Connections</h3><p className="text-xs text-text-muted mt-0.5">Connect GitLab instances for MR and pipeline sync</p></div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>{showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Connect</>}</Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-4 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Instance URL</label><input className={inputClass} value={form.instance_url} onChange={(e) => setForm({ ...form, instance_url: e.target.value })} /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Display Name</label><input className={inputClass} placeholder="GitLab Cloud" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-text-secondary mb-1.5">Personal Access Token</label><input className={cn(inputClass, 'font-mono')} type="password" placeholder="glpat-..." value={form.personal_access_token} onChange={(e) => setForm({ ...form, personal_access_token: e.target.value })} /></div>
          </div>
          <Button size="sm" className="mt-3" onClick={() => create.mutate()} disabled={create.isPending || !form.personal_access_token || !form.display_name}>Connect</Button>
        </Card>
      )}

      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : (Array.isArray(connections) ? connections : []).length === 0 ? (
        <EmptyState icon={Plug} title="No GitLab connections" description="Connect a GitLab instance to sync projects." action={{ label: 'Connect', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="space-y-1">
          {(Array.isArray(connections) ? connections : []).map((conn: any) => (
            <Card key={conn.id} className="px-4 py-3 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-orange-500/15 flex items-center justify-center text-orange-400 font-mono text-xs">GL</div>
                <div><p className="text-sm text-text-primary">{conn.display_name || conn.instance_url}</p><p className="text-[10px] text-text-muted font-mono">{conn.instance_url}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColors.active}>{conn.status || 'active'}</Badge>
                <button onClick={() => remove.mutate(conn.id)} className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Slack Panel ───

function SlackPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ channel_id: '', channel_name: '', webhook_url: '', events: ['flow.stage_changed', 'artifact.approved'] as string[] });

  const ALL_SLACK_EVENTS = ['flow.created', 'flow.stage_changed', 'artifact.generated', 'artifact.approved', 'approval.requested', 'approval.granted', 'evidence.collected'];

  const { data: integrations = [], isLoading } = useQuery<any[]>({ queryKey: ['slack', 'integrations'], queryFn: () => api.get('/slack/integrations') });

  const create = useMutation({
    mutationFn: () => api.post('/slack/integrations', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['slack'] }); toast.success('Slack integration created'); setShowForm(false); setForm({ channel_id: '', channel_name: '', webhook_url: '', events: ['flow.stage_changed', 'artifact.approved'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/slack/integrations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['slack'] }); toast.success('Removed'); },
  });

  const testWebhook = useMutation({
    mutationFn: (url: string) => api.post('/slack/test', { webhook_url: url }),
    onSuccess: () => toast.success('Test message sent!'),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleEvent = (event: string) => setForm((f) => ({ ...f, events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event] }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="text-sm font-medium text-text-primary">Slack Integrations</h3><p className="text-xs text-text-muted mt-0.5">Send notifications to Slack channels via webhooks</p></div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>{showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Channel</>}</Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-4 animate-slide-up">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Channel Name</label><input className={inputClass} placeholder="#engineering" value={form.channel_name} onChange={(e) => setForm({ ...form, channel_name: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Channel ID</label><input className={cn(inputClass, 'font-mono')} placeholder="C01234567" value={form.channel_id} onChange={(e) => setForm({ ...form, channel_id: e.target.value })} /></div>
            </div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Webhook URL</label><input className={cn(inputClass, 'font-mono')} placeholder="https://hooks.slack.com/services/..." value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} /></div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Events</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SLACK_EVENTS.map((event) => (
                  <button key={event} type="button" onClick={() => toggleEvent(event)} className={cn('px-2 py-1 rounded text-[10px] font-medium transition-all', form.events.includes(event) ? 'bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/30' : 'bg-surface-3 text-text-muted hover:text-text-secondary')}>{event}</button>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !form.webhook_url || !form.channel_name}>Create</Button>
          </div>
        </Card>
      )}

      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : (Array.isArray(integrations) ? integrations : []).length === 0 ? (
        <EmptyState icon={Plug} title="No Slack integrations" description="Connect Slack channels to receive notifications." action={{ label: 'Add Channel', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="space-y-1">
          {(Array.isArray(integrations) ? integrations : []).map((intg: any) => (
            <Card key={intg.id} className="px-4 py-3 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-green-500/15 flex items-center justify-center text-green-400 font-bold text-xs">#</div>
                <div><p className="text-sm text-text-primary">{intg.channel_name}</p><p className="text-[10px] text-text-muted">{intg.events?.length || 0} events subscribed</p></div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => testWebhook.mutate(intg.webhook_url)} disabled={testWebhook.isPending}>Test</Button>
                <button onClick={() => remove.mutate(intg.id)} className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───

const TABS = [
  { id: 'ai', label: 'AI Providers' },
  { id: 'github', label: 'GitHub' },
  { id: 'gitlab', label: 'GitLab' },
  { id: 'jira', label: 'Jira' },
  { id: 'confluence', label: 'Confluence' },
  { id: 'slack', label: 'Slack' },
];

export function IntegrationsPage() {
  const [tab, setTab] = useState('ai');

  return (
    <div>
      <PageHeader title="Integrations" description="Connect external tools and AI providers" />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'ai' && <LlmPanel />}
      {tab === 'github' && <GitHubPanel />}
      {tab === 'gitlab' && <GitLabPanel />}
      {tab === 'jira' && <AtlassianPanel mode="jira" />}
      {tab === 'confluence' && <AtlassianPanel mode="confluence" />}
      {tab === 'slack' && <SlackPanel />}
    </div>
  );
}
