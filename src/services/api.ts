import type { Ticket, ChatMessage, ResolutionNote, AppNotification } from '@/data/mockData';
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
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

  // Tickets
  getTickets: () => request<Ticket[]>('/tickets'),
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
  createUser: (data: Partial<AppUser> & { password: string }) =>
    request<AppUser>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<AppUser> & { isActive?: boolean }) =>
    request<AppUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetUserPassword: (id: string, newPassword: string) =>
    request<{ message: string }>(`/admin/users/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    }),
  deactivateUser: (id: string) =>
    request<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),
};
