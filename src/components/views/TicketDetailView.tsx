import { useState } from 'react';
import {
  ArrowLeft, Paperclip, Send, Eye, EyeOff, Clock, User, Monitor, Tag, Phone, Briefcase, CheckCircle2, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTicket, useTicketMessages } from '@/hooks/useTicketsData';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import type { Priority, TicketStatus } from '@/data/mockData';

interface TicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

const TEAM_MEMBERS = ['Gaurav Shrestha', 'Sujan Prajapati', 'Maheshwor Prajapati', 'Ramendra Pradhananga', 'Unassigned'];

const STATUS_OPTIONS: TicketStatus[] = ['Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed'];

const priorityStyles: Record<Priority, string> = {
  Critical: 'bg-primary/10 text-primary border-primary/20',
  High: 'bg-warning/10 text-warning border-warning/20',
  Medium: 'bg-info/10 text-info border-info/20',
  Low: 'bg-muted text-muted-foreground border-border',
};

const requestTypeStyles: Record<'Issue' | 'Add Form' | 'Add Report', string> = {
  Issue: 'bg-warning/10 text-warning border-warning/20',
  'Add Form': 'bg-info/10 text-info border-info/20',
  'Add Report': 'bg-primary/10 text-primary border-primary/20',
};

const statusStyles: Record<TicketStatus, string> = {
  Open: 'bg-primary/10 text-primary border-primary/20',
  'In Progress': 'bg-info/10 text-info border-info/20',
  'Pending Client': 'bg-warning/10 text-warning border-warning/20',
  Resolved: 'bg-success/10 text-success border-success/20',
  Closed: 'bg-muted text-muted-foreground border-border',
};

function deriveBankName(bankName: string | undefined, reporterEmail: string) {
  if (bankName?.trim()) return bankName;
  const email = String(reporterEmail ?? '').toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';
  const map: Record<string, string> = {
    'guheshwori.com.np': 'Guheshwori',
    'reliancebank.com.np': 'Reliance',
    'progressivebank.com.np': 'Progressive',
    'ganapatibank.com.np': 'Ganapati',
    'goodwillbank.com.np': 'Goodwill',
    'shreefinance.com.np': 'Shree Finance',
  };
  return map[domain] ?? 'Inorins';
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function TicketDetailView({ ticketId, onBack }: TicketDetailViewProps) {
  const { ticket, isLoading: ticketLoading } = useTicket(ticketId);
  const { messages, isLoading: msgsLoading } = useTicketMessages(ticketId);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [isInternal, setIsInternal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const [currentStatus, setCurrentStatus] = useState<TicketStatus | ''>('');
  const [currentAssignee, setCurrentAssignee] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);

  const [resolutionSummary, setResolutionSummary] = useState('');
  const [resolutionCause, setResolutionCause] = useState('');
  const [resolutionPrevention, setResolutionPrevention] = useState('');
  const [resolveError, setResolveError] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const displayStatus = (currentStatus || ticket?.status) as TicketStatus;
  const displayAssignee = currentAssignee || ticket?.assignee || 'Unassigned';
  const displayRequestType = (ticket?.requestType ?? 'Issue') as 'Issue' | 'Add Form' | 'Add Report';
  const isLocked = displayStatus === 'Resolved' || displayStatus === 'Closed';

  const applyStatusChange = async (status: TicketStatus) => {
    setCurrentStatus(status);
    if (!ticket) return;
    setIsUpdating(true);
    try {
      await api.updateTicketStatus(ticket.id, status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['stats'] }),
      ]);
    } catch {
      setCurrentStatus(ticket.status);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = (status: string) => {
    const next = status as TicketStatus;
    if (next === 'Resolved' || next === 'Closed') {
      setPendingStatus(next);
    } else {
      applyStatusChange(next);
    }
  };

  const handleAssigneeChange = async (assignee: string) => {
    setCurrentAssignee(assignee);
    if (!ticket) return;

    setIsUpdating(true);
    try {
      await api.assignTicket(ticket.id, assignee === 'Unassigned' ? '' : assignee);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
      ]);
    } catch {
      setCurrentAssignee(ticket.assignee ?? '');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSend = async () => {
    if (!replyText.trim() || !ticket) return;

    setIsSending(true);
    setSendError('');
    try {
      await api.sendMessage(ticket.id, {
        content: replyText,
        isInternal,
        author: user?.name,
        role: user?.role === 'client' ? 'client' : 'employee',
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

  const handleResolveConfirm = async () => {
    if (!pendingStatus || !ticket || !resolutionSummary.trim()) return;
    setIsResolving(true);
    setResolveError('');
    try {
      await api.resolveTicket(ticket.id, pendingStatus as 'Resolved' | 'Closed', {
        summary: resolutionSummary.trim(),
        cause: resolutionCause.trim() || undefined,
        preventionSteps: resolutionPrevention.trim() || undefined,
      });
      setCurrentStatus(pendingStatus);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['stats'] }),
      ]);
      // Close dialog only after success
      setPendingStatus(null);
      setResolutionSummary('');
      setResolutionCause('');
      setResolutionPrevention('');
    } catch {
      setResolveError('Failed to save resolution. Please try again.');
    } finally {
      setIsResolving(false);
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
            <Badge className={requestTypeStyles[displayRequestType]}>{displayRequestType}</Badge>
            <Badge className={priorityStyles[ticket.priority]}>{ticket.priority}</Badge>
            <Badge className={statusStyles[displayStatus]}>{displayStatus}</Badge>
            {isUpdating && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
          </div>
          <h1 className="text-lg font-bold text-foreground mt-1 truncate">{ticket.title}</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel - Details */}
        <div className="w-80 border-r border-border bg-surface p-5 shrink-0 space-y-5 overflow-y-auto min-h-0 scrollbar-thin">
          <Section title="Reporter">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{ticket.reporter}</p>
                <p className="text-xs text-muted-foreground">{ticket.reporterEmail}</p>
              </div>
            </div>
          </Section>

          <Section title="Contact Person">
            {ticket.contactName || ticket.contactDesignation || ticket.contactPhone ? (
              <div className="rounded-md bg-card border border-border p-3 space-y-2">
                {ticket.contactName && (
                  <div className="flex items-center gap-2.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground">{ticket.contactName}</span>
                  </div>
                )}
                {ticket.contactDesignation && (
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{ticket.contactDesignation}</span>
                  </div>
                )}
                {ticket.contactPhone && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a href={`tel:${ticket.contactPhone}`} className="text-sm text-primary hover:underline">{ticket.contactPhone}</a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No contact details provided.</p>
            )}
          </Section>

          <Section title="Details">
            <DetailRow icon={Tag} label="System" value={ticket.system} />
            <DetailRow icon={Tag} label="Bank" value={deriveBankName(ticket.bankName, ticket.reporterEmail)} />
            <DetailRow icon={Tag} label="Module" value={ticket.module} />
            {ticket.moduleDetails ? <DetailRow icon={Tag} label="Module Notes" value={ticket.moduleDetails} /> : null}
            <DetailRow icon={Tag} label="Form" value={ticket.form} />
            <DetailRow icon={Tag} label="Request Type" value={displayRequestType} />
            {ticket.requestedDelivery ? <DetailRow icon={Tag} label="Delivery" value={ticket.requestedDelivery} /> : null}
            <DetailRow icon={Clock} label="Created" value={new Date(ticket.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })} />
          </Section>

          {/* Time Tracking */}
          {(ticket.startedAt || ticket.resolvedAt) && (
            <Section title="Time Tracking">
              {ticket.startedAt && (
                <DetailRow icon={Timer} label="Started" value={new Date(ticket.startedAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })} />
              )}
              {ticket.resolvedAt && (
                <DetailRow icon={CheckCircle2} label="Resolved" value={new Date(ticket.resolvedAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })} />
              )}
              {ticket.startedAt && ticket.resolvedAt && (
                <DetailRow icon={Clock} label="Total Duration" value={formatDuration(new Date(ticket.resolvedAt).getTime() - new Date(ticket.startedAt).getTime())} highlight />
              )}
            </Section>
          )}

          {/* Resolution Note (staff view) */}
          {ticket.resolutionNote && (
            <Section title="Resolution Note Sent">
              <div className="rounded-md bg-success/10 border border-success/20 p-3 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Summary</p>
                  <p className="text-xs text-foreground leading-relaxed">{ticket.resolutionNote.summary}</p>
                </div>
                {ticket.resolutionNote.cause && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Root Cause</p>
                    <p className="text-xs text-foreground leading-relaxed">{ticket.resolutionNote.cause}</p>
                  </div>
                )}
                {ticket.resolutionNote.preventionSteps && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Prevention Steps</p>
                    <p className="text-xs text-foreground leading-relaxed">{ticket.resolutionNote.preventionSteps}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Editable Status */}
          <Section title="Status">
            {isLocked ? (
              <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/50 text-xs text-muted-foreground">
                <span className="flex-1">{displayStatus}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide">Locked</span>
              </div>
            ) : (
              <Select value={displayStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Section>

          {/* Editable Assignee */}
          <Section title="Assignee">
            {isLocked ? (
              <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/50 text-xs text-muted-foreground">
                <span className="flex-1">{displayAssignee}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide">Locked</span>
              </div>
            ) : (
              <Select value={displayAssignee} onValueChange={handleAssigneeChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_MEMBERS.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Section>

          <Section title="Description">
            <p className="text-sm text-foreground leading-relaxed">{ticket.description}</p>
          </Section>

          <Section title="Attachments">
            {ticket.attachments?.length ? (
              <div className="space-y-4">
                {ticket.attachments.map((attachment) => (
                  <div key={attachment.name} className="space-y-2 p-3 bg-card rounded-md border border-border">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">{(attachment.size / 1024).toFixed(1)} KB</p>
                      </div>
                      {attachment.url ? (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          download={attachment.name}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </a>
                      ) : null}
                    </div>
                    {attachment.url && attachment.type.startsWith('image/') ? (
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="w-full max-h-48 object-contain rounded-md border border-border"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No attachments added.</p>
            )}
          </Section>
        </div>

        {/* Right Panel - Chat */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-card shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Communication Timeline</h3>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 scrollbar-thin">
            {msgsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn('max-w-[80%] space-y-2', i % 2 === 0 ? '' : 'ml-auto')}>
                  <div className="h-16 bg-muted rounded-lg animate-pulse" />
                </div>
              ))
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={cn('max-w-[80%]', msg.role === 'employee' ? 'ml-auto' : '')}>
                  {msg.isInternal && (
                    <div className="flex items-center gap-1.5 mb-1 justify-end">
                      <EyeOff className="h-3 w-3 text-warning" />
                      <span className="text-[10px] font-semibold text-warning uppercase tracking-wider">Internal Note</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-lg px-4 py-3 text-sm',
                      msg.isInternal
                        ? 'bg-[hsl(var(--internal-note))] border border-warning/30'
                        : msg.role === 'employee'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-surface border border-border text-foreground'
                    )}
                  >
                    <p className={cn('text-xs font-semibold mb-1', msg.isInternal ? 'text-foreground' : msg.role === 'employee' ? 'text-secondary-foreground/80' : 'text-muted-foreground')}>
                      {msg.author}
                    </p>
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                  <p className={cn('text-[10px] text-muted-foreground mt-1', msg.role === 'employee' ? 'text-right' : '')}>
                    {msg.timestamp}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className={cn('border-t border-border p-4 shrink-0 transition-colors', isInternal ? 'bg-[hsl(var(--internal-note))]' : 'bg-card')}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Switch checked={isInternal} onCheckedChange={setIsInternal} />
                <span className={cn('text-sm font-semibold flex items-center gap-1.5', isInternal ? 'text-warning' : 'text-muted-foreground')}>
                  {isInternal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  Internal Note Only (Hidden from Client)
                </span>
              </div>
            </div>
            {sendError ? (
              <p className="text-xs text-destructive mb-2">{sendError}</p>
            ) : null}
            <div className="flex gap-2">
              <Textarea
                placeholder={isInternal ? 'Write an internal note…' : 'Type your reply to the client…'}
                rows={2}
                className={cn('flex-1 resize-none text-sm', isInternal ? 'border-warning/40 bg-card' : '')}
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
        </div>
      </div>

      <AlertDialog open={!!pendingStatus} onOpenChange={(open) => {
        if (!open && !isResolving) {
          setPendingStatus(null);
          setResolutionSummary('');
          setResolutionCause('');
          setResolutionPrevention('');
          setResolveError('');
        }
      }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark ticket as {pendingStatus}</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a resolution note — this will be shown to the client as a final notification. The status cannot be changed afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                What was done to resolve this <span className="text-primary">*</span>
              </label>
              <Textarea
                placeholder="Describe what was done to resolve this issue…"
                rows={3}
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Root cause <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="What caused this issue?"
                rows={2}
                value={resolutionCause}
                onChange={(e) => setResolutionCause(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Prevention steps <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Steps the client should take to avoid this in future…"
                rows={2}
                value={resolutionPrevention}
                onChange={(e) => setResolutionPrevention(e.target.value)}
              />
            </div>
          </div>
          {resolveError && (
            <p className="text-xs text-destructive -mt-1">{resolveError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResolving}>Cancel</AlertDialogCancel>
            <Button
              disabled={!resolutionSummary.trim() || isResolving}
              onClick={handleResolveConfirm}
            >
              {isResolving ? 'Saving…' : 'Confirm & Notify Client'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
