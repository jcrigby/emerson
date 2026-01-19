import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  PenTool, 
  BarChart3, 
  Settings,
  ChevronLeft,
  Plus,
  Feather
} from 'lucide-react';
import { useAppStore } from '@/store';
import clsx from 'clsx';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'structure', label: 'Structure', icon: BookOpen },
  { id: 'codex', label: 'Codex', icon: Users },
  { id: 'write', label: 'Write', icon: PenTool },
  { id: 'analyze', label: 'Analysis', icon: BarChart3 },
] as const;

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, activeView, setActiveView, currentProjectId } = useAppStore();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen bg-paper-50 border-r border-paper-300 z-40',
        'flex flex-col transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-paper-200">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Feather className="w-5 h-5 text-paper-50" />
        </div>
        {sidebarOpen && (
          <span className="font-serif font-semibold text-xl text-ink-900">
            Emerson
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className={clsx(
            'ml-auto p-1.5 rounded-md text-ink-400 hover:text-ink-600 hover:bg-paper-200 transition-colors',
            !sidebarOpen && 'mx-auto ml-0'
          )}
        >
          <ChevronLeft className={clsx('w-5 h-5 transition-transform', !sidebarOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const isDisabled = item.id !== 'dashboard' && !currentProjectId;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveView(item.id)}
              disabled={isDisabled}
              className={clsx(
                'sidebar-item w-full',
                isActive && 'active',
                isDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-paper-200 space-y-1">
        <button
          onClick={() => setActiveView('settings')}
          className={clsx('sidebar-item w-full', activeView === 'settings' && 'active')}
          title={!sidebarOpen ? 'Settings' : undefined}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
