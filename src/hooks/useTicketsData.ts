import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useTickets() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tickets'],
    queryFn: api.getTickets,
    retry: 1,
  });

  return {
    tickets: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
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
