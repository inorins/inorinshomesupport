import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, TicketCheck, ArrowRight, FileText } from 'lucide-react';
import { useTickets } from '@/hooks/useTicketsData';
import { useAuth } from '@/context/AuthContext';
import type { Priority, TicketStatus, Ticket } from '@/data/mockData';
import { cn } from '@/lib/utils';

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

export function ClientTicketListView({ onViewTicket, onNewRequest }: ClientTicketListViewProps) {
  const { user } = useAuth();
  const { tickets, isLoading } = useTickets();

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

  const openCount = myTickets.filter((t) => t.status === 'Open').length;
  const inProgressCount = myTickets.filter((t) => t.status === 'In Progress').length;
  const resolvedCount = myTickets.filter((t) => t.status === 'Resolved').length;

  const kpiCards = [
    { label: 'Open', value: openCount, icon: AlertTriangle, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'In Progress', value: inProgressCount, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Resolved', value: resolvedCount, icon: TicketCheck, color: 'text-success', bg: 'bg-success/10' },
  ];

  return (
    <div className="p-6 space-y-6">
      


      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-lg', k.bg)}>
              <k.icon className={cn('h-5 w-5', k.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">All Tickets</h2>
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
              ) : myTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">No tickets yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submit a new ticket to get started
                    </p>
                  </td>
                </tr>
              ) : (
                myTickets.map((t) => (
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
