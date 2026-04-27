import { LayoutList, PlusCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface ClientSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  openTicketCount: number;
}

const navItems = [
  { id: 'my-tickets', label: 'My Tickets', icon: LayoutList },
  { id: 'new-ticket', label: 'Submit a Ticket', icon: PlusCircle },
  { id: 'faq', label: 'FAQ & Guides', icon: HelpCircle },
];

export function ClientSidebar({ activeView, onNavigate, openTicketCount }: ClientSidebarProps) {
  const { user } = useAuth();

  return (
    <aside className="w-60 h-screen sticky top-0 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Bank identity */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border gap-3">
        <div className="h-9 w-9 rounded-full bg-sidebar-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-sidebar-primary">{user?.bankShortCode}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-accent-foreground truncate">{user?.bankName}</p>
          <p className="text-[10px] text-sidebar-foreground truncate">Client Portal</p>
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
                'w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.id === 'my-tickets' && openTicketCount > 0 && (
                <span className={cn(
                  'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center',
                  isActive ? 'bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground' : 'bg-primary/15 text-primary'
                )}>
                  {openTicketCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/60">Powered by Inorins v2.4.1</p>
      </div>
    </aside>
  );
}
