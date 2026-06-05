import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, TicketCheck, ArrowRight, FileText } from 'lucide-react';
import { useTickets } from '@/hooks/useTicketsData';
import { useAuth } from '@/context/AuthContext';
import type { Priority, TicketStatus, Ticket } from '@/data/mockData';
import { cn } from '@/lib/utils';

type StatusFilter = 'All' | TicketStatus;

interface ClientTicketListViewProps {
  onViewTicket: (id: string) => void;
  onNewRequest: () => void;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    Critical: 'bg-primary/10 text-primary border-primary/20',
    High: 'bg-warning/10 text-warning border-warning/20',
    Medium: 'bg-info/10 text-info border-info/20',
    Low: 'bg-muted text-muted-foreground border-border',
  };
  return <Badge className={styles[priority]}>{priority}</Badge>;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    Open: 'bg-primary/10 text-primary border-primary/20',
    'In Progress': 'bg-info/10 text-info border-info/20',
    'Pending Client': 'bg-warning/10 text-warning border-warning/20',
    Resolved: 'bg-success/10 text-success border-success/20',
    Closed: 'bg-muted text-muted-foreground border-border',
  };
  return <Badge className={styles[status]}>{status}</Badge>;
}

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-border last:border-0 hover:bg-surface/60 cursor-pointer transition-colors group"
    >
      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-secondary">{ticket.id}</td>
      <td className="px-5 py-3.5">
        <p className="font-medium text-foreground leading-snug">{ticket.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{ticket.module} · {ticket.form}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/20">
          {ticket.system}
        </span>
      </td>
      <td className="px-5 py-3.5"><PriorityBadge priority={ticket.priority} /></td>
      <td className="px-5 py-3.5"><StatusBadge status={ticket.status} /></td>
      <td className="px-5 py-3.5 text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}</td>
      <td className="px-5 py-3.5 text-xs text-muted-foreground">{ticket.lastUpdated}</td>
      <td className="px-5 py-3.5">
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>
    </tr>
  );
}

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'All' },
  { label: 'Open', value: 'Open' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Pending Client', value: 'Pending Client' },
  { label: 'Resolved', value: 'Resolved' },
  { label: 'Closed', value: 'Closed' },
];

export function ClientTicketListView({ onViewTicket, onNewRequest }: ClientTicketListViewProps) {
  const { user } = useAuth();
  const { tickets, isLoading } = useTickets();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const myTickets = useMemo(() => {
    if (!user?.bankDomain && !user?.bankName) return [];
    const bankDomain = user?.bankDomain?.toLowerCase();
    const bankName = user?.bankName?.toLowerCase();

    return tickets.filter((t) => {
      const reporterEmail = t.reporterEmail.toLowerCase();
      const emailMatches = bankDomain ? reporterEmail.endsWith(`@${bankDomain}`) : false;
      const bankNameMatches = bankName ? String(t.bankName ?? '').toLowerCase() === bankName : false;
      return emailMatches || bankNameMatches;
    });
  }, [tickets, user]);

  const visibleTickets = useMemo(
    () => statusFilter === 'All' ? myTickets : myTickets.filter((t) => t.status === statusFilter),
    [myTickets, statusFilter],
  );

  const openCount = myTickets.filter((t) => t.status === 'Open').length;
  const inProgressCount = myTickets.filter((t) => t.status === 'In Progress').length;

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const resolvedThisMonth = myTickets.filter(
    (t) => (t.status === 'Resolved' || t.status === 'Closed') && new Date(t.updatedAt ?? t.createdAt) >= monthStart
  ).length;
  const pendingClientCount = myTickets.filter((t) => t.status === 'Pending Client').length;

  const kpiCards: { label: string; value: number; icon: React.ElementType; color: string; bg: string; filter: StatusFilter }[] = [
    { label: 'Open', value: openCount, icon: AlertTriangle, color: 'text-primary', bg: 'bg-primary/10', filter: 'Open' },
    { label: 'In Progress', value: inProgressCount, icon: Clock, color: 'text-info', bg: 'bg-info/10', filter: 'In Progress' },
    { label: 'Awaiting Your Reply', value: pendingClientCount, icon: FileText, color: 'text-warning', bg: 'bg-warning/10', filter: 'Pending Client' },
    { label: 'Resolved This Month', value: resolvedThisMonth, icon: TicketCheck, color: 'text-success', bg: 'bg-success/10', filter: 'Resolved' },
  ];

  return (
    <div className="p-6 space-y-6">
      


      {/* KPI strip — click to filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => (
          <button
            key={k.label}
            onClick={() => setStatusFilter((prev) => prev === k.filter ? 'All' : k.filter)}
            className={cn(
              'bg-card rounded-lg border p-4 flex items-center gap-4 text-left transition-colors',
              statusFilter === k.filter
                ? 'border-primary ring-1 ring-primary/30'
                : 'border-border hover:bg-surface/60',
            )}
          >
            <div className={cn('p-2.5 rounded-lg', k.bg)}>
              <k.icon className={cn('h-5 w-5', k.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-foreground">
            {statusFilter === 'All' ? 'All Tickets' : `${statusFilter} Tickets`}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({visibleTickets.length})</span>
          </h2>
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  statusFilter === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Issue</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">System</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Created</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Last Updated</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-muted rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visibleTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">
                      {myTickets.length === 0 ? 'No tickets yet' : `No ${statusFilter} tickets`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {myTickets.length === 0
                        ? 'Submit a new ticket to get started'
                        : 'Try a different filter'}
                    </p>
                  </td>
                </tr>
              ) : (
                visibleTickets.map((t) => (
                  <TicketRow key={t.id} ticket={t} onClick={() => onViewTicket(t.id)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
