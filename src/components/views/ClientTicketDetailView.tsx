import { useState, useRef, type ChangeEvent } from 'react';
import { ArrowLeft, Paperclip, Send, Clock, User, Monitor, Tag, CheckCircle2, AlertCircle, Pencil, RotateCcw } from 'lucide-react';
import { AttachmentView } from '@/components/ui/FilePreview';
import { EditTicketDialog } from '@/components/client/EditTicketDialog';
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

function bumpSeenCount(ticketId: string) {
  try {
    const seen: Record<string, number> = JSON.parse(localStorage.getItem('chat_seen_counts_v1') ?? '{}');
    if (ticketId in seen) {
      localStorage.setItem('chat_seen_counts_v1', JSON.stringify({ ...seen, [ticketId]: seen[ticketId] + 1 }));
    }
  } catch {}
}

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

  const [editOpen, setEditOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [reopenNote, setReopenNote] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_ATTACHMENT_TYPES = [
    'image/png',
    'image/jpeg',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];

  const addChatFiles = (files: FileList | null) => {
    if (!files?.length) return;

    const newFiles = Array.from(files);
    const invalid = newFiles.some((file) => {
      const name = file.name.toLowerCase();
      const ext = name.slice(name.lastIndexOf('.'));
      const isAllowedByExtension = ['.png', '.jpg', '.jpeg', '.pdf', '.csv', '.xls', '.xlsx', '.txt', '.log'].includes(ext);
      return file.size > MAX_ATTACHMENT_SIZE || (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type) && !isAllowedByExtension);
    });

    if (invalid) {
      setUploadError('Only PNG, JPG, PDF, CSV, XLS, XLSX, TXT and LOG files under 10MB are allowed.');
      return;
    }

    setUploadError('');
    setChatFiles((prev) => [...prev, ...newFiles]);
  };

  const handleReopen = async () => {
    if (!ticket || !reopenNote.trim()) return;
    setIsReopening(true);
    setReopenError('');
    try {
      await api.reopenTicket(ticket.id, reopenNote.trim());
      setReopenOpen(false);
      setReopenNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]);
    } catch (err) {
      setReopenError(err instanceof Error ? err.message : 'Failed to reopen ticket.');
    } finally {
      setIsReopening(false);
    }
  };

  // Clients never see internal notes
  const visibleMessages = messages.filter((m) => !m.isInternal);

  const handleSend = async () => {
    if (!replyText.trim() || !ticket) return;

    setIsSending(true);
    setSendError('');
    try {
      const attachmentsPayload = await Promise.all(
        chatFiles.map((file) => new Promise<{ name: string; size: number; type: string; content: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, size: file.size, type: file.type, content: e.target?.result as string });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      await api.sendMessage(ticket.id, {
        content: replyText,
        isInternal: false,
        role: 'client',
        author: user?.name,
        attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
      });
      bumpSeenCount(ticket.id);
      setReplyText('');
      setChatFiles([]);
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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <h1 className="text-lg font-bold text-foreground truncate">{ticket.title}</h1>
            {ticket.isEdited && (
              <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/25">
                Edited
              </span>
            )}
          </div>
        </div>
        {(ticket.status === 'Open' || ticket.status === 'Pending Client') && (
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit Ticket
          </Button>
        )}
      </div>
      <EditTicketDialog ticket={ticket} open={editOpen} onClose={() => setEditOpen(false)} />

      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Panel */}
        <div className="md:w-72 w-full border-b md:border-b-0 md:border-r border-border bg-surface p-5 shrink-0 space-y-5 overflow-y-auto md:min-h-0 scrollbar-thin">
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
                    <AttachmentView att={att} className="text-xs text-primary hover:underline shrink-0" />
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

        {/* Right Panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {ticket.resolutionNote && (ticket.status === 'Resolved' || ticket.status === 'Closed') ? (
            /* Resolution Panel */
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-8 scrollbar-thin">
              {/* Hero */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="h-16 w-16 rounded-full bg-success/15 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {ticket.status === 'Closed' ? 'Ticket Closed' : 'Issue Resolved'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {ticket.status === 'Closed'
                    ? 'This ticket has been closed by the support team.'
                    : 'The Inorins support team has resolved your issue.'}
                </p>
                {ticket.resolvedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(ticket.resolvedAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}
                  </p>
                )}
              </div>

              {/* Resolution cards */}
              <div className="max-w-2xl w-full mx-auto space-y-4">
                <div className="rounded-xl bg-success/8 border border-success/25 p-6">
                  <p className="text-xs font-semibold text-success uppercase tracking-wider mb-2">Resolution Summary</p>
                  <p className="text-sm text-foreground leading-relaxed">{ticket.resolutionNote.summary}</p>
                </div>

                {ticket.resolutionNote.cause && (
                  <div className="rounded-xl bg-card border border-border p-6">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Root Cause</p>
                    <p className="text-sm text-foreground leading-relaxed">{ticket.resolutionNote.cause}</p>
                  </div>
                )}

                {ticket.resolutionNote.preventionSteps && (
                  <div className="rounded-xl bg-card border border-border p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">How to Prevent This</p>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{ticket.resolutionNote.preventionSteps}</p>
                  </div>
                )}

                {ticket.resolutionNote.attachments?.length ? (
                  <div className="rounded-xl bg-card border border-border p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resolution Attachments</p>
                    </div>
                    <div className="space-y-2">
                      {ticket.resolutionNote.attachments.map((att) => (
                        <div key={att.name} className="flex items-center gap-2.5 p-2.5 bg-surface rounded-lg border border-border">
                          <Paperclip className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{att.name}</span>
                          <AttachmentView att={att} className="text-xs text-primary hover:underline shrink-0 font-medium" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="pt-2 text-center space-y-3">
                  <p className="text-xs text-muted-foreground">Need more help with this issue?</p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => navigate('/client/tickets/new')}>
                      Open a New Ticket
                    </Button>
                    {ticket.status === 'Resolved' && (
                      <Button variant="outline" size="sm" className="gap-1.5 border-warning/40 text-warning hover:bg-warning/10" onClick={() => setReopenOpen(true)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Issue Still Persists? Reopen
                      </Button>
                    )}
                  </div>

                  {/* Reopen dialog */}
                  {reopenOpen && (
                    <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-5 text-left max-w-lg mx-auto">
                      <p className="text-sm font-semibold text-warning mb-1">Reopen this ticket</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Please describe why you are reopening this ticket. The support team will be notified.
                      </p>
                      <textarea
                        className="w-full rounded-md border border-border bg-background text-sm p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                        rows={3}
                        placeholder="Reason for reopening…"
                        value={reopenNote}
                        onChange={(e) => setReopenNote(e.target.value)}
                      />
                      {reopenError && <p className="text-xs text-destructive mt-1">{reopenError}</p>}
                      <div className="flex gap-2 mt-3 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setReopenOpen(false); setReopenNote(''); setReopenError(''); }}>
                          Cancel
                        </Button>
                        <Button size="sm" className="gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90" onClick={handleReopen} disabled={isReopening || !reopenNote.trim()}>
                          <RotateCcw className="h-3.5 w-3.5" />
                          {isReopening ? 'Reopening…' : 'Reopen Ticket'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Chat Panel */
            <>
              <div className="px-5 py-3 border-b border-border bg-card shrink-0">
                <h3 className="text-sm font-semibold text-foreground">Support Conversation</h3>
                <p className="text-xs text-muted-foreground">Messages between you and the Inorins support team</p>
              </div>

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
                          {msg.attachments?.length ? (
                            <div className="mt-2 space-y-1">
                              {msg.attachments.map((att) => (
                                <div key={att.name} className="space-y-1">
                                  <div className="flex items-center gap-2 rounded-md bg-black/10 px-2 py-1.5">
                                    <Paperclip className="h-3 w-3 shrink-0 opacity-70" />
                                    <span className="text-xs truncate flex-1">{att.name}</span>
                                    <AttachmentView att={att} className="text-xs underline shrink-0 opacity-80 hover:opacity-100" />
                                  </div>
                                  {att.url && att.type.startsWith('image/') && (
                                    <img src={att.url} alt={att.name} className="max-h-48 w-full object-contain rounded-md border border-black/10" />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <p className={cn('text-[10px] text-muted-foreground mt-1', isMe ? 'text-right' : '')}>
                          {msg.timestamp}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {ticket.status !== 'Closed' && (
                <div
                  className="border-t border-border p-4 shrink-0 bg-card transition-colors"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/40', 'ring-inset'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-primary/40', 'ring-inset'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('ring-2', 'ring-primary/40', 'ring-inset');
                    const files = Array.from(e.dataTransfer.files).filter((f) => f.size <= 10 * 1024 * 1024);
                    if (files.length) setChatFiles((prev) => [...prev, ...files]);
                  }}
                >
                  {sendError ? <p className="text-xs text-destructive mb-2">{sendError}</p> : null}
                  {uploadError ? <p className="text-xs text-destructive mb-2">{uploadError}</p> : null}
                  {chatFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {chatFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-muted/60 rounded px-2 py-1 text-xs">
                          <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[160px] text-foreground">{file.name}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => setChatFiles((prev) => prev.filter((_, i) => i !== idx))}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={chatFileInputRef}
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.pdf,.csv,.xls,.xlsx,.txt,.log"
                    className="hidden"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      addChatFiles(e.target.files);
                      if (e.target) {
                        e.target.value = '';
                      }
                    }}
                  />
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
                    <div className="flex flex-col gap-1.5 self-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="shrink-0 h-10 w-10"
                        onClick={() => chatFileInputRef.current?.click()}
                        title="Attach file"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="shrink-0 h-10 w-10"
                        onClick={handleSend}
                        disabled={isSending || !replyText.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
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
            </>
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
