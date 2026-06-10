import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Ticket, KanbanSquare, Inbox, Settings,
  Archive, Users, Shield, ClipboardList, KeyRound, Plus, GitMerge,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useTickets } from '@/hooks/useTicketsData';
import { useAuth } from '@/context/AuthContext';

interface CommandPaletteProps {
  onNavigate: (view: string) => void;
  onNewTicket: () => void;
  isAdmin?: boolean;
}

export function CommandPalette({ onNavigate, onNewTicket, isAdmin }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { tickets } = useTickets();
  const { user } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    setQuery('');
    fn();
  };

  const matchedTickets =
    query.length >= 2
      ? tickets
          .filter((t) => {
            const q = query.toLowerCase();
            return t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q);
          })
          .slice(0, 6)
      : [];

  const navItems = [
    { id: 'dashboard',      label: 'Dashboard',        icon: LayoutDashboard },
    { id: 'tickets',        label: 'All Tickets',       icon: Ticket },
    { id: 'board',          label: 'Team Board',        icon: KanbanSquare },
    { id: 'inbox',          label: 'Email Inbox',       icon: Inbox },
    ...(user?.role === 'inorins'
      ? [{ id: 'system-changes', label: 'System Changes', icon: GitMerge }]
      : []),
    { id: 'settings',       label: 'Settings',          icon: Settings },
    ...(isAdmin
      ? [
          { id: 'archive',      label: 'Archive',          icon: Archive },
          { id: 'admin-users',  label: 'User Management',  icon: Users },
          { id: 'permissions',  label: 'Permissions',       icon: Shield },
          { id: 'audit-log',    label: 'Audit Log',         icon: ClipboardList },
          { id: 'sessions',     label: 'Sessions',          icon: KeyRound },
        ]
      : []),
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery('');
      }}
    >
      <CommandInput
        placeholder="Search tickets or navigate…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onNewTicket)}>
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
            <CommandShortcut>Ctrl+N</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {matchedTickets.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tickets">
              {matchedTickets.map((ticket) => (
                <CommandItem
                  key={ticket.id}
                  value={`${ticket.id} ${ticket.title}`}
                  onSelect={() => run(() => onNavigate(`ticket-${ticket.id}`))}
                >
                  <Ticket className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground mr-2">{ticket.id}</span>
                  <span className="truncate">{ticket.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Navigate">
          {navItems.map((item) => (
            <CommandItem
              key={item.id}
              value={item.label}
              onSelect={() => run(() => onNavigate(item.id))}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
