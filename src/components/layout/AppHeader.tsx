import { Search, Bell, Plus, ChevronDown, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';

interface AppHeaderProps {
  onNewTicket: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export function AppHeader({ onNewTicket, searchQuery = '', onSearchChange }: AppHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tickets, clients, modules..."
          className="pl-9 bg-surface border-border h-9 text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
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

        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
            <User className="h-4 w-4 text-secondary-foreground" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium leading-none">{user?.name ?? 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{user?.title}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <button
          onClick={logout}
          title="Sign out"
          className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
