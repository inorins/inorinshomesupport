/*
 * ─── OLD GMAIL INBOX (commented out) ────────────────────────────────────────
 * The original Gmail inbox was moved to GmailInboxView.tsx.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare, Search, Send, Loader2, Bell, ChevronLeft,
  Circle, AlertCircle, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { useTickets, useTicketMessages, useMessageCounts } from '@/hooks/useTicketsData';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Ticket, ChatMessage } from '@/data/mockData';

// ── persistence helpers ───────────────────────────────────────────────────────

export const CHAT_SEEN_KEY = 'chat_seen_counts_v1';

export function loadSeen(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CHAT_SEEN_KEY) ?? '{}'); }
  catch { return {}; }
}

function saveSeen(map: Record<string, number>) {
  localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(map));
}

// ── formatting ────────────────────────────────────────────────────────────────

function formatTs(iso: string) {
  const d = new Date(iso);
  const diffMin = (Date.now() - d.getTime()) / 60000;
  if (diffMin < 1)    return 'Just now';
  if (diffMin < 60)   return `${Math.floor(diffMin)}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' });
}

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kathmandu',
  });
}

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ReactNode> = {
  'Open':           <Circle       className="h-3 w-3 text-blue-500 fill-blue-500" />,
  'In Progress':    <Clock        className="h-3 w-3 text-yellow-500" />,
  'Pending Client': <AlertCircle  className="h-3 w-3 text-orange-500" />,
  'Resolved':       <CheckCircle2 className="h-3 w-3 text-green-500" />,
  'Closed':         <XCircle      className="h-3 w-3 text-muted-foreground" />,
};

const PRIORITY_DOT: Record<string, string> = {
  Critical: 'bg-red-500',
  High:     'bg-orange-500',
  Medium:   'bg-yellow-500',
  Low:      'bg-green-500',
};

// ── TicketListItem ────────────────────────────────────────────────────────────

function TicketListItem({
  ticket, isSelected, unreadCount, lastMessageAt, onClick,
}: {
  ticket: Ticket; isSelected: boolean; unreadCount: number;
  lastMessageAt?: string; onClick: () => void;
}) {
  const hasUnread = unreadCount > 0;
  const ts = lastMessageAt ?? ticket.lastUpdated ?? ticket.createdAt;

  return (
    <button
      className={cn(
        'w-full text-left px-4 py-3 flex gap-3 items-start border-b border-border/50 transition-colors',
        isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50',
        hasUnread && !isSelected && 'bg-blue-50/60 dark:bg-blue-950/20',
      )}
      onClick={onClick}
    >
      <div className="mt-1.5 flex-shrink-0">
        <span className={cn('h-2 w-2 rounded-full inline-block', PRIORITY_DOT[ticket.priority] ?? 'bg-muted')} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className={cn('text-xs font-medium truncate', hasUnread ? 'text-primary' : 'text-muted-foreground')}>
            {ticket.id}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasUnread && (
              <span className="h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatTs(ts)}</span>
          </div>
        </div>

        <p className={cn('text-sm truncate leading-snug mt-0.5', hasUnread ? 'font-semibold' : 'font-medium')}>
          {ticket.title}
        </p>

        <div className="flex items-center gap-1.5 mt-1">
          {STATUS_ICON[ticket.status]}
          <span className="text-[11px] text-muted-foreground">{ticket.status}</span>
          {ticket.bankName && (
            <span className="text-[11px] text-muted-foreground truncate">· {ticket.bankName}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  return (
    <div className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : '')}>
      <div className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5',
        msg.role === 'client' ? 'bg-orange-100 text-orange-700' : 'bg-primary/10 text-primary',
      )}>
        {(msg.author ?? '?').charAt(0).toUpperCase()}
      </div>

      <div className={cn('max-w-[75%]', isOwn ? 'items-end' : 'items-start')}>
        <div className={cn('flex items-baseline gap-2 mb-1', isOwn ? 'flex-row-reverse' : '')}>
          <span className="text-[11px] font-medium text-foreground/70">{msg.author}</span>
          <span className="text-[10px] text-muted-foreground">{formatMsgTime(msg.timestamp)}</span>
          {msg.isInternal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              Internal
            </span>
          )}
        </div>

        <div className={cn(
          'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
          isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm',
        )}>
          {msg.content}
        </div>

        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {msg.attachments.map((a) => (
              <span key={a.name} className="text-[11px] px-2 py-0.5 rounded border bg-background text-muted-foreground">
                📎 {a.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ConversationPanel ─────────────────────────────────────────────────────────

interface ConversationPanelProps {
  ticket: Ticket;
  currentUser: { name: string; role: string } | null;
  onClose: () => void;
  onMessagesLoaded: (ticketId: string, count: number) => void;
}

function ConversationPanel({ ticket, currentUser, onClose, onMessagesLoaded }: ConversationPanelProps) {
  const { messages, isLoading } = useTicketMessages(ticket.id);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Notify parent of current message count (stable callback, bail out if unchanged)
  useEffect(() => {
    if (!isLoading) {
      onMessagesLoaded(ticket.id, messages.length);
    }
  }, [ticket.id, messages.length, isLoading, onMessagesLoaded]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.sendMessage(ticket.id, {
        content,
        isInternal: false,
        role: currentUser?.role === 'client' ? 'client' : 'employee',
        author: currentUser?.name ?? 'Unknown',
      }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['messages', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['message-counts'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: () => toast({ title: 'Failed to send message', variant: 'destructive' }),
  });

  function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  }

  const visibleMessages = currentUser?.role === 'client'
    ? messages.filter((m) => !m.isInternal)
    : messages;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-card flex items-start gap-2 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 mt-0.5 flex-shrink-0" onClick={onClose}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">{ticket.id}</span>
            <Badge variant="outline" className={cn(
              'text-[10px] h-5',
              ticket.priority === 'Critical' && 'border-red-300 text-red-600',
              ticket.priority === 'High'     && 'border-orange-300 text-orange-600',
              ticket.priority === 'Medium'   && 'border-yellow-300 text-yellow-600',
              ticket.priority === 'Low'      && 'border-green-300 text-green-600',
            )}>
              {ticket.priority}
            </Badge>
            {STATUS_ICON[ticket.status]}
            <span className="text-[11px] text-muted-foreground">{ticket.status}</span>
          </div>
          <h2 className="font-semibold text-sm mt-0.5 leading-snug line-clamp-1">{ticket.title}</h2>
          {(ticket.assignee || ticket.bankName) && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {[ticket.bankName, ticket.assignee ? `Assigned: ${ticket.assignee}` : null]
                .filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Messages — flex-1 + overflow-hidden lets ScrollArea do its job */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-4 py-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <p className="text-sm">No messages yet.</p>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {visibleMessages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} isOwn={msg.author === currentUser?.name} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input */}
      {ticket.status !== 'Closed' ? (
        <div className="px-4 py-3 border-t bg-card flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Type a reply…"
              className="flex-1 text-sm"
              disabled={sendMutation.isPending}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!draft.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">Enter to send</p>
        </div>
      ) : (
        <div className="px-4 py-2 border-t bg-muted/30 text-center text-xs text-muted-foreground flex-shrink-0">
          This ticket is closed — replies are disabled.
        </div>
      )}
    </div>
  );
}

// ── InboxView (Ticket Chat Hub) ───────────────────────────────────────────────

interface InboxViewProps {
  onUnreadChange?: (count: number) => void;
}

export function InboxView({ onUnreadChange }: InboxViewProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { tickets, isLoading } = useTickets({ refetchInterval: 5000 });
  const { counts } = useMessageCounts();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>(loadSeen);

  // Staff: only own + unassigned tickets. Clients: already scoped by API.
  const scopedTickets = useMemo(() => {
    if (user?.role !== 'inorins') return tickets;
    const myName = (user.name ?? '').toLowerCase();
    return tickets.filter((t) => !t.assignee?.trim() || t.assignee.toLowerCase() === myName);
  }, [tickets, user]);

  // O(1) lookup maps built once per counts update
  const countMap = useMemo(
    () => Object.fromEntries(counts.map((c) => [c.ticketId, c.totalCount])),
    [counts],
  );
  const lastMsgMap = useMemo(
    () => Object.fromEntries(counts.map((c) => [c.ticketId, c.lastMessageAt])),
    [counts],
  );

  // Seed any ticket that has never been tracked (so it starts as read)
  useEffect(() => {
    if (counts.length === 0) return;
    setSeenCounts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of counts) {
        if (!(c.ticketId in next)) { next[c.ticketId] = c.totalCount; changed = true; }
      }
      if (changed) saveSeen(next);
      return changed ? next : prev;
    });
  }, [counts]);

  // Toast when a scoped ticket (not currently open) gets a new message
  const prevCountRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (counts.length === 0) return;
    const scopedIds = new Set(scopedTickets.map((t) => t.id));
    let toasted = false;
    for (const c of counts) {
      const prev = prevCountRef.current[c.ticketId];
      if (prev !== undefined && c.totalCount > prev && c.ticketId !== selectedId && scopedIds.has(c.ticketId)) {
        if (!toasted) {
          const t = scopedTickets.find((tk) => tk.id === c.ticketId);
          toast({ title: `New message on ${c.ticketId}`, description: t?.title ?? '' });
          toasted = true;
        }
      }
      prevCountRef.current[c.ticketId] = c.totalCount;
    }
  }, [counts, selectedId, scopedTickets, toast]);

  // Stable ref so markSeen always uses latest countMap without stale closures
  const countMapRef = useRef(countMap);
  countMapRef.current = countMap;

  const markSeen = useCallback((ticketId: string) => {
    const total = countMapRef.current[ticketId] ?? 0;
    setSeenCounts((prev) => {
      if (prev[ticketId] === total) return prev; // bail out — no change
      const next = { ...prev, [ticketId]: total };
      saveSeen(next);
      return next;
    });
  }, []);

  // Called by ConversationPanel each time messages are fetched — corrects seen count
  // Wrapped in useCallback so ConversationPanel's effect dep is stable
  const handleMessagesLoaded = useCallback((ticketId: string, count: number) => {
    setSeenCounts((prev) => {
      if (prev[ticketId] === count) return prev; // bail out — no change
      const next = { ...prev, [ticketId]: count };
      saveSeen(next);
      return next;
    });
  }, []);

  function unreadFor(ticketId: string): number {
    if (!(ticketId in seenCounts)) return 0;
    return Math.max(0, (countMap[ticketId] ?? 0) - (seenCounts[ticketId] ?? 0));
  }

  function handleSelect(ticketId: string) {
    setSelectedId(ticketId);
    markSeen(ticketId);
  }

  const filtered = useMemo(() => {
    if (!search) return scopedTickets;
    const q = search.toLowerCase();
    return scopedTickets.filter((t) =>
      t.id.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      (t.bankName ?? '').toLowerCase().includes(q)
    );
  }, [scopedTickets, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const ua = unreadFor(a.id), ub = unreadFor(b.id);
    if (ub !== ua) return ub - ua;
    const ta = lastMsgMap[a.id] ?? a.lastUpdated ?? a.createdAt;
    const tb = lastMsgMap[b.id] ?? b.lastUpdated ?? b.createdAt;
    return new Date(tb).getTime() - new Date(ta).getTime();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, seenCounts, countMap, lastMsgMap]);

  const totalUnread = useMemo(
    () => filtered.reduce((sum, t) => sum + unreadFor(t.id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, seenCounts, countMap],
  );

  const selectedTicket = scopedTickets.find((t) => t.id === selectedId) ?? null;

  useEffect(() => { onUnreadChange?.(totalUnread); }, [totalUnread, onUnreadChange]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Ticket list panel ── */}
      <div className={cn(
        'flex flex-col border-r bg-background flex-shrink-0',
        'w-full md:w-80 lg:w-96',
        // On mobile: hide list when a ticket is open
        selectedTicket ? 'hidden md:flex' : 'flex',
      )}>
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-base">Chat</h1>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 gap-1">
                <Bell className="h-2.5 w-2.5" />
                {totalUnread}
              </Badge>
            )}
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b flex-shrink-0">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets…"
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <p className="text-sm">{isLoading ? 'Loading…' : 'No tickets found.'}</p>
            </div>
          ) : (
            sorted.map((t) => (
              <TicketListItem
                key={t.id}
                ticket={t}
                isSelected={t.id === selectedId}
                unreadCount={unreadFor(t.id)}
                lastMessageAt={lastMsgMap[t.id]}
                onClick={() => handleSelect(t.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Conversation panel ── */}
      <div className={cn(
        'flex-1 min-w-0',
        selectedTicket ? 'flex flex-col' : 'hidden md:flex md:flex-col',
      )}>
        {selectedTicket ? (
          <ConversationPanel
            key={selectedTicket.id}
            ticket={selectedTicket}
            currentUser={user ? { name: user.name, role: user.role } : null}
            onClose={() => setSelectedId(null)}
            onMessagesLoaded={handleMessagesLoaded}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a ticket to view the conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
