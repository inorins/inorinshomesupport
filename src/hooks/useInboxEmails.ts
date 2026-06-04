import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface InboxEmail {
  id: number;
  accountEmail: string;
  gmailUid: string;
  senderName: string | null;
  senderEmail: string;
  replyTo: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  status: 'pending' | 'ticket_created' | 'dismissed';
  ticketId: string | null;
  processedBy: number | null;
  processedAt: string | null;
}

export interface InboxResponse {
  emails: InboxEmail[];
  pending: number;
}

export type InboxFilter = 'pending' | 'ticket_created' | 'dismissed' | 'all';

export function useInboxEmails(filter: InboxFilter = 'pending') {
  return useQuery<InboxResponse>({
    queryKey: ['inbox', filter],
    queryFn: () => api.getInbox(filter === 'all' ? undefined : filter),
    refetchInterval: 60_000,
  });
}

export function usePendingInboxCount() {
  const { data } = useQuery<InboxResponse>({
    queryKey: ['inbox', 'pending'],
    queryFn: () => api.getInbox('pending'),
    refetchInterval: 60_000,
    select: (d) => d,
  });
  return data?.pending ?? 0;
}

export function useInboxMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inbox'] });

  const convertToTicket = useMutation({
    mutationFn: ({ id, data }: { id: number; data?: Record<string, string> }) =>
      api.inboxToTicket(id, data),
    onSuccess: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: (id: number) => api.dismissInboxEmail(id),
    onSuccess: invalidate,
  });

  const sync = useMutation({
    mutationFn: () => api.syncInbox(),
    onSuccess: invalidate,
  });

  return { convertToTicket, dismiss, sync };
}
