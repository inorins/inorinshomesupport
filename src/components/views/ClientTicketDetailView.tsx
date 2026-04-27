import { useState } from 'react';
import { ArrowLeft, Paperclip, Send, Clock, User, Monitor, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useTicket, useTicketMessages } from '@/hooks/useTicketsData';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Priority, TicketStatus } from '@/data/mockData';

interface ClientTicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

const priorityStyles: Record<Priority, string> = {
  Critical: 'bg-primary/10 text-primary border-primary/20',
  High: 'bg-warning/10 text-warning border-warning/20',
  Medium: 'bg-info/10 text-info border-info/20',
  Low: 'bg-muted text-muted-foreground border-border',
};

const statusStyles: Record<TicketStatus, string> = {
  Open: 'bg-primary/10 text-primary border-primary/20',
  'In Progress': 'bg-info/10 text-info border-info/20',
  'Pending Client': 'bg-warning/10 text-warning border-warning/20',
  Resolved: 'bg-success/10 text-success border-success/20',
  Closed: 'bg-muted text-muted-foreground border-border',
};

export function ClientTicketDetailView({ ticketId, onBack }: ClientTicketDetailViewProps) {
  const { ticket, isLoading: ticketLoading } = useTicket(ticketId);
  const { messages, isLoading: msgsLoading } = useTicketMessages(ticketId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Clients never see internal notes
  const visibleMessages = messages.filter((m) => !m.isInternal);

  const handleSend = async () => {
    if (!replyText.trim() || !ticket) return;

    setIsSending(true);
    setSendError('');
    try {
      await api.sendMessage(ticket.id, {
        content: replyText,
        isInternal: false,
        role: 'client',
        author: user?.name,
      });
      setReplyText('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
      ]);
    } catch {
      setSendError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (ticketLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Loading ticket…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Ticket not found.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-4 bg-card shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-md hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-bold text-secondary">{ticket.id}</span>
            <Badge className={priorityStyles[ticket.priority]}>{ticket.priority}</Badge>
            <Badge className={statusStyles[ticket.status]}>{ticket.status}</Badge>
          </div>
          <h1 className="text-lg font-bold text-foreground mt-1 truncate">{ticket.title}</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel */}
        <div className="w-72 border-r border-border bg-surface p-5 shrink-0 space-y-5 overflow-y-auto min-h-0 scrollbar-thin">
          <Section title="Details">
            <DetailRow icon={Tag} label="System" value={ticket.system} />
            <DetailRow icon={Tag} label="Module" value={ticket.module} />
            {ticket.moduleDetails ? <DetailRow icon={Tag} label="Module Notes" value={ticket.moduleDetails} /> : null}
            <DetailRow icon={Monitor} label="Environment" value={ticket.environment} highlight={ticket.environment === 'Production'} />
            <DetailRow icon={Clock} label="Created" value={new Date(ticket.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })} />
            <DetailRow icon={User} label="Assignee" value={ticket.assignee || 'Awaiting assignment'} />
            {ticket?.requestType ? <DetailRow icon={Tag} label="Request Type" value={ticket?.requestType} /> : null}
            {ticket?.requestedDelivery ? <DetailRow icon={Tag} label="Delivery" value={ticket?.requestedDelivery} /> : null}
          </Section>

          <Section title="Description">
            <p className="text-sm text-foreground leading-relaxed">{ticket.description}</p>
          </Section>

          <Section title="Attachments">
            {ticket.attachments?.length ? (
              <div className="space-y-2">
                {ticket.attachments.map((att) => (
                  <div key={att.name} className="flex items-center gap-2 p-2.5 bg-card rounded-md border border-border">
                    <Paperclip className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground truncate flex-1">{att.name}</span>
                    {att.url ? (
                      <a href={att.url} target="_blank" rel="noreferrer" download={att.name} className="text-xs text-primary hover:underline shrink-0">View</a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No attachments.</p>
            )}
          </Section>

          {ticket.status === 'Pending Client' && (
            <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
              <p className="text-xs font-semibold text-warning mb-1">Action Required</p>
              <p className="text-xs text-foreground">
                The Inorins team is waiting for your response. Please reply below.
              </p>
            </div>
          )}
        </div>

        {/* Right Panel - Chat */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-card shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Support Conversation</h3>
            <p className="text-xs text-muted-foreground">Messages between you and the Inorins support team</p>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 scrollbar-thin">
            {msgsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn('max-w-[80%] space-y-2', i % 2 === 0 ? '' : 'ml-auto')}>
                  <div className="h-16 bg-muted rounded-lg animate-pulse" />
                </div>
              ))
            ) : visibleMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <p className="text-sm text-muted-foreground">No messages yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Send a message to start the conversation.</p>
              </div>
            ) : (
              visibleMessages.map((msg) => {
                const isMe = msg.role === 'client';
                return (
                  <div key={msg.id} className={cn('max-w-[80%]', isMe ? 'ml-auto' : '')}>
                    <div
                      className={cn(
                        'rounded-lg px-4 py-3 text-sm',
                        isMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface border border-border text-foreground'
                      )}
                    >
                      <p className={cn('text-xs font-semibold mb-1', isMe ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                        {isMe ? (user?.name ?? msg.author) : `Inorins Support · ${msg.author}`}
                      </p>
                      <p className="leading-relaxed">{msg.content}</p>
                    </div>
                    <p className={cn('text-[10px] text-muted-foreground mt-1', isMe ? 'text-right' : '')}>
                      {msg.timestamp}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply box */}
          {ticket.status !== 'Closed' && (
            <div className="border-t border-border p-4 shrink-0 bg-card">
              {sendError ? (
              <p className="text-xs text-destructive mb-2">{sendError}</p>
            ) : null}
            <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message to the support team…"
                  rows={2}
                  className="flex-1 resize-none text-sm"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
                  }}
                />
                <Button
                  size="icon"
                  className="self-end shrink-0 h-10 w-10"
                  onClick={handleSend}
                  disabled={isSending || !replyText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Press Ctrl+Enter to send</p>
            </div>
          )}

          {ticket.status === 'Closed' && (
            <div className="border-t border-border p-4 shrink-0 bg-surface">
              <p className="text-xs text-center text-muted-foreground">
                This ticket is closed. <button className="text-primary hover:underline" onClick={() => navigate('/client/tickets/new')}>Open a new ticket</button> if you need further assistance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, highlight }: { icon: React.ElementType; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <span className={cn('text-xs font-medium', highlight ? 'text-primary' : 'text-foreground')}>{value}</span>
    </div>
  );
}
