import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import type { AuditLog } from '@/data/mockData';

const ACTION_LABELS: Record<string, string> = {
  'ticket.created':        'Ticket Created',
  'ticket.updated':        'Ticket Updated',
  'user.updated':          'User Updated',
  'message.created':       'Message Posted',
  'system_change.created': 'Change Created',
  'system_change.updated': 'Change Updated',
};

const ACTION_COLORS: Record<string, string> = {
  'ticket.created':        'bg-success/10 text-success border-success/20',
  'ticket.updated':        'bg-info/10 text-info border-info/20',
  'user.updated':          'bg-warning/10 text-warning border-warning/20',
  'message.created':       'bg-secondary/10 text-secondary border-secondary/20',
  'system_change.created': 'bg-primary/10 text-primary border-primary/20',
  'system_change.updated': 'bg-primary/10 text-primary border-primary/20',
};

function DiffBadge({ label, old: oldVal, next: nextVal }: { label: string; old: unknown; next: unknown }) {
  if (oldVal === null || oldVal === undefined) return null;
  const changed = String(oldVal) !== String(nextVal);
  if (!changed) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 bg-muted border border-border">
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="line-through text-destructive/70">{String(oldVal)}</span>
      <span className="text-muted-foreground">→</span>
      <span className="text-success font-medium">{String(nextVal)}</span>
    </span>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const actionLabel = ACTION_LABELS[log.action] ?? log.action;
  const colorClass = ACTION_COLORS[log.action] ?? 'bg-muted text-muted-foreground border-border';

  const diffs: { label: string; old: unknown; next: unknown }[] = [];
  if (log.old_values && log.new_values) {
    for (const key of Object.keys(log.new_values)) {
      const oldVal = log.old_values[key];
      const newVal = log.new_values[key];
      if (String(oldVal) !== String(newVal)) {
        diffs.push({ label: key, old: oldVal, next: newVal });
      }
    }
  }

  return (
    <tr
      className="border-b border-border last:border-0 hover:bg-surface/60 cursor-pointer transition-colors"
      onClick={() => diffs.length > 0 && setExpanded((p) => !p)}
    >
      <td className="px-5 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {new Date(log.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}
      </td>
      <td className="px-5 py-3">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border', colorClass)}>
          {actionLabel}
        </span>
      </td>
      <td className="px-5 py-3 text-xs text-foreground">
        {log.entity_type && (
          <span className="text-muted-foreground">{log.entity_type}: </span>
        )}
        <span className="font-mono font-semibold">{log.entity_id ?? '—'}</span>
      </td>
      <td className="px-5 py-3 text-xs text-muted-foreground">{log.user_email ?? 'System'}</td>
      <td className="px-5 py-3 max-w-xs">
        {expanded && diffs.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {diffs.map((d) => (
              <DiffBadge key={d.label} label={d.label} old={d.old} next={d.next} />
            ))}
          </div>
        ) : diffs.length > 0 ? (
          <span className="text-xs text-primary hover:underline">{diffs.length} change{diffs.length !== 1 ? 's' : ''} — click to expand</span>
        ) : log.new_values ? (
          <span className="text-xs text-muted-foreground truncate">
            {Object.entries(log.new_values).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ')}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

const PAGE_SIZES = [25, 50, 100];
const ENTITY_TYPES = ['ticket', 'user', 'message', 'system_change'];
const ACTIONS = Object.keys(ACTION_LABELS);

export function AuditLogView() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const params = {
    page,
    limit,
    action: filterAction || undefined,
    entityType: filterEntityType || undefined,
    userEmail: filterEmail || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
  };

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.getAuditLogs(params),
    staleTime: 30_000,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const clearFilters = useCallback(() => {
    setFilterAction('');
    setFilterEntityType('');
    setFilterEmail('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPendingEmail('');
    setPage(1);
  }, []);

  const hasFilters = !!(filterAction || filterEntityType || filterEmail || filterDateFrom || filterDateTo);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full record of who changed what and when across tickets, users, messages and system changes.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={filterAction || 'all'} onValueChange={(v) => { setFilterAction(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEntityType || 'all'} onValueChange={(v) => { setFilterEntityType(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {ENTITY_TYPES.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 w-48 text-xs"
            placeholder="Filter by email…"
            value={pendingEmail}
            onChange={(e) => setPendingEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setFilterEmail(pendingEmail); setPage(1); } }}
          />
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>From</span>
          <Input type="date" className="h-8 w-36 text-xs" value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }} />
          <span>To</span>
          <Input type="date" className="h-8 w-36 text-xs" value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }} />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {isError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          Failed to load audit logs. Please check if the backend server is running.
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg border border-border">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">
            {data ? `${data.total.toLocaleString()} log entries` : 'Audit Entries'}
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page:</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Time (NPT)</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Action</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Entity</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">By</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Changes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !data?.logs.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No audit log entries match the current filters.
                  </td>
                </tr>
              ) : (
                data.logs.map((log) => <LogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > limit && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, data.total)} of {data.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2">Page {page} of {totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
