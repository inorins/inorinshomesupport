import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Shield, Trash2, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { UserSession } from '@/data/mockData';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function parseUA(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (/mobile/i.test(ua)) return 'Mobile Browser';
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  if (/edge/i.test(ua)) return 'Edge';
  return 'Browser';
}

export function SessionManagementView() {
  const queryClient = useQueryClient();
  const [confirmRevoke, setConfirmRevoke] = useState<number | null>(null);

  const { data: sessions = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.getSessions(),
    staleTime: 30_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => api.revokeSession(id),
    onSuccess: () => {
      toast.success('Session revoked');
      setConfirmRevoke(null);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeAllMutation = useMutation({
    mutationFn: (userId: number) => api.revokeAllUserSessions(userId),
    onSuccess: () => {
      toast.success('All sessions for user revoked');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Group by user for the "revoke all" action
  const byUser = sessions.reduce<Record<number, UserSession[]>>((acc, s) => {
    (acc[s.user_id] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Session Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View all active login sessions. Revoke suspicious or stale sessions.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Session table */}
      <div className="bg-card rounded-lg border border-border">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">
            {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">User</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Role</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Browser</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">IP Address</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Created</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Last Seen</th>
                <th className="w-24 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No active sessions found.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                          <Shield className="h-3.5 w-3.5 text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.user_name}</p>
                          <p className="text-xs text-muted-foreground">{s.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border',
                        s.role === 'inorins'
                          ? 'bg-secondary/10 text-secondary border-secondary/20'
                          : 'bg-muted text-muted-foreground border-border'
                      )}>
                        {s.role === 'inorins' ? 'Staff' : 'Client'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-foreground">
                        <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {parseUA(s.user_agent)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-muted-foreground">
                      {s.ip_address ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(s.last_seen_at)}
                    </td>
                    <td className="px-5 py-3">
                      {confirmRevoke === s.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            className="text-xs text-destructive font-semibold hover:underline"
                            onClick={() => revokeMutation.mutate(s.id)}
                            disabled={revokeMutation.isPending}
                          >
                            Confirm
                          </button>
                          <button
                            className="text-xs text-muted-foreground hover:underline"
                            onClick={() => setConfirmRevoke(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmRevoke(s.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoke all per user */}
      {Object.keys(byUser).length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Revoke all sessions by user</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byUser).map(([userId, userSessions]) => (
              <button
                key={userId}
                onClick={() => revokeAllMutation.mutate(Number(userId))}
                disabled={revokeAllMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/30 text-xs font-medium text-destructive/80 hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                {userSessions[0].user_name} ({userSessions.length})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
