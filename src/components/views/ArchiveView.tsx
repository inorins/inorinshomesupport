import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Search, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import type { Ticket, Priority, TicketStatus } from '@/data/mockData';

interface ArchiveViewProps {
  onViewTicket: (id: string) => void;
}

const priorityStyles: Record<Priority, string> = {
  Critical: 'bg-primary/10 text-primary border-primary/20',
  High: 'bg-warning/10 text-warning border-warning/20',
  Medium: 'bg-info/10 text-info border-info/20',
  Low: 'bg-muted text-muted-foreground border-border',
};

const statusStyles: Record<TicketStatus, string> = {
  Open: 'bg-primary/10 text-primary border-primary/20',
  'In Progress': 'bg-info/10 text-info border-info/20',
  'Pending Client': 'bg-warning/10 text-warning border-warning/20',
  Resolved: 'bg-success/10 text-success border-success/20',
  Closed: 'bg-muted text-muted-foreground border-border',
};

function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function ArchiveView({ onViewTicket }: ArchiveViewProps) {
  const [search, setSearch] = useState('');

  const { data: tickets = [], isLoading, error } = useQuery<Ticket[]>({
    queryKey: ['archive'],
    queryFn: api.getArchive,
    staleTime: 30_000,
  });

  const filtered = tickets.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.id.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      (t.bankName ?? '').toLowerCase().includes(q) ||
      (t.assignee ?? '').toLowerCase().includes(q) ||
      t.system.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Loading archive…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-primary">
          {error instanceof Error ? error.message : 'Failed to load archive.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Solved Tasks Archive</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          All resolved and closed tickets — {tickets.length} total
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by ID, title, bank, assignee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No matching tickets found.</p>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Bank</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Assignee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Resolved</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="hover:bg-accent/40 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ticket.id}</td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <p className="font-medium text-foreground truncate" title={ticket.title}>{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">{ticket.system} · {ticket.module}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{ticket.bankName ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{ticket.assignee || 'Unassigned'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('text-xs', priorityStyles[ticket.priority])}>
                      {ticket.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('text-xs', statusStyles[ticket.status])}>
                      {ticket.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(ticket.resolvedAt ?? ticket.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewTicket(ticket.id)}
                      className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title="View ticket"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
