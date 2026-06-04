import {
  LayoutDashboard, Ticket, Users, Settings, Shield, LogOut,
  Archive, UserCog, Inbox, GitMerge, ShieldCheck, ClipboardList, ChevronDown, KeyRound,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { usePendingInboxCount } from '@/hooks/useInboxEmails';

interface AppSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isAdmin?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavSection {
  title?: string;
  items: NavItem[];
  collapsible?: boolean;
}

function SidebarItem({ item, isActive, onNavigate }: {
  item: NavItem;
  isActive: boolean;
  onNavigate: (id: string) => void;
}) {
  return (
    <button
      key={item.id}
      onClick={() => onNavigate(item.id)}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </button>
  );
}

function CollapsibleSection({ title, items, isActive, onNavigate }: {
  title: string;
  items: NavItem[];
  isActive: (id: string) => boolean;
  onNavigate: (id: string) => void;
}) {
  const anyActive = items.some((i) => isActive(i.id));
  const [open, setOpen] = useState(anyActive);

  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-sidebar-foreground/60 hover:text-sidebar-foreground/90 uppercase tracking-wider transition-colors"
      >
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-1">
          {items.map((item) => (
            <SidebarItem key={item.id} item={item} isActive={isActive(item.id)} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AppSidebar({ activeView, onNavigate, isAdmin }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const pendingEmails = usePendingInboxCount();
  const isInorins = user?.role === 'inorins';

  const mainItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tickets',   label: 'All Tickets', icon: Ticket },
    { id: 'board',     label: 'Team Board',  icon: Users },
    { id: 'inbox',     label: 'Inbox',       icon: Inbox, badge: pendingEmails },
  ];

  const opsItems: NavItem[] = [
    ...(isInorins ? [{ id: 'system-changes', label: 'System Changes', icon: GitMerge }] : []),
  ];

  const adminItems: NavItem[] = isAdmin
    ? [
        { id: 'archive',     label: 'Archive',         icon: Archive },
        { id: 'admin-users', label: 'User Management', icon: UserCog },
        { id: 'permissions', label: 'Permissions',     icon: ShieldCheck },
        { id: 'audit-log',   label: 'Audit Log',       icon: ClipboardList },
        { id: 'sessions',    label: 'Sessions',        icon: KeyRound },
      ]
    : [];

  const isActive = (id: string) => activeView === id;

  return (
    <aside className="w-64 h-screen bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Brand */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border shrink-0">
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center mr-3 shrink-0">
          <Shield className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground leading-tight">Inorins</span>
          <span className="text-[10px] font-medium text-sidebar-foreground/60 tracking-widest uppercase leading-tight">Technologies</span>
        </div>
        <NotificationBell onNavigateToTicket={(ticketId) => onNavigate(`ticket-${ticketId}`)} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2.5 space-y-4 overflow-y-auto scrollbar-thin">

        {/* Main */}
        <div className="space-y-0.5">
          <p className="px-3 py-1 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest">Main</p>
          {mainItems.map((item) => (
            <SidebarItem key={item.id} item={item} isActive={isActive(item.id)} onNavigate={onNavigate} />
          ))}
        </div>

        {/* Operations — only shown when there are items */}
        {opsItems.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-3 py-1 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest">Operations</p>
            {opsItems.map((item) => (
              <SidebarItem key={item.id} item={item} isActive={isActive(item.id)} onNavigate={onNavigate} />
            ))}
          </div>
        )}

        {/* Administration — collapsible, only for admin */}
        {adminItems.length > 0 && (
          <div className="space-y-0.5">
            <CollapsibleSection
              title="Administration"
              items={adminItems}
              isActive={isActive}
              onNavigate={onNavigate}
            />
          </div>
        )}

      </nav>

      {/* Footer */}
      <div className="px-2.5 py-3 border-t border-sidebar-border shrink-0 space-y-0.5">
        <button
          onClick={() => onNavigate('settings')}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150',
            isActive('settings')
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign Out</span>
        </button>
        <p className="text-[11px] text-sidebar-foreground/40 px-3 pt-1">Helpdesk v2.0.0</p>
      </div>
    </aside>
  );
}
