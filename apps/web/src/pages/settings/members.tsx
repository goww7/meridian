import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { cn } from '../../lib/utils';
import { Users, Plus, X, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const inputClass = 'w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors';

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-accent-cyan/20 text-accent-cyan',
  admin: 'bg-purple-500/20 text-purple-400',
  member: 'bg-surface-3 text-text-secondary',
};

export function MembersSection() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' });

  const { data: members, isLoading } = useQuery({
    queryKey: ['org', 'members'],
    queryFn: () => api.get<any[]>('/orgs/current/members'),
  });

  const invite = useMutation({
    mutationFn: () => api.post('/orgs/current/members/invite', inviteForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'members'] });
      setShowInvite(false);
      setInviteForm({ email: '', role: 'member' });
      toast.success('Invitation sent');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => api.patch(`/orgs/current/members/${userId}`, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['org', 'members'] }); toast.success('Role updated'); },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.del(`/orgs/current/members/${userId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['org', 'members'] }); toast.success('Member removed'); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-text-primary">Members</h2>
        <Button size="sm" onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><UserPlus className="w-3.5 h-3.5" /> Invite</>}
        </Button>
      </div>

      {showInvite && (
        <Card className="p-4 mb-4 animate-slide-up">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className={inputClass} placeholder="colleague@company.com" />
            </div>
            <div className="sm:w-32">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Role</label>
              <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className={inputClass}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button size="sm" className="w-full sm:w-auto" onClick={() => invite.mutate()} disabled={!inviteForm.email || invite.isPending}>
                {invite.isPending ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : !members?.length ? (
        <EmptyState icon={Users} title="No members" description="Invite team members to collaborate." action={{ label: 'Invite', onClick: () => setShowInvite(true) }} />
      ) : (
        <div className="space-y-1">
          {(Array.isArray(members) ? members : []).map((m: any) => (
            <Card key={m.user_id || m.id} className="px-3 sm:px-4 py-3 flex items-center justify-between gap-2 group">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-surface-3 border border-edge flex items-center justify-center text-[10px] font-medium text-text-secondary shrink-0">
                  {(m.name || m.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{m.name || 'Unknown'}</p>
                  <p className="text-[10px] text-text-muted truncate">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <select
                  value={m.role}
                  onChange={(e) => updateRole.mutate({ userId: m.user_id || m.id, role: e.target.value })}
                  className="px-2 py-1 text-[10px] bg-surface-2 border border-edge rounded text-text-secondary focus:outline-none hidden sm:block"
                  disabled={m.role === 'owner'}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
                <Badge className={ROLE_COLORS[m.role] || ROLE_COLORS.member}>{m.role}</Badge>
                {m.role !== 'owner' && (
                  <button onClick={() => { if (confirm(`Remove ${m.name || m.email}?`)) removeMember.mutate(m.user_id || m.id); }}
                    className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
