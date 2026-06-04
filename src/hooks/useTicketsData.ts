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

export function useChatUnreadCount(): number {
  const { counts } = useMessageCounts();
  const { tickets } = useTickets();
  const seen = loadSeen();

  // Mirror InboxView's scoping: for inorins users only own + unassigned tickets count
  // We don't have user context here, so we count all tickets that are in seen map.
  // The sidebar re-renders every 3 s when counts update, so localStorage is always fresh.
  const scopedIds = new Set(tickets.map((t) => t.id));

  return counts.reduce((sum, c) => {
    if (!scopedIds.has(c.ticketId)) return sum;
    if (!(c.ticketId in seen)) return sum;
    return sum + Math.max(0, c.totalCount - (seen[c.ticketId] ?? 0));
  }, 0);
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
