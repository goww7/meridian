import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useWebSocket } from '../../lib/ws';
import { cn } from '../../lib/utils';
import { GlobalSearch } from '../search/global-search';
import { NotificationBell } from '../notifications/notification-bell';
import {
  LayoutDashboard,
  GitBranch,
  CheckCircle2,
  Shield,
  ShieldCheck,
  BarChart3,
  ScrollText,
  Plug,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/flows', label: 'Flows', icon: GitBranch },
  { path: '/approvals', label: 'Approvals', icon: CheckCircle2 },
  { path: '/policies', label: 'Policies', icon: Shield },
  { path: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/audit', label: 'Audit Log', icon: ScrollText },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { user, org, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useWebSocket();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  function handleNavClick() {
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-screen bg-surface-0">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-52 bg-surface-1 border-r border-edge flex flex-col shrink-0 transition-transform duration-200 ease-out',
        'lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Logo */}
        <div className="px-4 h-12 flex items-center border-b border-edge gap-2">
          <div className="w-5 h-5 rounded bg-accent-cyan flex items-center justify-center">
            <span className="text-[10px] font-bold text-surface-0">M</span>
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">Meridian</span>
          <span className="text-[10px] text-text-muted font-mono ml-auto hidden sm:inline">{org?.slug}</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 lg:py-1.5 rounded-md text-xs font-medium transition-all duration-100',
                  active
                    ? 'bg-surface-3 text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2',
                )}
              >
                <item.icon className={cn('w-4 h-4 lg:w-3.5 lg:h-3.5 shrink-0', active && 'text-accent-cyan')} />
                {item.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-text-muted" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t border-edge">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-surface-3 border border-edge flex items-center justify-center text-[10px] font-medium text-text-secondary">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{user?.name}</p>
              <p className="text-[10px] text-text-muted truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-12 border-b border-edge bg-surface-1 flex items-center justify-between px-3 md:px-4 shrink-0 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
