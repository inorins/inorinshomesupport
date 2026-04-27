import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Hand, Play, HelpCircle, RefreshCw } from 'lucide-react';
import { useTickets } from '@/hooks/useTicketsData';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { TicketStatus, Priority } from '@/data/mockData';
import { cn } from '@/lib/utils';

const columns: { status: TicketStatus; label: string; color: string }[] = [
  { status: 'Open', label: 'Open', color: 'border-t-primary' },
  { status: 'In Progress', label: 'In Progress', color: 'border-t-info' },
  { status: 'Pending Client', label: 'Pending Client', color: 'border-t-warning' },
  { status: 'Resolved', label: 'Resolved', color: 'border-t-success' },
];

const priorityDot: Record<Priority, string> = {
  Critical: 'bg-primary',
  High: 'bg-warning',
  Medium: 'bg-info',
  Low: 'bg-muted-foreground',
};

export function TeamBoardView({ onViewTicket }: { onViewTicket: (id: string) => void }) {
  const { tickets, isLoading, refetch } = useTickets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.name) return;
    setClaimingId(ticketId);
    try {
      await api.assignTicket(ticketId, user.name);
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } finally {
      setClaimingId(null);
    }
  };

  const isMyTicket = (assignee: string | undefined) => {
    if (!assignee?.trim()) return false;
    return assignee.toLowerCase() === (user?.name ?? '').toLowerCase();
  };

  const canViewDetail = (assignee: string | undefined) =>
    !assignee?.trim() || isMyTicket(assignee);

  return (
    <div className="p-6 space-y-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Board</h1>
          <p className="text-sm text-muted-foreground mt-1">Internal view for the Inorins support team</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => refetch()}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-12rem)]">
        {columns.map((col) => {
          const colTickets = tickets.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className={`bg-surface rounded-lg border border-border ${col.color} border-t-2 flex flex-col`}>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                  {isLoading ? '…' : colTickets.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-lg border border-border p-3.5 space-y-2.5 animate-pulse">
                      <div className="h-3 bg-muted rounded w-20" />
                      <div className="h-4 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-16" />
                    </div>
                  ))
                ) : colTickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No tickets</p>
                ) : (
                  colTickets.map((t) => {
                    const canOpen = canViewDetail(t.assignee);
                    return (
                      <div
                        key={t.id}
                        onClick={() => canOpen && onViewTicket(t.id)}
                        className={cn(
                          'bg-card rounded-lg border border-border p-3.5 space-y-2.5 transition-shadow',
                          canOpen
                            ? 'cursor-pointer hover:shadow-md'
                            : 'cursor-default opacity-70'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-secondary">{t.id}</span>
                          <div className={`h-2.5 w-2.5 rounded-full ${priorityDot[t.priority]}`} title={t.priority} />
                        </div>
                        <p className="text-sm font-medium text-foreground leading-snug">{t.title}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge className="text-[10px] px-1.5 py-0 bg-secondary/10 text-secondary border-secondary/20">{t.system}</Badge>
                          {t.environment === 'Production' && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">PROD</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{t.assignee || 'Unassigned'}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{t.lastUpdated}</span>
                        </div>
                        {col.status === 'Open' && !t.assignee?.trim() && (
                          <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 flex-1"
                              disabled={claimingId === t.id}
                              onClick={(e) => handleClaim(t.id, e)}
                            >
                              <Hand className="h-3 w-3" />
                              {claimingId === t.id ? 'Claiming…' : 'Claim'}
                            </Button>
                          </div>
                        )}
                        {col.status === 'In Progress' && isMyTicket(t.assignee) && (
                          <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1">
                              <Play className="h-3 w-3" /> Ongoing
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1">
                              <HelpCircle className="h-3 w-3" /> Assist
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
