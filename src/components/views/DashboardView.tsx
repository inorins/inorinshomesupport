import { useState, useMemo, useEffect, useRef } from 'react';
import {
  TicketCheck, Clock, AlertTriangle, ArrowUpRight, RefreshCw,
  Download, Filter, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTickets } from '@/hooks/useTicketsData';
import { useAuth } from '@/context/AuthContext';
import type { Priority, TicketStatus, Ticket } from '@/data/mockData';
import { cn } from '@/lib/utils';

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

const ACTIVE_STATUSES = new Set<TicketStatus>(['Open', 'In Progress', 'Pending Client']);

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
  const [showAll, setShowAll] = useState(false);

  const systems = useMemo(() => [...new Set(tickets.map((t) => t.system))], [tickets]);
  const banks = useMemo(() => [...new Set(tickets.map(resolveTicketBankName))].sort(), [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (!isAdmin && user?.role === 'inorins' && user?.name) {
        const assignee = (t.assignee ?? '').trim().toLowerCase();
        if (assignee && assignee !== user.name.toLowerCase()) return false;
      }
      const isActive = ACTIVE_STATUSES.has(t.status as TicketStatus);
      if (showAll ? isActive : !isActive) return false;
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
  }, [tickets, filterPriority, filterStatus, filterSystem, filterBank, searchQuery, user, showAll, isAdmin]);

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

  const hasFilters = filterPriority !== 'all' || filterStatus !== 'all' || filterSystem !== 'all' || filterBank !== 'all' || showAll;

  const clearFilters = () => {
    setFilterPriority('all');
    setFilterStatus('all');
    setFilterSystem('all');
    setFilterBank('all');
    setShowAll(false);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <SelectItem value="all">{showAll ? 'All Resolved/Closed' : 'All Active'}</SelectItem>
            {showAll ? (
              <>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Pending Client">Pending Client</SelectItem>
              </>
            )}
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

        <button
          onClick={() => { setShowAll((v) => !v); setFilterStatus('all'); }}
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors',
            showAll
              ? 'bg-secondary/10 text-secondary border-secondary/30'
              : 'bg-card text-muted-foreground border-border hover:bg-accent'
          )}
        >
          Resolved / Closed
        </button>

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
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">
            {showAll ? 'Resolved / Closed Tickets' : 'Active Tickets'}
          </h2>
          <button
            onClick={() => { setShowAll((v) => !v); setFilterStatus('all'); }}
            className="text-sm text-primary font-medium flex items-center gap-1 hover:underline"
          >
            {showAll ? 'View Active' : 'View Resolved / Closed'}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
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
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-muted rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No tickets match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const sla = getSLAInfo(t);
                  const isUnread = isInorins && !viewedIds.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleViewTicket(t.id)}
                      className="border-b border-border last:border-0 hover:bg-surface/60 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <span className="inline-block h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span className={cn('font-mono text-xs font-semibold text-secondary', !isUnread && 'ml-4')}>{t.id}</span>
                        </div>
                      </td>
                      <td className={cn('px-5 py-3.5 max-w-xs truncate', isUnread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>{t.title}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/20">
                          {t.system}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground">{resolveTicketBankName(t)}</td>
                      <td className="px-5 py-3.5"><PriorityBadge priority={t.priority} /></td>
                      <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                      <td className={cn('px-5 py-3.5 text-xs', sla.className)}>{sla.label}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{t.lastUpdated}</td>
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
