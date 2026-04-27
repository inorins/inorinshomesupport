import { Shield, Building2, LogOut, Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

interface ClientHeaderProps {
  onNewTicket: () => void;
}

export function ClientHeader({ onNewTicket }: ClientHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      {/* Brand + Bank identity */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-border">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <p className="text-xs font-bold text-foreground tracking-tight">Inorins</p>
            <p className="text-[9px] text-muted-foreground tracking-widest uppercase">Support Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-info/20 flex items-center justify-center">
            <Building2 className="h-3.5 w-3.5 text-info" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{user?.bankName}</p>
            <p className="text-[10px] text-muted-foreground">{user?.name}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={onNewTicket} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Ticket
        </Button>

        <button className="relative p-2 rounded-md hover:bg-accent transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
