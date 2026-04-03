import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Bell, CheckCheck, CheckCircle, ArrowRight, UserCheck, UserX, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn, timeAgo } from '../../lib/utils';

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  artifact_approved: { icon: CheckCircle, color: 'text-green-400' },
  stage_changed: { icon: ArrowRight, color: 'text-accent-cyan' },
  approval_requested: { icon: UserCheck, color: 'text-amber-400' },
  approval_granted: { icon: CheckCircle, color: 'text-green-400' },
  approval_rejected: { icon: UserX, color: 'text-red-400' },
  policy_blocked: { icon: ShieldAlert, color: 'text-red-400' },
  policy_warning: { icon: AlertTriangle, color: 'text-amber-400' },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: any[] }>('/notifications?limit=20'),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notificationsData?.data || [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleNotificationClick(n: any) {
    if (!n.read_at) markRead.mutate(n.id);
    setOpen(false);
    if (n.entity_type === 'flow' && n.entity_id) navigate(`/flows/${n.entity_id}`);
    else if (n.entity_type === 'artifact' && n.entity_id) navigate(`/flows/${n.entity_id}`);
    else if (n.entity_type === 'approval') navigate('/approvals');
    else if (n.flow_id) navigate(`/flows/${n.flow_id}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors">
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-3.5 text-[9px] font-bold text-surface-0 bg-accent-cyan rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-surface-1 rounded-lg border border-edge shadow-xl shadow-black/40 z-50 animate-slide-down overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
            <h3 className="text-xs font-medium text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead.mutate()} className="flex items-center gap-1 text-[10px] text-accent-cyan hover:text-cyan-300 font-medium transition-colors">
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="p-4 text-xs text-text-muted text-center">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="p-6 text-xs text-text-muted text-center">No notifications</p>
            ) : (
              notifications.map((n: any) => {
                const config = TYPE_CONFIG[n.type] || { icon: Bell, color: 'text-text-muted' };
                const Icon = config.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b border-edge transition-colors hover:bg-surface-2',
                      !n.read_at && 'bg-accent-cyan/5',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn('mt-0.5 shrink-0', config.color)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-text-primary leading-relaxed">{n.title}</p>
                        {n.body && (
                          <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed line-clamp-2 whitespace-pre-line">{n.body}</p>
                        )}
                        <p className="text-[10px] text-text-tertiary mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan mt-1.5 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
