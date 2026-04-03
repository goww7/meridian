import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { cn } from '../../lib/utils';
import { Users2, Plus, X, Trash2, ChevronDown, ChevronUp, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

export function TeamsSection() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<any[]>('/teams'),
  });

  const { data: members } = useQuery({
    queryKey: ['org', 'members'],
    queryFn: () => api.get<any[]>('/orgs/current/members'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/teams', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); setShowCreate(false); setForm({ name: '', description: '' }); toast.success('Team created'); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTeam = useMutation({
    mutationFn: (id: string) => api.del(`/teams/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); toast.success('Team deleted'); },
  });

  const addMember = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => api.post(`/teams/${teamId}/members`, { user_id: userId }),
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['teams', vars.teamId] }); toast.success('Member added'); },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => api.del(`/teams/${teamId}/members/${userId}`),
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['teams', vars.teamId] }); toast.success('Member removed'); },
  });

  const teamList = Array.isArray(teams) ? teams : (teams as any)?.data || [];
  const memberList = Array.isArray(members) ? members : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-text-primary">Teams</h2>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Create Team</>}
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 mb-4 animate-slide-up">
          <div className="space-y-3">
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. Backend Team" /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Optional" /></div>
            <Button size="sm" onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create</Button>
          </div>
        </Card>
      )}

      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : teamList.length === 0 ? (
        <EmptyState icon={Users2} title="No teams" description="Create teams to organize your members." action={{ label: 'Create Team', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="space-y-1">
          {teamList.map((team: any) => (
            <TeamCard key={team.id} team={team} expandedTeam={expandedTeam} setExpandedTeam={setExpandedTeam} memberList={memberList} addMember={addMember} removeMember={removeMember} deleteTeam={deleteTeam} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, expandedTeam, setExpandedTeam, memberList, addMember, removeMember, deleteTeam }: any) {
  const [addUserId, setAddUserId] = useState('');

  const { data: teamDetail } = useQuery({
    queryKey: ['teams', team.id],
    queryFn: () => api.get<any>(`/teams/${team.id}`),
    enabled: expandedTeam === team.id,
  });

  const teamMembers = teamDetail?.members || [];

  return (
    <Card className="overflow-hidden group">
      <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors" onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
        <div className="flex items-center gap-2">
          {expandedTeam === team.id ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
          <Users2 className="w-3.5 h-3.5 text-accent-blue" />
          <div>
            <p className="text-sm text-text-primary">{team.name}</p>
            {team.description && <p className="text-xs text-text-muted">{team.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{team.member_count || 0} members</Badge>
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete team?')) deleteTeam.mutate(team.id); }}
            className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {expandedTeam === team.id && (
        <div className="border-t border-edge bg-surface-2/50 px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs bg-surface-2 border border-edge rounded-md text-text-primary focus:outline-none">
              <option value="">Select member to add...</option>
              {memberList.filter((m: any) => !teamMembers.find((tm: any) => (tm.user_id || tm.id) === (m.user_id || m.id))).map((m: any) => (
                <option key={m.user_id || m.id} value={m.user_id || m.id}>{m.name || m.email}</option>
              ))}
            </select>
            <Button size="sm" disabled={!addUserId || addMember.isPending} onClick={() => { addMember.mutate({ teamId: team.id, userId: addUserId }); setAddUserId(''); }}>
              <UserPlus className="w-3 h-3" /> Add
            </Button>
          </div>
          {teamMembers.length === 0 ? <p className="text-xs text-text-muted">No members yet</p> : (
            <div className="space-y-1">
              {teamMembers.map((m: any) => (
                <div key={m.user_id || m.id} className="flex items-center justify-between py-1.5 px-2 bg-surface-1 rounded text-xs group/member">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-surface-3 border border-edge flex items-center justify-center text-[9px] text-text-muted">
                      {(m.name || m.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-text-secondary">{m.name || m.email}</span>
                  </div>
                  <button onClick={() => removeMember.mutate({ teamId: team.id, userId: m.user_id || m.id })}
                    className="p-0.5 rounded text-text-muted hover:text-red-400 opacity-0 group-hover/member:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
