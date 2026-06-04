import { useMemo, useState } from 'react';
import { User, RefreshCw, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTickets } from '@/hooks/useTicketsData';
import { cn } from '@/lib/utils';
import type { Priority, TicketStatus } from '@/data/mockData';

const COLUMNS: { status: TicketStatus; label: string; headerCls: string }[] = [
  { status: 'Open',           label: 'Open',           headerCls: 'border-t-blue-500' },
  { status: 'In Progress',    label: 'In Progress',    headerCls: 'border-t-yellow-500' },
  { status: 'Pending Client', label: 'Pending Client', headerCls: 'border-t-orange-500' },
  { status: 'Resolved',       label: 'Resolved',       headerCls: 'border-t-green-500' },
  { status: 'Closed',         label: 'Closed',         headerCls: 'border-t-muted-foreground' },
];

const PRIORITY_DOT: Record<Priority, string> = {
  Critical: 'bg-red-500',
  High:     'bg-orange-500',
  Medium:   'bg-yellow-500',
  Low:      'bg-green-500',
};

const PRIORITY_ORDER: Record<Priority, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3,
};

export function AllBoardView({ onViewTicket }: { onViewTicket: (id: string) => void }) {
  const { tickets, isLoading, refetch } = useTickets();

  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSystem,   setFilterSystem]   = useState('all');

  const assignees = useMemo(() => {
    const names = tickets.map((t) => t.assignee?.trim()).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [tickets]);

  const systems = useMemo(() =>
    [...new Set(tickets.map((t) => t.system))].sort(),
  [tickets]);

  const filtered = useMemo(() =>
    tickets.filter((t) => {
      if (filterAssignee !== 'all') {
        if (filterAssignee === '__unassigned__') {
          if (t.assignee?.trim()) return false;
        } else if ((t.assignee ?? '') !== filterAssignee) return false;
      }
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterSystem   !== 'all' && t.system   !== filterSystem)   return false;
      return true;
    }),
  [tickets, filterAssignee, filterPriority, filterSystem]);

  const hasFilters = filterAssignee !== 'all' || filterPriority !== 'all' || filterSystem !== 'all';

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Tickets Board</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Every ticket across all staff — {filtered.length} showing</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterSystem} onValueChange={setFilterSystem}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="System" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Systems</SelectItem>
            {systems.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            onClick={() => { setFilterAssignee('all'); setFilterPriority('all'); setFilterSystem('all'); }}
            className="flex items-center gap-1 h-8 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 flex-1 min-h-0">
        {COLUMNS.map((col) => {
          const colTickets = filtered
            .filter((t) => t.status === col.status)
            .sort((a, b) =>
              (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
            );

          return (
            <div
              key={col.status}
              className={cn(
                'bg-surface rounded-lg border border-border flex flex-col border-t-2',
                col.headerCls,
              )}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-foreground">{col.label}</span>
                <span className="text-[10px] font-bold bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                  {isLoading ? '…' : colTickets.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-card rounded border border-border p-3 space-y-2 animate-pulse">
                      <div className="h-2.5 bg-muted rounded w-16" />
                      <div className="h-3.5 bg-muted rounded w-full" />
                      <div className="h-2.5 bg-muted rounded w-20" />
                    </div>
                  ))
                ) : colTickets.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-6">No tickets</p>
                ) : (
                  colTickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onViewTicket(t.id)}
                      className="bg-card rounded border border-border p-3 space-y-2 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      {/* ID + priority dot */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-semibold text-secondary truncate">{t.id}</span>
                        <span
                          className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[t.priority])}
                          title={t.priority}
                        />
                      </div>

                      {/* Title */}
                      <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{t.title}</p>

                      {/* System + env badges */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge className="text-[9px] px-1 py-0 bg-secondary/10 text-secondary border-secondary/20 leading-tight">
                          {t.system}
                        </Badge>
                        {t.bankName && (
                          <Badge className="text-[9px] px-1 py-0 bg-muted text-muted-foreground border-border leading-tight">
                            {t.bankName}
                          </Badge>
                        )}
                        {t.environment === 'Production' && (
                          <Badge className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20 leading-tight">
                            PROD
                          </Badge>
                        )}
                      </div>

                      {/* Assignee + date */}
                      <div className="flex items-center justify-between pt-1 border-t border-border gap-1">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                          <User className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{t.assignee?.trim() || 'Unassigned'}</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {t.lastUpdated
                            ? new Date(t.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' })
                            : ''}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
