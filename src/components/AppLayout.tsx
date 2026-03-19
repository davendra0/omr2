import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import DarkModeToggle from '@/components/DarkModeToggle';
import { getWorkspaceName, setWorkspaceName } from '@/lib/workspaceStore';
import { getShortcuts, matchesShortcut, ACTION_ROUTES } from '@/lib/shortcutStore';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/omr', label: 'OMR Test', icon: '📝' },
  { path: '/countdown', label: 'Countdowns', icon: '⏳' },
  { path: '/pomodoro', label: 'Pomodoro', icon: '🍅' },
  { path: '/todos', label: 'Tasks', icon: '✅' },
  { path: '/notes', label: 'Notes', icon: '📒' },
  { path: '/mistakes', label: 'Mistakes', icon: '🔍' },
  { path: '/syllabus', label: 'Syllabus', icon: '📚' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [workspaceName, setName] = useState(getWorkspaceName);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Body scroll lock on mobile when sidebar is open
  useEffect(() => {
    if (window.innerWidth < 1024) {
      if (sidebarOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const shortcuts = getShortcuts();
      for (const [action, shortcut] of Object.entries(shortcuts)) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault();
          const route = ACTION_ROUTES[action];
          if (route) navigate(route);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  // Mobile: clicking the hamburger icon toggles sidebar
  // Clicking nav icon on active route toggles sidebar collapse on desktop
  const handleNavClick = (path: string) => {
    if (window.innerWidth < 1024) {
      // Mobile: just navigate and close
      setSidebarOpen(false);
    } else {
      // Desktop: if already on this route, toggle collapsed
      if (location.pathname === path || (path === '/omr' && location.pathname.startsWith('/omr'))) {
        setCollapsed(!collapsed);
        return; // don't navigate
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden touch-none"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen bg-card border-r border-border flex flex-col transition-all duration-200 overscroll-contain touch-pan-y',
          collapsed ? 'w-16' : 'w-64 lg:w-56',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          {editingName && !collapsed ? (
            <form onSubmit={(e) => { e.preventDefault(); setWorkspaceName(tempName); setName(tempName.trim() || 'Workspace'); setEditingName(false); }} className="flex items-center gap-1 w-full">
              <input
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={() => { setWorkspaceName(tempName); setName(tempName.trim() || 'Workspace'); setEditingName(false); }}
                className="w-full h-7 px-2 border border-border rounded bg-background text-foreground text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </form>
          ) : (
            <button onClick={() => { navigate('/'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              {!collapsed && (
                <span
                  className="font-mono font-bold text-foreground text-lg tracking-tight cursor-pointer hover:text-primary transition-colors"
                  onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); setTempName(workspaceName); setEditingName(true); }}
                  title="Double-click to rename"
                >
                  {workspaceName}
                </span>
              )}
            </button>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1.5 lg:space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = item.path === '/' 
              ? location.pathname === '/' 
              : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  handleNavClick(item.path);
                  navigate(item.path);
                }}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span className="text-base">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className="px-3 py-1 text-[10px] font-mono text-muted-foreground/50 text-center">
            v1.0.3
          </div>
          <DarkModeToggle collapsed={collapsed} />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={cn('transition-transform', collapsed && 'rotate-180')}
            >
              <path d="M10 3L5 8l5 5" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-foreground hover:bg-muted p-2 rounded-md transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <span className="font-mono font-bold text-foreground text-base">⚡ {workspaceName}</span>
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
