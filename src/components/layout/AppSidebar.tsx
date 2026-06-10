import {
  LayoutDashboard, Ticket, Users, Settings, Shield, LogOut,
  Archive, UserCog, Inbox, GitMerge, ShieldCheck, ClipboardList,
  ChevronDown, KeyRound, MessageSquare, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { usePendingInboxCount } from '@/hooks/useInboxEmails';
import { useChatUnreadCount } from '@/hooks/useTicketsData';

interface AppSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isAdmin?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

function SidebarItem({ item, isActive, onNavigate, collapsed }: {
  item: NavItem;
  isActive: boolean;
  onNavigate: (id: string) => void;
  collapsed?: boolean;
}) {
  return (
    <button
      key={item.id}
      title={collapsed ? item.label : undefined}
      onClick={() => onNavigate(item.id)}
      className={cn(
        'w-full flex items-center rounded-md text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <div className="relative shrink-0">
        <item.icon className="h-4 w-4" />
        {collapsed && item.badge != null && item.badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-destructive" />
        )}
      </div>
      {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
      {!collapsed && item.badge != null && item.badge > 0 && (
        <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </button>
  );
}

function CollapsibleSection({ title, items, isActive, onNavigate, collapsed }: {
  title: string;
  items: NavItem[];
  isActive: (id: string) => boolean;
  onNavigate: (id: string) => void;
  collapsed?: boolean;
}) {
  const anyActive = items.some((i) => isActive(i.id));
  const [open, setOpen] = useState(anyActive);

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map((item) => (
          <SidebarItem key={item.id} item={item} isActive={isActive(item.id)} onNavigate={onNavigate} collapsed />
        ))}
      </div>
    );
  }

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

export function AppSidebar({ activeView, onNavigate, isAdmin, collapsed, onToggleCollapse }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const pendingEmails = usePendingInboxCount();
  const chatUnread = useChatUnreadCount();
  const isInorins = user?.role === 'inorins';

  const mainItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard',   icon: LayoutDashboard },
    { id: 'tickets',   label: 'All Tickets', icon: Ticket },
    { id: 'board',     label: 'Team Board',  icon: Users },
    { id: 'chat',      label: 'Chat',        icon: MessageSquare, badge: chatUnread || undefined },
    { id: 'inbox',     label: 'Email Inbox', icon: Inbox, badge: pendingEmails || undefined },
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
    <aside className={cn(
      'h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-[width] duration-200 overflow-hidden',
      collapsed ? 'w-[60px]' : 'w-64'
    )}>
      {/* Brand */}
      <div className={cn(
        'h-16 flex items-center border-b border-sidebar-border shrink-0',
        collapsed ? 'justify-center px-0' : 'px-5'
      )}>
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Shield className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <>
            <div className="flex flex-col flex-1 min-w-0 ml-3">
              <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground leading-tight">Inorins</span>
              <span className="text-[10px] font-medium text-sidebar-foreground/60 tracking-widest uppercase leading-tight">Technologies</span>
            </div>
            <NotificationBell onNavigateToTicket={(ticketId) => onNavigate(`ticket-${ticketId}`)} />
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 py-3 space-y-4 overflow-y-auto scrollbar-thin', collapsed ? 'px-1.5' : 'px-2.5')}>

        {/* Main */}
        <div className="space-y-0.5">
          {!collapsed && (
            <p className="px-3 py-1 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest">Main</p>
          )}
          {mainItems.map((item) => (
            <SidebarItem key={item.id} item={item} isActive={isActive(item.id)} onNavigate={onNavigate} collapsed={collapsed} />
          ))}
        </div>

        {/* Operations */}
        {opsItems.length > 0 && (
          <div className="space-y-0.5">
            {!collapsed && (
              <p className="px-3 py-1 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest">Operations</p>
            )}
            {opsItems.map((item) => (
              <SidebarItem key={item.id} item={item} isActive={isActive(item.id)} onNavigate={onNavigate} collapsed={collapsed} />
            ))}
          </div>
        )}

        {/* Administration */}
        {adminItems.length > 0 && (
          <div className="space-y-0.5">
            <CollapsibleSection
              title="Administration"
              items={adminItems}
              isActive={isActive}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </div>
        )}

      </nav>

      {/* Footer */}
      <div className={cn('py-3 border-t border-sidebar-border shrink-0 space-y-0.5', collapsed ? 'px-1.5' : 'px-2.5')}>
        <button
          title={collapsed ? 'Settings' : undefined}
          onClick={() => onNavigate('settings')}
          className={cn(
            'w-full flex items-center rounded-md text-sm font-medium transition-all duration-150',
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
            isActive('settings')
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>

        <button
          title={collapsed ? 'Sign Out' : undefined}
          onClick={() => logout()}
          className={cn(
            'w-full flex items-center rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150',
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
          className={cn(
            'w-full flex items-center rounded-md text-sm font-medium text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-150',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-1.5',
          )}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft className="h-3.5 w-3.5" />
          }
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>

        {!collapsed && (
          <p className="text-[11px] text-sidebar-foreground/40 px-3 pt-1">Helpdesk v2.0.0</p>
        )}
      </div>
    </aside>
  );
}
