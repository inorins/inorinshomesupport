import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Paperclip, Send, Eye, EyeOff, Clock, User, Monitor, Tag, Phone, Briefcase, CheckCircle2, Timer, CornerUpRight, Mail, ExternalLink, Link2, Unlink, Plus,
  UserCheck, RotateCcw, MessageSquare, Bell, BellOff, FileDown,
} from 'lucide-react';
import { AttachmentView } from '@/components/ui/FilePreview';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useTicket, useTicketMessages } from '@/hooks/useTicketsData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { Priority, Ticket, TicketStatus, TicketLinkEntry, TicketSystemChangeLink, SystemChange } from '@/data/mockData';

// When a staff user sends a message from the ticket detail view, mark that ticket
// as seen in the chat hub so the sent message doesn't appear as a new unread badge.
function bumpSeenCount(ticketId: string) {
  try {
    const seen: Record<string, number> = JSON.parse(localStorage.getItem('chat_seen_counts_v1') ?? '{}');
    if (ticketId in seen) {
      localStorage.setItem('chat_seen_counts_v1', JSON.stringify({ ...seen, [ticketId]: seen[ticketId] + 1 }));
    }
  } catch {}
}

interface TicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

// Removed hardcoded TEAM_MEMBERS — staff list is now fetched from the database

const STATUS_OPTIONS: TicketStatus[] = ['Open', 'In Progress', 'Pending Client', 'Resolved'];

const priorityStyles: Record<Priority, string> = {
  Critical: 'bg-primary/10 text-primary border-primary/20',
  High: 'bg-warning/10 text-warning border-warning/20',
  Medium: 'bg-info/10 text-info border-info/20',
  Low: 'bg-muted text-muted-foreground border-border',
};

const requestTypeStyles: Record<'Issue' | 'Add Form' | 'Add Report' | 'Update' | 'Data Amendment', string> = {
  Issue: 'bg-warning/10 text-warning border-warning/20',
  'Add Form': 'bg-info/10 text-info border-info/20',
  'Add Report': 'bg-primary/10 text-primary border-primary/20',
  Update: 'bg-secondary/10 text-secondary border-secondary/20',
  'Data Amendment': 'bg-success/10 text-success border-success/20',
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

function exportTicketToPDF(ticket: import('@/data/mockData').Ticket, messages: import('@/data/mockData').ChatMessage[], links: import('@/data/mockData').TicketLinkEntry[]) {
  const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' });
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const publicMessages = messages.filter((m) => !m.isInternal);

  const linksHtml = links.length > 0
    ? `<section><h3>Linked Tickets</h3><ul>${links.map((l) => {
        const other = l.primaryTicketId === ticket.id ? l.linkedTicket : l.primaryTicket;
        return `<li><strong>${esc(other.id)}</strong> — ${esc(other.title)} <span class="badge">${l.linkType}</span> <span class="badge">${other.status}</span></li>`;
      }).join('')}</ul></section>`
    : '';

  const resolutionHtml = ticket.resolutionNote
    ? `<section><h3>Resolution Note</h3>
        <p><strong>Summary:</strong> ${esc(ticket.resolutionNote.summary)}</p>
        ${ticket.resolutionNote.cause ? `<p><strong>Root Cause:</strong> ${esc(ticket.resolutionNote.cause)}</p>` : ''}
        ${ticket.resolutionNote.preventionSteps ? `<p><strong>Prevention:</strong> ${esc(ticket.resolutionNote.preventionSteps)}</p>` : ''}
      </section>`
    : '';

  const messagesHtml = publicMessages.length > 0
    ? `<section><h3>Conversation</h3>${publicMessages.map((m) =>
        `<div class="msg ${m.role}">
          <div class="msg-header"><strong>${esc(m.author)}</strong><span>${fmt(m.timestamp)}</span></div>
          <div class="msg-body">${esc(m.content)}</div>
        </div>`
      ).join('')}</section>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Ticket ${esc(ticket.id)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Dosis:wght@400;600;700&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Open Sans', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #f7f7f7; line-height: 1.6; }
  h1, h2, h3, h4 { font-family: 'Dosis', sans-serif; }

  /* ── Top header bar (matches website nav) ── */
  .site-header {
    background: #730606;
    padding: 14px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .site-header img { height: 40px; object-fit: contain; }
  .site-header .header-right { text-align: right; color: rgba(255,255,255,0.85); font-size: 11px; font-family: 'Open Sans', sans-serif; }
  .site-header .header-right strong { display: block; font-size: 13px; color: #fff; margin-bottom: 2px; }

  /* ── Title band ── */
  .title-band {
    background: #2C3A47;
    padding: 20px 40px 18px;
    border-top: 3px solid #730606;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .title-band h1 { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .title-band .subtitle { font-size: 12.5px; color: rgba(255,255,255,0.7); font-family: 'Open Sans', sans-serif; }

  /* ── Body ── */
  .body-wrap { padding: 28px 40px; }

  /* ── Section cards ── */
  section {
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    border-left: 3px solid rgba(115,6,6,0.5);
    padding: 16px 18px;
    margin-bottom: 18px;
  }
  h3 {
    font-family: 'Dosis', sans-serif;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: #730606;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #f0e0e0;
  }

  /* ── Details grid ── */
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 24px; }
  .row { display: flex; gap: 8px; align-items: baseline; }
  .row label { min-width: 130px; color: #6b7280; font-size: 11.5px; flex-shrink: 0; }
  .row span { font-weight: 600; font-size: 12.5px; color: #1a1a1a; }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
    background: #fdf2f2;
    color: #730606;
    border: 1px solid rgba(115,6,6,0.25);
    margin-left: 4px;
    font-family: 'Open Sans', sans-serif;
  }
  .badge.navy { background: #eef1f4; color: #2C3A47; border-color: rgba(44,58,71,0.25); }

  /* ── Description box ── */
  .desc {
    background: #fafafa;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    padding: 12px 14px;
    white-space: pre-wrap;
    font-size: 12.5px;
    line-height: 1.75;
    color: #333;
  }

  /* ── Linked tickets ── */
  ul { padding-left: 0; list-style: none; }
  li { margin-bottom: 6px; padding: 6px 10px; background: #fafafa; border-radius: 4px; border-left: 2px solid #730606; font-size: 12px; }

  /* ── Messages ── */
  .msg { border: 1px solid #ece9e9; border-radius: 4px; padding: 10px 12px; margin-bottom: 10px; }
  .msg.employee { background: #fdf8f8; border-left: 3px solid #730606; }
  .msg.client { background: #f5f7f9; border-left: 3px solid #2C3A47; }
  .msg-header { display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; margin-bottom: 6px; }
  .msg-header strong { color: #730606; font-size: 12px; }
  .msg.client .msg-header strong { color: #2C3A47; }
  .msg-body { white-space: pre-wrap; font-size: 12.5px; line-height: 1.65; }

  /* ── Footer ── */
  .site-footer {
    background: #2C3A47;
    padding: 10px 40px;
    text-align: center;
    font-size: 10.5px;
    color: rgba(255,255,255,0.5);
    font-family: 'Open Sans', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @media print {
    body { background: #fff; }
    .site-header, .title-band, .site-footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- Website-style header -->
<div class="site-header">
  <img src="${window.location.origin}/inorins.png" alt="Inorins Technologies"/>
  <div class="header-right">
    <strong>Support Ticket Export</strong>
    Printed ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}
  </div>
</div>

<!-- Title band -->
<div class="title-band">
  <h1>${esc(ticket.id)} — ${esc(ticket.title)}</h1>
  <div class="subtitle">${esc(ticket.system)} &nbsp;·&nbsp; ${esc(ticket.bankName ?? '')} &nbsp;·&nbsp; ${esc(ticket.module)}</div>
</div>

<div class="body-wrap">

<section>
  <h3>Ticket Details</h3>
  <div class="grid">
    <div class="row"><label>Status</label><span>${esc(ticket.status)}</span></div>
    <div class="row"><label>Priority</label><span>${esc(ticket.priority)}</span></div>
    <div class="row"><label>Environment</label><span>${esc(ticket.environment)}</span></div>
    <div class="row"><label>Request Type</label><span>${esc(ticket.requestType ?? 'Issue')}</span></div>
    <div class="row"><label>Reporter</label><span>${esc(ticket.reporter)} (${esc(ticket.reporterEmail)})</span></div>
    <div class="row"><label>Assignee</label><span>${esc(ticket.assignee ?? 'Unassigned')}</span></div>
    <div class="row"><label>Created</label><span>${fmt(ticket.createdAt)}</span></div>
    <div class="row"><label>Last Updated</label><span>${fmt(ticket.lastUpdated ?? ticket.createdAt)}</span></div>
    ${ticket.resolvedAt ? `<div class="row"><label>Resolved</label><span>${fmt(ticket.resolvedAt)}</span></div>` : ''}
  </div>
</section>

<section>
  <h3>Description</h3>
  <div class="desc">${esc(ticket.description)}</div>
</section>

${resolutionHtml}
${linksHtml}
${messagesHtml}

</div>

<!-- Footer -->
<div class="site-footer">Inorins Technologies Pvt. Ltd. &nbsp;|&nbsp; Confidential Support Record</div>

</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
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
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [currentStatus, setCurrentStatus] = useState<TicketStatus | ''>('');
  const [currentAssignee, setCurrentAssignee] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [assigneeRequiredFor, setAssigneeRequiredFor] = useState<TicketStatus | null>(null);

  const [resolutionSummary, setResolutionSummary] = useState('');
  const [resolutionCause, setResolutionCause] = useState('');
  const [resolutionPrevention, setResolutionPrevention] = useState('');
  const [resolutionFiles, setResolutionFiles] = useState<File[]>([]);
  const [resolveError, setResolveError] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // "Add to System Change" option on resolve
  const [addToSystemChange, setAddToSystemChange] = useState(false);
  const [scTitle, setScTitle] = useState('');
  const [scStatus, setScStatus] = useState<'Not Started' | 'In Progress' | 'Completed'>('Completed');


  const navigate = useNavigate();

  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkType, setLinkType] = useState<'duplicate' | 'related'>('duplicate');
  const [linkNote, setLinkNote] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  const [showCannedReplies, setShowCannedReplies] = useState(false);
  const CANNED_REPLIES = [
    'We have received your ticket and are currently investigating. We will update you shortly.',
    'Could you please provide more details about the issue, including any error messages you see?',
    'We have identified the root cause and are working on a fix. Please expect an update within the next business day.',
    'The fix has been deployed in UAT. Could you please verify from your end?',
    'This has been resolved. Please confirm that the issue is no longer occurring in your environment.',
    'This issue requires access to your production environment. Please arrange remote access at your earliest convenience.',
    'We are coordinating with the development team. We will keep you posted on progress.',
    'Thank you for the additional details. This helps us narrow down the issue significantly.',
  ];

  // System change links
  const [scLinkDialogOpen, setScLinkDialogOpen] = useState(false);
  const [scLinkSearch, setScLinkSearch] = useState('');
  const [scLinkNote, setScLinkNote] = useState('');
  const [isScLinking, setIsScLinking] = useState(false);
  const [scLinkError, setScLinkError] = useState('');

  const { data: ticketLinks = [] } = useQuery<TicketLinkEntry[]>({
    queryKey: ['ticket-links', ticketId],
    queryFn: () => api.getTicketLinks(ticketId),
    enabled: !!ticketId,
  });

  const { data: scLinks = [] } = useQuery<TicketSystemChangeLink[]>({
    queryKey: ['ticket-sc-links', ticketId],
    queryFn: () => api.getTicketSystemChanges(ticketId),
    enabled: !!ticketId,
  });

  const { data: allSystemChanges = [] } = useQuery<SystemChange[]>({
    queryKey: ['system-changes'],
    queryFn: () => api.getSystemChanges(),
    staleTime: 30_000,
  });

  // Live staff list — uses demo-users so any inorins user (not just admin) can see assignees
  const { data: allUsers = [] } = useQuery({
    queryKey: ['demo-users'],
    queryFn: () => api.getDemoUsers(),
    staleTime: 5 * 60 * 1000,
  });
  const staffMembers = allUsers
    .filter((u) => u.role === 'inorins' && u.isActive !== false)
    .map((u) => u.name);
  const assigneeOptions = [...staffMembers, 'Unassigned'];

  const { data: allTickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api.getTickets(),
    enabled: linkDialogOpen,
  });

  // Watchers
  const { data: watchers = [], refetch: refetchWatchers } = useQuery({
    queryKey: ['watchers', ticketId],
    queryFn: () => api.getWatchers(ticketId),
    enabled: !!ticketId && user?.role === 'inorins',
    staleTime: 30_000,
  });
  const isWatching = watchers.some((w) => w.userId === (user as { id?: number } | null)?.id);

  const handleToggleWatch = async () => {
    if (!user) return;
    try {
      if (isWatching) {
        await api.unwatchTicket(ticketId, 'me');
      } else {
        await api.watchTicket(ticketId);
      }
      refetchWatchers();
    } catch { /* ignore */ }
  };

  const handleTakeTicket = async () => {
    if (!user?.name) return;
    await handleAssigneeChange(user.name);
  };

  const alreadyLinkedIds = new Set([
    ticketId,
    ...ticketLinks.map((l) => l.primaryTicketId),
    ...ticketLinks.map((l) => l.linkedTicketId),
  ]);

  const linkSearchResults = linkSearchQuery.trim().length > 0
    ? allTickets.filter((t) => {
        if (alreadyLinkedIds.has(t.id)) return false;
        const q = linkSearchQuery.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.bankName ?? '').toLowerCase().includes(q)
        );
      }).slice(0, 10)
    : [];

  const displayStatus = (currentStatus || ticket?.status) as TicketStatus;
  const displayAssignee = currentAssignee || ticket?.assignee || 'Unassigned';
  const displayRequestType = (ticket?.requestType ?? 'Issue') as 'Issue' | 'Add Form' | 'Add Report' | 'Update' | 'Data Amendment';
  const isLocked = displayStatus === 'Resolved' || displayStatus === 'Closed';

  useEffect(() => {
    if (ticketLoading || !ticket || isLocked) return;
    const id = setTimeout(() => replyTextareaRef.current?.focus(), 80);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, ticketLoading]);

  const applyStatusChange = async (status: TicketStatus) => {
    setCurrentStatus(status);
    if (!ticket) return;
    setIsUpdating(true);
    try {
      await api.updateTicketStatus(ticket.id, status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['ticket-links', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['stats'] }),
      ]);
    } catch {
      setCurrentStatus(ticket.status);
    } finally {
      setIsUpdating(false);
    }
  };

  const isTicketAssigned = displayAssignee !== 'Unassigned' && displayAssignee.trim() !== '';

  const handleStatusChange = (status: string) => {
    const next = status as TicketStatus;
    if (!isTicketAssigned && next !== 'Open') {
      setAssigneeRequiredFor(next);
      return;
    }
    if (next === 'Resolved') {
      setPendingStatus(next);
    } else {
      applyStatusChange(next);
    }
  };

  const handleAssigneeChange = async (assignee: string) => {
    setCurrentAssignee(assignee);
    if (assignee && assignee !== 'Unassigned') setAssigneeRequiredFor(null);
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
        isInternal,
        author: user?.name,
        role: user?.role === 'client' ? 'client' : 'employee',
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

  const handleResolveConfirm = async () => {
    if (!pendingStatus || !ticket || !resolutionSummary.trim()) return;
    setIsResolving(true);
    setResolveError('');
    try {
      const attachmentsPayload = await Promise.all(
        resolutionFiles.map((file) => new Promise<{ name: string; size: number; type: string; content: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, size: file.size, type: file.type, content: e.target?.result as string });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      await api.resolveTicket(ticket.id, pendingStatus as 'Resolved', {
        summary: resolutionSummary.trim(),
        cause: resolutionCause.trim() || undefined,
        preventionSteps: resolutionPrevention.trim() || undefined,
        attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
      });
      // Optionally create a system change entry
      if (addToSystemChange) {
        const title = scTitle.trim() || `[${ticket.id}] ${ticket.title}`;
        await api.createSystemChange({
          title,
          description: resolutionSummary.trim(),
          system: ticket.system,
          module: ticket.module,
          bankName: ticket.bankName,
          status: scStatus,
        }).catch(() => {/* non-fatal */});
        queryClient.invalidateQueries({ queryKey: ['system-changes'] });
      }
      setCurrentStatus(pendingStatus);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['ticket-links', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['stats'] }),
      ]);
      setPendingStatus(null);
      setResolutionSummary('');
      setResolutionCause('');
      setResolutionPrevention('');
      setResolutionFiles([]);
      setAddToSystemChange(false);
      setScTitle('');
      setScStatus('Completed');
    } catch {
      setResolveError('Failed to save resolution. Please try again.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleForwardSend = async () => {
    if (!forwardTo || !ticket) return;
    setIsForwarding(true);
    try {
      await api.forwardTicket(ticket.id, forwardTo, user?.name ?? 'Team', forwardNote.trim() || undefined);
      const content = forwardNote.trim()
        ? `↗ Forwarded to ${forwardTo}\n${forwardNote.trim()}`
        : `↗ Forwarded to ${forwardTo}`;
      await api.sendMessage(ticket.id, {
        content,
        isInternal: true,
        author: user?.name,
        role: 'employee',
      });
      bumpSeenCount(ticket.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]);
      setForwardOpen(false);
      setForwardTo('');
      setForwardNote('');
    } catch {
      // silently fail; user can retry
    } finally {
      setIsForwarding(false);
    }
  };

  const handleClearForward = async () => {
    if (!ticket) return;
    try {
      await api.clearForward(ticket.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]);
    } catch { /* ignore */ }
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
            {ticket.source === 'email' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                <Mail className="h-3 w-3" />
                From Email
              </span>
            )}
            {isUpdating && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <h1 className="text-lg font-bold text-foreground truncate">{ticket.title}</h1>
          
            {ticket.isEdited && (
              <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/25">
                Edited {ticket.editedAt ? `· ${new Date(ticket.editedAt).toLocaleDateString()}` : ''}
              </span>
            )}
            {(ticket.reopenCount ?? 0) > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning/10 text-warning border border-warning/25" title={`Reopened ${ticket.reopenCount} time${ticket.reopenCount !== 1 ? 's' : ''}`}>
                <RotateCcw className="h-2.5 w-2.5" />
                Reopened ×{ticket.reopenCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Take Ticket — one-click self-assign when unassigned */}
          {user?.role === 'inorins' && !isLocked && displayAssignee === 'Unassigned' && (
            <button
              onClick={handleTakeTicket}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              title="Assign this ticket to yourself"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Take Ticket
            </button>
          )}
          {/* Watch / Unwatch */}
          {user?.role === 'inorins' && (
            <button
              onClick={handleToggleWatch}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
                isWatching
                  ? 'bg-info/10 border-info/30 text-info hover:bg-info/20'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title={isWatching ? 'Stop watching this ticket' : 'Watch this ticket for updates'}
            >
              {isWatching ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {isWatching ? 'Watching' : 'Watch'}
              {watchers.length > 0 && <span className="text-[10px] opacity-70">({watchers.length})</span>}
            </button>
          )}
          <button
            onClick={() => setForwardOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Forward to a team member"
          >
            <CornerUpRight className="h-3.5 w-3.5" />
            Forward
          </button>
          <button
            onClick={() => exportTicketToPDF(ticket, messages, ticketLinks)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Export ticket as PDF"
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Panel - Details */}
        <div className="md:w-80 w-full border-b md:border-b-0 md:border-r border-border bg-surface p-5 shrink-0 space-y-5 overflow-y-auto md:min-h-0 scrollbar-thin">

        

          {/* Forwarded banner */}
          {ticket.forwardedTo && (
            <div className={cn(
              'rounded-md border px-3 py-2.5 text-xs',
              user?.name === ticket.forwardedTo
                ? 'bg-info/8 border-info/30'
                : 'bg-muted/60 border-border'
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <CornerUpRight className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', user?.name === ticket.forwardedTo ? 'text-info' : 'text-muted-foreground')} />
                  <div className="min-w-0">
                    {user?.name === ticket.forwardedTo ? (
                      <p className="font-semibold text-info">Forwarded to you</p>
                    ) : (
                      <p className="font-semibold text-foreground">Forwarded to {ticket.forwardedTo}</p>
                    )}
                    <p className="text-muted-foreground mt-0.5">by {ticket.forwardedBy}</p>
                    {ticket.forwardNote && (
                      <p className="mt-1.5 text-foreground leading-relaxed">{ticket.forwardNote}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClearForward}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                  title="Clear forward"
                >✕</button>
              </div>
            </div>
          )}

          <Section title="Reporter">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{ticket.reporter}</p>
                <p className="text-xs text-muted-foreground">{ticket.reporterEmail}</p>
              </div>
            </div>
            {ticket.source === 'email' && (() => {
              const rawId = ticket.sourceMessageId?.replace(/^<|>$/g, '') ?? '';
              const gmailUrl = rawId
                ? `https://mail.google.com/mail/#search/rfc822msgid:${encodeURIComponent(rawId)}`
                : `https://mail.google.com/mail/`;
              return (
                <a
                  href={gmailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <Mail className="h-3 w-3" />
                  View original email in Gmail
                  <ExternalLink className="h-3 w-3" />
                </a>
              );
            })()}
          </Section>

          <Section title="Contact Person">
            {ticket.contactName || ticket.contactDesignation || ticket.contactPhone || ticket.contactEmail ? (
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
                {ticket.contactEmail && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a href={`mailto:${ticket.contactEmail}`} className="text-sm text-primary hover:underline">{ticket.contactEmail}</a>
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
            {ticket.requestedDelivery && ticket.requestType !== 'Issue' ? <DetailRow icon={Tag} label="Delivery" value={ticket.requestedDelivery} /> : null}
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
                {ticket.resolutionNote.attachments?.length ? (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Attachments</p>
                    <div className="space-y-1">
                      {ticket.resolutionNote.attachments.map((att) => (
                        <div key={att.name} className="flex items-center gap-2">
                          <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-xs text-foreground truncate flex-1">{att.name}</span>
                          <AttachmentView att={att} className="text-xs text-primary hover:underline shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
              <>
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
                {assigneeRequiredFor && (
                  <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning font-medium">
                    Assign this ticket to a team member before setting it to &ldquo;{assigneeRequiredFor}&rdquo;.
                    <button
                      className="ml-2 text-[10px] underline opacity-70 hover:opacity-100"
                      onClick={() => setAssigneeRequiredFor(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </>
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
                  {assigneeOptions.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Section>

          {/* Watchers */}
          {user?.role === 'inorins' && watchers.length > 0 && (
            <Section title={`Watchers (${watchers.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {watchers.map((w) => (
                  <div key={w.id} className="flex items-center gap-1.5 bg-card border border-border rounded-md px-2 py-1">
                    <span className="text-xs font-medium text-foreground">{w.userName}</span>
                    {w.userId === (user as { id?: number } | null)?.id && (
                      <button
                        onClick={handleToggleWatch}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Stop watching"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

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
                      <AttachmentView att={attachment} className="text-xs text-primary hover:underline ml-auto" />
                    </div>
                    {attachment.url && attachment.type?.startsWith('image/') ? (
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

          {/* Linked Tickets — always show if any links exist, allow management when not locked */}
          {(ticketLinks.length > 0 || !isLocked) && (
            <Section title={`Linked Tickets${ticketLinks.length > 0 ? ` (${ticketLinks.length})` : ''}`}>
              <div className="space-y-2">
                {ticketLinks.map((link) => {
                  const other = link.primaryTicketId === ticketId ? link.linkedTicket : link.primaryTicket;
                  const otherStatus = other.status as TicketStatus;
                  const isDup = link.linkType === 'duplicate';
                  return (
                    <div key={link.id} className={cn('flex items-start gap-2 p-2 rounded-md border bg-card', isDup ? 'border-primary/20' : 'border-border')}>
                      <Link2 className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isDup ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => navigate(`/staff/tickets/${other.id}`)}
                            className="text-xs font-mono text-secondary hover:underline font-semibold"
                          >
                            {other.id}
                          </button>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', isDup ? 'bg-primary/10 text-primary border-primary/20' : 'bg-info/10 text-info border-info/20')}>
                            {link.linkType}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', statusStyles[otherStatus])}>
                            {otherStatus}
                          </span>
                        </div>
                        <p className="text-xs text-foreground truncate mt-0.5">{other.title}</p>
                        {other.bankName && <p className="text-[10px] text-muted-foreground">{other.bankName}</p>}
                        {link.note && <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">{link.note}</p>}
                      </div>
                      {!isLocked && (
                        <button
                          onClick={async () => {
                            await api.deleteTicketLink(ticketId, link.id);
                            queryClient.invalidateQueries({ queryKey: ['ticket-links', ticketId] });
                          }}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          title="Remove link"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {!isLocked && (
                  <button
                    onClick={() => { setLinkDialogOpen(true); setLinkError(''); setLinkTargetId(''); setLinkNote(''); setLinkType('duplicate'); }}
                    className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-3 py-2 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Link another ticket
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* System Changes — always visible to staff */}
          {user?.role === 'inorins' && (
            <Section title={`System Changes${scLinks.length > 0 ? ` (${scLinks.length})` : ''}`}>
              <div className="space-y-2">
                {scLinks.map((link) => {
                  const sc = link.change!;
                  const statusColor: Record<string, string> = {
                    'Not Started': 'bg-muted text-muted-foreground border-border',
                    'In Progress': 'bg-info/10 text-info border-info/20',
                    'Completed':   'bg-success/10 text-success border-success/20',
                  };
                  return (
                    <div key={link.id} className="flex items-start gap-2 p-2 rounded-md border bg-card border-secondary/20">
                      <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0 text-secondary" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', statusColor[sc.status] ?? statusColor['Not Started'])}>
                            {sc.status}
                          </span>
                          {sc.system && (
                            <span className="text-[10px] text-muted-foreground">{sc.system}{sc.module ? ` › ${sc.module}` : ''}</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground mt-0.5">{sc.title}</p>
                        {link.note && <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">{link.note}</p>}
                        {link.linkedBy && <p className="text-[10px] text-muted-foreground/50">Linked by {link.linkedBy}</p>}
                      </div>
                      {!isLocked && (
                        <button
                          onClick={async () => {
                            await api.unlinkChangeFromTicket(ticketId, sc.id);
                            queryClient.invalidateQueries({ queryKey: ['ticket-sc-links', ticketId] });
                          }}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          title="Remove link"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {!isLocked && (
                  <button
                    onClick={() => { setScLinkDialogOpen(true); setScLinkSearch(''); setScLinkNote(''); setScLinkError(''); }}
                    className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-3 py-2 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Link to a system change
                  </button>
                )}
              </div>
            </Section>
          )}
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
              messages.map((msg) => {
                const isForwardMsg = msg.isInternal && msg.content.startsWith('↗ Forwarded to ');
                const forwardLines = isForwardMsg ? msg.content.split('\n') : [];
                return (
                <div key={msg.id} className={cn('max-w-[80%]', msg.role === 'employee' ? 'ml-auto' : '')}>
                  {msg.isInternal && !isForwardMsg && (
                    <div className="flex items-center gap-1.5 mb-1 justify-end">
                      <EyeOff className="h-3 w-3 text-warning" />
                      <span className="text-[10px] font-semibold text-warning uppercase tracking-wider">Internal Note</span>
                    </div>
                  )}
                  {isForwardMsg && (
                    <div className="flex items-center gap-1.5 mb-1 justify-end">
                      <CornerUpRight className="h-3 w-3 text-info" />
                      <span className="text-[10px] font-semibold text-info uppercase tracking-wider">Forwarded</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-lg px-4 py-3 text-sm',
                      isForwardMsg
                        ? 'bg-info/8 border border-info/25'
                        : msg.isInternal
                          ? 'bg-[hsl(var(--internal-note))] border border-warning/30'
                          : msg.role === 'employee'
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-surface border border-border text-foreground'
                    )}
                  >
                    <p className={cn('text-xs font-semibold mb-1', isForwardMsg ? 'text-info' : msg.isInternal ? 'text-foreground' : msg.role === 'employee' ? 'text-secondary-foreground/80' : 'text-muted-foreground')}>
                      {msg.author}
                    </p>
                    {isForwardMsg ? (
                      <div>
                        <p className="font-semibold text-foreground">{forwardLines[0]}</p>
                        {forwardLines.length > 1 && (
                          <p className="mt-1 text-muted-foreground leading-relaxed">{forwardLines.slice(1).join('\n')}</p>
                        )}
                      </div>
                    ) : (
                      <p className="leading-relaxed">{msg.content}</p>
                    )}
                    {msg.attachments?.length ? (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map((att) => (
                          <div key={att.name} className="space-y-1">
                            <div className="flex items-center gap-2 rounded-md bg-black/10 px-2 py-1.5">
                              <Paperclip className="h-3 w-3 shrink-0 opacity-70" />
                              <span className="text-xs truncate flex-1">{att.name}</span>
                              {att.url && (
                                <AttachmentView att={att} className="text-xs underline shrink-0 opacity-80 hover:opacity-100" />
                              )}
                            </div>
                            {att.url && att.type.startsWith('image/') && (
                              <img src={att.url} alt={att.name} className="max-h-48 w-full object-contain rounded-md border border-black/10" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <p className={cn('text-[10px] text-muted-foreground mt-1', msg.role === 'employee' ? 'text-right' : '')}>
                    {msg.timestamp}
                  </p>
                </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div
            className={cn('border-t border-border p-4 shrink-0 transition-colors', isInternal ? 'bg-[hsl(var(--internal-note))]' : 'bg-card')}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/40'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-primary/40'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('ring-2', 'ring-primary/40');
              const files = Array.from(e.dataTransfer.files).filter((f) => f.size <= 10 * 1024 * 1024);
              if (files.length) setChatFiles((prev) => [...prev, ...files]);
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Switch checked={isInternal} onCheckedChange={setIsInternal} />
                <span className={cn('text-sm font-semibold flex items-center gap-1.5', isInternal ? 'text-warning' : 'text-muted-foreground')}>
                  {isInternal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  Internal Note Only (Hidden from Client)
                </span>
              </div>
              {/* Canned Replies picker */}
              <div className="relative">
                <button
                  onClick={() => setShowCannedReplies((p) => !p)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Insert a canned reply"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Canned
                </button>
                {showCannedReplies && (
                  <div className="absolute right-0 bottom-7 w-80 bg-popover border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                    <p className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Quick Replies</p>
                    {CANNED_REPLIES.map((reply, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-3 py-2.5 text-xs text-foreground hover:bg-accent transition-colors border-b border-border last:border-0 leading-relaxed"
                        onClick={() => { setReplyText(reply); setShowCannedReplies(false); }}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {sendError ? (
              <p className="text-xs text-destructive mb-2">{sendError}</p>
            ) : null}
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
              onChange={(e) => {
                if (e.target.files) {
                  setChatFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = '';
                }
              }}
            />
            <div className="flex gap-2">
              <Textarea
                ref={replyTextareaRef}
                placeholder={isInternal ? 'Write an internal note…' : 'Type your reply to the client…'}
                rows={2}
                className={cn('flex-1 resize-none text-sm', isInternal ? 'border-warning/40 bg-card' : '')}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
                }}
                onPaste={(e) => {
                  const images = Array.from(e.clipboardData.items)
                    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
                    .map((item) => item.getAsFile())
                    .filter((f): f is File => f !== null && f.size <= 10 * 1024 * 1024);
                  if (images.length > 0) {
                    e.preventDefault();
                    setChatFiles((prev) => [...prev, ...images]);
                  }
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
        </div>
      </div>

      {/* Forward to Team Member Dialog */}
      <Dialog open={forwardOpen} onOpenChange={(open) => { if (!isForwarding) { setForwardOpen(open); if (!open) { setForwardTo(''); setForwardNote(''); } } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CornerUpRight className="h-4 w-4 text-muted-foreground" />
              Forward to Team Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">Forward to <span className="text-primary">*</span></label>
              <Select value={forwardTo} onValueChange={setForwardTo}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select team member…" />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.filter((m) => m !== user?.name).map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Context / Note <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="What do you need from them? Any permission, question, or context…"
                rows={3}
                className="text-sm resize-none"
                value={forwardNote}
                onChange={(e) => setForwardNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setForwardOpen(false)} disabled={isForwarding}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleForwardSend} disabled={!forwardTo || isForwarding}>
              <CornerUpRight className="h-3.5 w-3.5 mr-1.5" />
              {isForwarding ? 'Sending…' : 'Forward'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingStatus} onOpenChange={(open) => {
        if (!open && !isResolving) {
          setPendingStatus(null);
          setResolutionSummary('');
          setResolutionCause('');
          setResolutionPrevention('');
          setResolutionFiles([]);
          setResolveError('');
          setAddToSystemChange(false);
          setPropagateToLinked(false);
          setScTitle('');
          setScStatus('Completed');
        }
      }}>
        <AlertDialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <AlertDialogHeader className="shrink-0">
            <AlertDialogTitle>Mark ticket as {pendingStatus}</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a resolution note — this will be shown to the client as a final notification. The status cannot be changed afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
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
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Attachments <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.pdf,.csv,.xls,.xlsx,.txt,.log"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setResolutionFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                    e.target.value = '';
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Attach File
              </Button>
              {resolutionFiles.length > 0 && (
                <div className="space-y-1 mt-1">
                  {resolutionFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-foreground">{file.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => setResolutionFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Unresolved duplicate-linked tickets — auto-resolved with the same message */}
            {ticketLinks.some((l) => l.linkType === 'duplicate' && (l.primaryTicketId === ticketId ? l.linkedTicket : l.primaryTicket).status !== 'Resolved') && (
              <div className="rounded-md border border-warning/30 p-3 space-y-1.5 bg-warning/5">
                <p className="text-xs font-semibold text-foreground">Also resolving duplicate-linked ticket(s):</p>
                {ticketLinks.filter((l) => l.linkType === 'duplicate' && (l.primaryTicketId === ticketId ? l.linkedTicket : l.primaryTicket).status !== 'Resolved').map((l) => {
                  const other = l.primaryTicketId === ticketId ? l.linkedTicket : l.primaryTicket;
                  return (
                    <div key={l.id} className="flex items-center gap-2 text-xs pl-1">
                      <span className="font-mono font-semibold text-secondary">{other.id}</span>
                      <span className="text-muted-foreground truncate">{other.title}</span>
                      <span className={cn('text-[10px] px-1.5 rounded border shrink-0', statusStyles[other.status as TicketStatus])}>{other.status}</span>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground">These will be resolved with the same message.</p>
              </div>
            )}

            {/* Link to System Change */}
            <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={addToSystemChange}
                  onChange={(e) => setAddToSystemChange(e.target.checked)}
                />
                <span className="text-xs font-semibold text-foreground">Also record as a System Change</span>
              </label>
              {addToSystemChange && (
                <div className="space-y-2 pl-6">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Change Title</label>
                    <Input
                      className="h-7 text-xs"
                      placeholder={`[${ticket?.id}] ${ticket?.title ?? ''}`}
                      value={scTitle}
                      onChange={(e) => setScTitle(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">Leave blank to auto-fill from ticket title.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Initial Status</label>
                    <Select value={scStatus} onValueChange={(v) => setScStatus(v as typeof scStatus)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not Started">Not Started</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    System, module, and bank will be copied from this ticket automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
          </div>{/* end scrollable area */}
          {resolveError && (
            <p className="text-xs text-destructive shrink-0">{resolveError}</p>
          )}
          <AlertDialogFooter className="shrink-0">
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

      {/* Link Ticket Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => {
        if (!isLinking) {
          setLinkDialogOpen(open);
          if (!open) { setLinkSearchQuery(''); setLinkTargetId(''); setLinkNote(''); setLinkError(''); setLinkType('duplicate'); }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Ticket picker */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Search & select ticket</label>
              {linkTargetId ? (
                (() => {
                  const sel = allTickets.find((t: Ticket) => t.id === linkTargetId);
                  return (
                    <div className="flex items-start gap-2 p-2.5 rounded-md border border-primary/30 bg-primary/5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-secondary">{linkTargetId}</span>
                          {sel && <span className="text-[10px] text-muted-foreground">{sel.status}</span>}
                        </div>
                        <p className="text-xs text-foreground truncate mt-0.5">{sel?.title ?? linkTargetId}</p>
                        {sel?.bankName && <p className="text-[10px] text-muted-foreground">{sel.bankName}</p>}
                      </div>
                      <button
                        onClick={() => { setLinkTargetId(''); setLinkSearchQuery(''); }}
                        className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  );
                })()
              ) : (
                <>
                  <Input
                    autoFocus
                    placeholder="Search by ticket ID, title, or bank…"
                    value={linkSearchQuery}
                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                    className="h-8 text-xs"
                  />
                  {linkSearchQuery.trim().length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                      {linkSearchResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3 text-center">No tickets found.</p>
                      ) : linkSearchResults.map((t: Ticket) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setLinkTargetId(t.id); setLinkSearchQuery(''); }}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/50 text-left transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-semibold text-secondary shrink-0">{t.id}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0', statusStyles[t.status as TicketStatus])}>
                                {t.status}
                              </span>
                            </div>
                            <p className="text-xs text-foreground truncate mt-0.5">{t.title}</p>
                            {t.bankName && <p className="text-[10px] text-muted-foreground">{t.bankName}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {linkSearchQuery.trim().length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Type to search existing tickets.</p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Link Type</label>
              <Select value={linkType} onValueChange={(v) => setLinkType(v as 'duplicate' | 'related')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="duplicate">Duplicate — same exact issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="Why are these tickets linked?"
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
              />
            </div>
            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(false)} disabled={isLinking}>Cancel</Button>
            <Button size="sm" disabled={!linkTargetId || isLinking} onClick={async () => {
              if (!linkTargetId) return;
              setIsLinking(true);
              setLinkError('');
              try {
                await api.createTicketLink(ticketId, { linkedTicketId: linkTargetId, linkType, note: linkNote.trim() || undefined });
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['ticket-links', ticketId] }),
                  queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
                  queryClient.invalidateQueries({ queryKey: ['tickets'] }),
                  queryClient.invalidateQueries({ queryKey: ['stats'] }),
                ]);
                setLinkDialogOpen(false);
              } catch (e: unknown) {
                setLinkError(e instanceof Error ? e.message : 'Failed to link ticket.');
              } finally {
                setIsLinking(false);
              }
            }}>
              {isLinking ? 'Linking…' : 'Link Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to System Change Dialog */}
      <Dialog open={scLinkDialogOpen} onOpenChange={(open) => {
        if (!isScLinking) {
          setScLinkDialogOpen(open);
          if (!open) { setScLinkSearch(''); setScLinkNote(''); setScLinkError(''); }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link to System Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Search system changes</label>
              <Input
                autoFocus
                placeholder="Search by title, system, or module…"
                value={scLinkSearch}
                onChange={(e) => setScLinkSearch(e.target.value)}
                className="h-8 text-xs"
              />
              {(() => {
                const q = scLinkSearch.trim().toLowerCase();
                const alreadyLinked = new Set(scLinks.map((l) => l.changeId));
                const results = q
                  ? allSystemChanges.filter((c) =>
                      !alreadyLinked.has(c.id) && (
                        c.title.toLowerCase().includes(q) ||
                        (c.system ?? '').toLowerCase().includes(q) ||
                        (c.module ?? '').toLowerCase().includes(q)
                      )
                    ).slice(0, 8)
                  : allSystemChanges.filter((c) => !alreadyLinked.has(c.id)).slice(0, 8);
                const statusColor: Record<string, string> = {
                  'Not Started': 'text-muted-foreground',
                  'In Progress': 'text-info',
                  'Completed':   'text-success',
                };
                return results.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {results.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={async () => {
                          setIsScLinking(true); setScLinkError('');
                          try {
                            await api.linkChangeToTicket(ticketId, c.id, scLinkNote.trim() || undefined);
                            queryClient.invalidateQueries({ queryKey: ['ticket-sc-links', ticketId] });
                            queryClient.invalidateQueries({ queryKey: ['system-changes'] });
                            setScLinkDialogOpen(false);
                          } catch (e: unknown) {
                            setScLinkError(e instanceof Error ? e.message : 'Failed to link.');
                          } finally { setIsScLinking(false); }
                        }}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/50 text-left transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn('text-[10px] font-semibold', statusColor[c.status] ?? 'text-muted-foreground')}>
                              {c.status}
                            </span>
                            {c.system && (
                              <span className="text-[10px] text-muted-foreground">{c.system}{c.module ? ` › ${c.module}` : ''}</span>
                            )}
                          </div>
                          <p className="text-xs text-foreground truncate font-medium">{c.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : q ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No matching system changes.</p>
                ) : null;
              })()}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="Why is this ticket related to the system change?"
                value={scLinkNote}
                onChange={(e) => setScLinkNote(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            {scLinkError && <p className="text-xs text-destructive">{scLinkError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setScLinkDialogOpen(false)} disabled={isScLinking}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
