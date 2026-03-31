import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useWebSocket } from '../../lib/ws';
import { cn } from '../../lib/utils';
import { GlobalSearch } from '../search/global-search';
import { NotificationBell } from '../notifications/notification-bell';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '~' },
  { path: '/flows', label: 'Flows', icon: '>' },
  { path: '/policies', label: 'Policies', icon: '#' },
  { path: '/analytics', label: 'Analytics', icon: '%' },
  { path: '/audit', label: 'Audit Log', icon: '!' },
  { path: '/settings', label: 'Settings', icon: '*' },
];

export function AppLayout() {
  const { user, org, logout } = useAuth();
  const location = useLocation();
  useWebSocket();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold text-white">Meridian</h1>
          <p className="text-xs text-slate-500 mt-1">{org?.name}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
                  ? 'bg-slate-800 text-white'
                  : 'hover:bg-slate-800 hover:text-white',
              )}
            >
              <span className="font-mono mr-2 text-slate-500">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <button onClick={logout} className="mt-2 text-xs text-slate-400 hover:text-white">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
          <GlobalSearch />
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
