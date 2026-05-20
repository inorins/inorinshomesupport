import { Bell, CheckCheck, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  onNavigateToTicket?: (ticketId: string) => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_COLORS: Record<AppNotification['type'], string> = {
  new_ticket: 'bg-blue-500',
  ticket_assigned: 'bg-purple-500',
  status_changed: 'bg-yellow-500',
  new_client_reply: 'bg-green-500',
  new_staff_reply: 'bg-green-500',
  sla_breach: 'bg-red-500',
  ticket_edited: 'bg-orange-500',
};

export function NotificationBell({ onNavigateToTicket }: NotificationBellProps) {
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

  function handleClick(n: AppNotification) {
    if (!n.isRead) markOneRead(n.id);
    if (onNavigateToTicket) onNavigateToTicket(n.ticketId);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-sidebar-foreground">
          <Bell className="h-4 w-4 text-sidebar-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                    !n.isRead && 'bg-muted/30'
                  )}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <div className={cn('flex h-6 w-6 items-center justify-center rounded-full', TYPE_COLORS[n.type])}>
                      <Ticket className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-xs leading-snug', !n.isRead && 'font-medium')}>
                      {n.message}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
