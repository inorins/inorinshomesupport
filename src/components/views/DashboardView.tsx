import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  TicketCheck, Clock, AlertTriangle, RefreshCw,
  Download, Filter, X, CornerUpRight,
  CheckSquare, Square, UserCheck, XCircle, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTickets } from '@/hooks/useTicketsData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import type { Priority, TicketStatus, Ticket } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SLA_HOURS: Record<Priority, number> = {
  Critical: 4,
  High: 8,
  Medium: 24,
  Low: 72,
};

function getSLAInfo(ticket: Ticket): { label: string; className: string } {
  if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
    return { label: 'N/A', className: 'text-muted-foreground' };
  }
  const slaHours = SLA_HOURS[ticket.priority];
  const created = new Date(ticket.createdAt);
  const hoursElapsed = (Date.now() - created.getTime()) / 3_600_000;
  if (hoursElapsed >= slaHours) {
    return { label: 'Overdue', className: 'text-primary font-semibold' };
  }
  const hoursLeft = slaHours - hoursElapsed;
  if (hoursLeft < slaHours * 0.25) {
    return { label: `${Math.ceil(hoursLeft)}h left`, className: 'text-warning font-semibold' };
  }
  return { label: `${Math.ceil(hoursLeft)}h left`, className: 'text-success' };
}

const EMAIL_BANK_MAP: Record<string, string> = {
  'guheshwori.com.np': 'Guheshwori',
  'reliancebank.com.np': 'Reliance',
  'progressivebank.com.np': 'Progressive',
  'ganapatibank.com.np': 'Ganapati',
  'goodwillbank.com.np': 'Goodwill',
  'shreefinance.com.np': 'Shree Finance',
};

function resolveTicketBankName(ticket: Ticket) {
  if (ticket.bankName?.trim()) {
    return ticket.bankName;
  }
  const email = String(ticket.reporterEmail ?? '').toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';
  return EMAIL_BANK_MAP[domain] ?? 'Inorins';
}

function exportToCSV(data: Ticket[]) {
  const headers = ['ID', 'Title', 'System', 'Bank', 'Module', 'Priority', 'Status', 'Environment', 'Reporter', 'Assignee', 'Created'];
  const rows = data.map((t) => [
    t.id, t.title, t.system, resolveTicketBankName(t), t.module, t.priority, t.status,
    t.environment, t.reporter, t.assignee ?? '', t.createdAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tickets.csv';
  a.click();
  URL.revokeObjectURL(url);
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


interface DashboardViewProps {
  onViewTicket: (id: string) => void;
  searchQuery?: string;
}

const ADMIN_EMAIL = 'inorins@inorins.com';
const AUTO_REFRESH_MS = 2 * 60 * 1000;

export function DashboardView({ onViewTicket, searchQuery = '' }: DashboardViewProps) {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const { tickets, isLoading, isFetching, isError, dataUpdatedAt, refetch } = useTickets({
    refetchInterval: isAdmin ? AUTO_REFRESH_MS : undefined,
  });

  const [nextRefreshIn, setNextRefreshIn] = useState<number>(AUTO_REFRESH_MS / 1000);
  const lastUpdatedRef = useRef<number>(dataUpdatedAt);
  const knownTicketIdsRef = useRef<Set<string> | null>(null);

  const playNewTicketBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch { /* AudioContext not available */ }
  }, []);

  // Detect new tickets on each auto-refresh
  useEffect(() => {
    if (!isAdmin || isLoading || tickets.length === 0) return;
    const currentIds = new Set(tickets.map((t) => t.id));
    if (knownTicketIdsRef.current === null) {
      // First load — just record existing tickets, no beep
      knownTicketIdsRef.current = currentIds;
      return;
    }
    const hasNew = tickets.some((t) => !knownTicketIdsRef.current!.has(t.id));
    if (hasNew) playNewTicketBeep();
    knownTicketIdsRef.current = currentIds;
  }, [dataUpdatedAt, isAdmin, isLoading, tickets, playNewTicketBeep]);

  useEffect(() => {
    if (!isAdmin) return;
    lastUpdatedRef.current = dataUpdatedAt;
    setNextRefreshIn(AUTO_REFRESH_MS / 1000);
    const interval = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 1) return AUTO_REFRESH_MS / 1000;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isAdmin, dataUpdatedAt]);

  const isInorins = user?.role === 'inorins';
  const viewedKey = isInorins && user?.id ? `inorins_viewed_${user.id}` : null;
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!viewedKey) return;
    try {
      const raw = localStorage.getItem(viewedKey);
      if (raw) setViewedIds(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, [viewedKey]);

  const handleViewTicket = (id: string) => {
    if (viewedKey) {
      setViewedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        localStorage.setItem(viewedKey, JSON.stringify([...next]));
        return next;
      });
    }
    onViewTicket(id);
  };

  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSystem, setFilterSystem] = useState<string>('all');
  const [filterBank, setFilterBank] = useState<string>('all');
  const [myQueueOnly, setMyQueueOnly] = useState(false);

  const myQueueCount = useMemo(() =>
    tickets.filter((t) => t.assignee === user?.name && t.status !== 'Resolved' && t.status !== 'Closed').length,
    [tickets, user]
  );

  const systems = useMemo(() => [...new Set(tickets.map((t) => t.system))], [tickets]);
  const banks = useMemo(() => [...new Set(tickets.map(resolveTicketBankName))].sort(), [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (myQueueOnly && t.assignee !== user?.name) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterSystem !== 'all' && t.system !== filterSystem) return false;
      if (filterBank !== 'all' && resolveTicketBankName(t) !== filterBank) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.reporter.toLowerCase().includes(q) ||
          t.module.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tickets, filterPriority, filterStatus, filterSystem, filterBank, searchQuery]);

  const kpiCards = useMemo(() => [
    {
      label: 'Open Tickets',
      value: tickets.filter((t) => t.status === 'Open').length,
      icon: AlertTriangle,
      accent: 'text-primary',
    },
    {
      label: 'Total Resolved',
      value: tickets.filter((t) => t.status === 'Resolved').length,
      icon: TicketCheck,
      accent: 'text-success',
    },
    {
      label: 'Pending Our Action',
      value: tickets.filter((t) => t.status === 'In Progress').length,
      icon: Clock,
      accent: 'text-warning',
    },
  ], [tickets]);

  const hasFilters = filterPriority !== 'all' || filterStatus !== 'all' || filterSystem !== 'all' || filterBank !== 'all' || myQueueOnly;

  const clearFilters = () => {
    setFilterPriority('all');
    setFilterStatus('all');
    setFilterSystem('all');
    setFilterBank('all');
    setMyQueueOnly(false);
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'status' | 'assign'>('status');
  const [bulkValue, setBulkValue] = useState('');
  const queryClient = useQueryClient();

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action, value }: { ids: string[]; action: 'status' | 'assign'; value: string }) =>
      api.bulkUpdateTickets(ids, action, value),
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} ticket${data.updated !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setBulkValue('');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const allFilteredIds = filtered.map((t) => t.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBulkAction = () => {
    if (!bulkValue || selectedIds.size === 0) return;
    bulkMutation.mutate({ ids: [...selectedIds], action: bulkAction, value: bulkValue });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? 'All clients — overview of every support ticket' : 'Overview of your support activity'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Auto-refresh in {Math.floor(nextRefreshIn / 60)}:{String(nextRefreshIn % 60).padStart(2, '0')}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportToCSV(filtered)}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => refetch()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-lg border border-border p-5 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
              <p className="text-3xl font-bold mt-1 text-foreground">
                {isLoading ? '—' : kpi.value}
              </p>
            </div>
            <div className={`p-2.5 rounded-lg bg-surface ${kpi.accent}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
        {isInorins && (
          <button
            onClick={() => setMyQueueOnly((p) => !p)}
            className={cn(
              'rounded-lg border p-5 flex items-start justify-between transition-colors text-left',
              myQueueOnly
                ? 'bg-secondary/10 border-secondary/30'
                : 'bg-card border-border hover:bg-surface/60'
            )}
          >
            <div>
              <p className={cn('text-sm font-medium', myQueueOnly ? 'text-secondary' : 'text-muted-foreground')}>My Queue</p>
              <p className={cn('text-3xl font-bold mt-1', myQueueOnly ? 'text-secondary' : 'text-foreground')}>
                {isLoading ? '—' : myQueueCount}
              </p>
            </div>
            <div className={cn('p-2.5 rounded-lg', myQueueOnly ? 'bg-secondary/20 text-secondary' : 'bg-surface text-muted-foreground')}>
              <UserCheck className="h-5 w-5" />
            </div>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <Select value={filterBank} onValueChange={setFilterBank}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Bank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Banks</SelectItem>
            {banks.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
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

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Pending Client">Pending Client</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
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
            onClick={clearFilters}
            className="flex items-center gap-1 h-8 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
  
      </div>

      {/* API error banner */}
      {isError && (
        <div className="rounded-md bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-primary">
          Could not reach the API. Please check if the backend server is running.
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-card rounded-lg border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-foreground">All Tickets</h2>
          {/* Bulk action toolbar — only visible when items are selected */}
          {someSelected && isInorins && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
              <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as 'status' | 'assign')}>
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Set Status</SelectItem>
                  <SelectItem value="assign">Assign To</SelectItem>
                </SelectContent>
              </Select>
              {bulkAction === 'status' ? (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue placeholder="Pick status…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Pending Client">Pending Client</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <input
                  className="h-7 px-2 rounded-md border border-border text-xs bg-background w-36 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Assignee name…"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                />
              )}
              <Button size="sm" className="h-7 text-xs gap-1" onClick={applyBulkAction} disabled={!bulkValue || bulkMutation.isPending}>
                <UserCheck className="h-3.5 w-3.5" />
                Apply
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setSelectedIds(new Set()); setBulkValue(''); }}>
                <XCircle className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          )}
          {!someSelected && (
            <span className="text-xs text-muted-foreground">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {isInorins && (
                  <th className="px-3 py-3 w-8">
                    <button onClick={toggleAll} className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                )}
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">System</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Bank</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">SLA</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {Array.from({ length: isInorins ? 9 : 8 }).map((__, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-muted rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isInorins ? 9 : 8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No tickets match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const sla = getSLAInfo(t);
                  const isUnread = isInorins && !viewedIds.has(t.id);
                  const isChecked = selectedIds.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={cn('border-b border-border last:border-0 hover:bg-surface/60 transition-colors', isChecked && 'bg-primary/5')}
                    >
                      {isInorins && (
                        <td className="px-3 py-3.5" onClick={(e) => { e.stopPropagation(); toggleOne(t.id); }}>
                          <button className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                            {isChecked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                          </button>
                        </td>
                      )}
                      <td className="px-5 py-3.5 cursor-pointer" onClick={() => handleViewTicket(t.id)}>
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <span className="inline-block h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span className={cn('font-mono text-xs font-semibold text-secondary', !isUnread && 'ml-4')}>{t.id}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs cursor-pointer" onClick={() => handleViewTicket(t.id)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('truncate', isUnread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>{t.title}</span>
                          {t.isEdited && (
                            <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/25">
                              Edited
                            </span>
                          )}
                          {t.forwardedTo && user?.name === t.forwardedTo && (
                            <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-info/10 text-info border border-info/25">
                              <CornerUpRight className="h-2.5 w-2.5" />
                              Forwarded
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 cursor-pointer" onClick={() => handleViewTicket(t.id)}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/20">
                          {t.system}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground cursor-pointer" onClick={() => handleViewTicket(t.id)}>{resolveTicketBankName(t)}</td>
                      <td className="px-5 py-3.5 cursor-pointer" onClick={() => handleViewTicket(t.id)}><PriorityBadge priority={t.priority} /></td>
                      <td className="px-5 py-3.5 cursor-pointer" onClick={() => handleViewTicket(t.id)}><StatusBadge status={t.status} /></td>
                      <td className={cn('px-5 py-3.5 text-xs cursor-pointer', sla.className)} onClick={() => handleViewTicket(t.id)}>{sla.label}</td>
                      <td className="px-5 py-3.5 text-muted-foreground cursor-pointer" onClick={() => handleViewTicket(t.id)}>{t.lastUpdated}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
