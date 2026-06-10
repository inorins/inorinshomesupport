import type { Ticket, ChatMessage, ResolutionNote, AppNotification, TicketLinkEntry, SystemChange, SystemChangeBank, RolePermission, TicketSystemChangeLink, AuditLog, StatsBreakdown, TicketWatcher, UserSession } from '@/data/mockData';
import type { AppUser } from '@/data/users';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || '/api';

const TOKEN_KEY = 'inorins_session_token';

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export const SESSION_EXPIRED_EVENT = 'inorins:session-expired';
export const NETWORK_ERROR_EVENT = 'inorins:network-error';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      ...options,
    });
  } catch {
    window.dispatchEvent(new Event(NETWORK_ERROR_EVENT));
    throw new Error('Failed to fetch');
  }
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    let message = `API ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // ignore JSON parse errors and keep fallback message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export interface AuthUser extends Omit<AppUser, 'password'> {}

export interface MessageAttachmentPayload {
  name: string;
  size: number;
  type: string;
  content: string;
}

export interface SendMessagePayload {
  content: string;
  isInternal: boolean;
  role?: 'employee' | 'client';
  author?: string;
  attachments?: MessageAttachmentPayload[];
}

export interface StatsResponse {
  openTickets: number;
  resolvedThisWeek: number;
  pendingOurAction: number;
}

export const api = {
  // Auth
  login: async (email: string, password: string): Promise<AuthUser> => {
    const result = await request<{ user: AuthUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(result.token);
    return result.user;
  },
  getUser: (id: string) => request<AuthUser>(`/auth/users/${id}`),
  getDemoUsers: () => request<AuthUser[]>('/auth/demo-users'),
  getMyPermissions: () => request<import('@/data/mockData').RolePermission>('/auth/me/permissions'),

  // Tickets
  getTickets: () => request<Ticket[]>('/tickets'),
  getAllTickets: () => request<Ticket[]>('/tickets/board-all'),
  getTicket: (id: string) => request<Ticket>(`/tickets/${id}`),
  createTicket: (data: Partial<Ticket>) =>
    request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateTicketStatus: (id: string, status: string) =>
    request<Ticket>(`/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  assignTicket: (id: string, assignee: string) =>
    request<Ticket>(`/tickets/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ assignee }) }),
  resolveTicket: (id: string, status: 'Resolved' | 'Closed', resolutionNote: ResolutionNote) =>
    request<Ticket>(`/tickets/${id}/resolve`, { method: 'PATCH', body: JSON.stringify({ status, resolutionNote }) }),

  // Messages
  getMessages: (ticketId: string) =>
    request<ChatMessage[]>(`/tickets/${ticketId}/messages`),
  sendMessage: (ticketId: string, data: SendMessagePayload) =>
    request<ChatMessage>(`/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Stats
  getStats: () => request<StatsResponse>('/stats'),

  // Forward
  forwardTicket: (ticketId: string, forwardedTo: string, forwardedBy: string, forwardNote?: string) =>
    request<Ticket>(`/tickets/${ticketId}/forward`, {
      method: 'PATCH',
      body: JSON.stringify({ forwardedTo, forwardedBy, forwardNote }),
    }),
  clearForward: (ticketId: string) =>
    request<Ticket>(`/tickets/${ticketId}/forward`, { method: 'DELETE' }),

  // Account
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Archive (admin only)
  getArchive: () => request<Ticket[]>('/archive'),

  // Notifications
  getNotifications: () => request<AppNotification[]>('/notifications'),
  markAllNotificationsRead: () => request<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' }),
  markNotificationRead: (id: string) => request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),

  // Client ticket edit
  editTicket: (id: string, data: Partial<Ticket>) =>
    request<Ticket>(`/tickets/${id}/edit`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Admin user management
  getAdminUsers: () => request<AppUser[]>('/admin/users'),
  createUser: (data: Partial<AppUser> & { password: string; isDepartmentHead?: boolean }) =>
    request<AppUser>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<AppUser> & { isActive?: boolean; isDepartmentHead?: boolean }) =>
    request<AppUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetUserPassword: (id: string, newPassword: string) =>
    request<{ message: string }>(`/admin/users/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    }),
  deactivateUser: (id: string) =>
    request<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),

  // System Changes
  getSystemChanges: (filters?: { status?: string; system?: string; bankName?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.system) params.set('system', filters.system);
    if (filters?.bankName) params.set('bankName', filters.bankName);
    const qs = params.toString();
    return request<SystemChange[]>(`/system-changes${qs ? `?${qs}` : ''}`);
  },
  createSystemChange: (data: Record<string, unknown>) =>
    request<SystemChange>('/system-changes', { method: 'POST', body: JSON.stringify(data) }),
  updateSystemChange: (id: number, data: Record<string, unknown>) =>
    request<SystemChange>(`/system-changes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSystemChange: (id: number) =>
    request<{ ok: boolean }>(`/system-changes/${id}`, { method: 'DELETE' }),
  // System change bank tracking
  getSystemChangeBanks: (changeId: number) =>
    request<SystemChangeBank[]>(`/system-changes/${changeId}/banks`),
  setSystemChangeBanks: (changeId: number, banks: { bankName: string; status: 'Pending' | 'Done'; note?: string }[]) =>
    request<SystemChangeBank[]>(`/system-changes/${changeId}/banks`, { method: 'PUT', body: JSON.stringify({ banks }) }),
  updateSystemChangeBank: (changeId: number, bankName: string, status: 'Pending' | 'Done', note?: string) =>
    request<SystemChangeBank>(`/system-changes/${changeId}/banks/${encodeURIComponent(bankName)}`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),

  // System change items
  getSystemChangeItems: (changeId: number) =>
    request<import('@/data/mockData').SystemChangeItem[]>(`/system-changes/${changeId}/items`),
  setSystemChangeItems: (changeId: number, items: Array<{ changeType?: string; objectName?: string; beforeState?: string; afterState?: string; attachmentContent?: string; attachmentName?: string; attachmentUrl?: string }>) =>
    request<import('@/data/mockData').SystemChangeItem[]>(`/system-changes/${changeId}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),

  // System change ↔ ticket links
  getSystemChangeTickets: (changeId: number) =>
    request<TicketSystemChangeLink[]>(`/system-changes/${changeId}/tickets`),
  linkTicketToChange: (changeId: number, ticketId: string, note?: string) =>
    request<TicketSystemChangeLink[]>(`/system-changes/${changeId}/tickets`, { method: 'POST', body: JSON.stringify({ ticketId, note }) }),
  unlinkTicketFromChange: (changeId: number, ticketId: string) =>
    request<{ ok: boolean }>(`/system-changes/${changeId}/tickets/${encodeURIComponent(ticketId)}`, { method: 'DELETE' }),

  // From ticket side
  getTicketSystemChanges: (ticketId: string) =>
    request<TicketSystemChangeLink[]>(`/tickets/${ticketId}/system-changes`),
  linkChangeToTicket: (ticketId: string, changeId: number, note?: string) =>
    request<TicketSystemChangeLink[]>(`/tickets/${ticketId}/system-changes`, { method: 'POST', body: JSON.stringify({ changeId, note }) }),
  unlinkChangeFromTicket: (ticketId: string, changeId: number) =>
    request<{ ok: boolean }>(`/tickets/${ticketId}/system-changes/${changeId}`, { method: 'DELETE' }),

  // Role permissions
  getPermissions: () => request<RolePermission[]>('/admin/permissions'),
  upsertPermission: (data: Partial<RolePermission> & { role: string }) =>
    request<RolePermission>('/admin/permissions', { method: 'PUT', body: JSON.stringify(data) }),
  deletePermission: (id: number) =>
    request<{ ok: boolean }>(`/admin/permissions/${id}`, { method: 'DELETE' }),

  // Ticket links
  getTicketLinks: (ticketId: string) => request<TicketLinkEntry[]>(`/tickets/${ticketId}/links`),
  createTicketLink: (ticketId: string, data: { linkedTicketId: string; linkType: 'duplicate' | 'related'; note?: string }) =>
    request<{ id: number; links: TicketLinkEntry[] }>(`/tickets/${ticketId}/links`, { method: 'POST', body: JSON.stringify(data) }),
  deleteTicketLink: (ticketId: string, linkId: number) =>
    request<{ ok: boolean }>(`/tickets/${ticketId}/links/${linkId}`, { method: 'DELETE' }),

  // Ticket watchers
  getWatchers: (ticketId: string) => request<TicketWatcher[]>(`/tickets/${ticketId}/watchers`),
  watchTicket: (ticketId: string) => request<TicketWatcher[]>(`/tickets/${ticketId}/watchers`, { method: 'POST' }),
  unwatchTicket: (ticketId: string, userId: number | 'me') =>
    request<TicketWatcher[]>(`/tickets/${ticketId}/watchers/${userId}`, { method: 'DELETE' }),

  // Admin session management
  getSessions: () => request<UserSession[]>('/admin/sessions'),
  revokeSession: (id: number) => request<{ ok: boolean }>(`/admin/sessions/${id}`, { method: 'DELETE' }),
  revokeAllUserSessions: (userId: number) => request<{ ok: boolean }>(`/admin/sessions/user/${userId}`, { method: 'DELETE' }),

  // Audit logs (admin only)
  getAuditLogs: (params?: { action?: string; entityType?: string; entityId?: string; userEmail?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) => {
    const p = new URLSearchParams();
    if (params?.action)     p.set('action', params.action);
    if (params?.entityType) p.set('entityType', params.entityType);
    if (params?.entityId)   p.set('entityId', params.entityId);
    if (params?.userEmail)  p.set('userEmail', params.userEmail);
    if (params?.dateFrom)   p.set('dateFrom', params.dateFrom);
    if (params?.dateTo)     p.set('dateTo', params.dateTo);
    if (params?.page)       p.set('page', String(params.page));
    if (params?.limit)      p.set('limit', String(params.limit));
    const qs = p.toString();
    return request<{ logs: AuditLog[]; total: number; page: number; limit: number }>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },

  // Stats breakdown (admin)
  getStatsBreakdown: () => request<StatsBreakdown>('/tickets/stats/breakdown'),

  // Bulk ticket actions
  bulkUpdateTickets: (ids: string[], action: 'status' | 'assign', value: string) =>
    request<{ updated: number }>('/tickets/bulk', { method: 'POST', body: JSON.stringify({ ids, action, value }) }),

  // Ticket reopen
  reopenTicket: (id: string, reopenNote: string) =>
    request<Ticket>(`/tickets/${id}/reopen`, { method: 'PATCH', body: JSON.stringify({ reopenNote }) }),

  // Chat unread counts
  getMessageCounts: () =>
    request<Array<{ ticketId: string; totalCount: number; lastMessageAt: string }>>('/messages/counts'),

  // Gmail Inbox
  getInbox: (status?: string) =>
    request<import('@/hooks/useInboxEmails').InboxResponse>(
      `/inbox${status ? `?status=${status}` : ''}`
    ),
  inboxToTicket: (id: number, data?: Record<string, string>) =>
    request<{ ticket: unknown; emailId: number }>(`/inbox/${id}/to-ticket`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),
  dismissInboxEmail: (id: number) =>
    request<{ ok: boolean }>(`/inbox/${id}`, { method: 'DELETE' }),
  syncInbox: () =>
    request<{ message: string }>('/inbox/sync', { method: 'POST' }),
};
