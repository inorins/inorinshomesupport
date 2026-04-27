import { LayoutDashboard, Ticket, Users, Settings, Shield, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface AppSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tickets', label: 'All Tickets', icon: Ticket },
  { id: 'board', label: 'Team Board', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppSidebar({ activeView, onNavigate }: AppSidebarProps) {
  const { logout } = useAuth();

  return (
    <aside className="w-64 h-screen sticky top-0 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Shield className="h-7 w-7 text-sidebar-primary mr-2.5 shrink-0" />
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">Inorins</span>
          <span className="text-[10px] font-medium text-sidebar-foreground tracking-widest uppercase">Technologies</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign Out</span>
        </button>
        <p className="text-[11px] text-sidebar-foreground/60 px-3">Helpdesk v2.4.1</p>
      </div>
    </aside>
  );
}
