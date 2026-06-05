import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useTickets(options?: { refetchInterval?: number }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tickets'],
    queryFn: api.getTickets,
    retry: 1,
    refetchInterval: options?.refetchInterval,
  });

  return {
    tickets: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  };
}

export function useAllTickets() {
  const query = useQuery({
    queryKey: ['all-tickets'],
    queryFn: api.getAllTickets,
    retry: 1,
    refetchInterval: 30_000,
  });
  return {
    tickets: query.data ?? [],
    isLoading: query.isLoading,
    refetch: () => query.refetch(),
  };
}

export function useTicket(id: string) {
  const query = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.getTicket(id),
    enabled: !!id,
    retry: 1,
  });

  return {
    ticket: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useTicketMessages(ticketId: string) {
  const query = useQuery({
    queryKey: ['messages', ticketId],
    queryFn: () => api.getMessages(ticketId),
    enabled: !!ticketId,
    retry: 1,
    refetchInterval: 5000,
  });

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

import { loadSeen } from '@/components/views/InboxView';
import { useAuth } from '@/context/AuthContext';

export function useChatUnreadCount(): number {
  const { counts } = useMessageCounts();
  const { tickets } = useTickets();
  const { user } = useAuth();
  const seen = loadSeen();

  // Mirror InboxView's scopedTickets exactly:
  // 1. Active statuses only (no Resolved/Closed)
  // 2. For inorins staff: own assigned + unassigned only
  const active = tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed');
  const myName = (user?.name ?? '').toLowerCase();
  const scoped = user?.role === 'inorins'
    ? active.filter((t) => !t.assignee?.trim() || t.assignee.toLowerCase() === myName)
    : active;

  const scopedIds = new Set(scoped.map((t) => t.id));

  return counts.reduce((sum, c) => {
    if (!scopedIds.has(c.ticketId)) return sum;
    if (!(c.ticketId in seen)) return sum;
    return sum + Math.max(0, c.totalCount - (seen[c.ticketId] ?? 0));
  }, 0);
}

export function useMyPermissions() {
  const query = useQuery({
    queryKey: ['my-permissions'],
    queryFn: api.getMyPermissions,
    retry: 1,
    staleTime: 60_000,
  });
  return {
    permissions: query.data ?? null,
    isLoading: query.isLoading,
  };
}

export function useMessageCounts() {
  const query = useQuery({
    queryKey: ['message-counts'],
    queryFn: api.getMessageCounts,
    refetchInterval: 3000,
    retry: 1,
  });
  return {
    counts: query.data ?? [],
    isLoading: query.isLoading,
  };
}

export function useStats() {
  const query = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    retry: 1,
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
  };
}
