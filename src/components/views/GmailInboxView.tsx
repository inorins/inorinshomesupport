import { useState } from 'react';
import { Mail, RefreshCw, Ticket, Trash2, Loader2, Inbox } from 'lucide-react';
import { useInboxEmails, useInboxMutations, type InboxFilter, type InboxEmail } from '@/hooks/useInboxEmails';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Kathmandu',
  });
}

function statusBadge(status: InboxEmail['status']) {
  if (status === 'pending') return <Badge variant="default" className="text-[10px]">Pending</Badge>;
  if (status === 'ticket_created') return <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">Converted</Badge>;
  return <Badge variant="outline" className="text-[10px] text-muted-foreground">Dismissed</Badge>;
}

interface ConvertDialogProps {
  email: InboxEmail | null;
  onClose: () => void;
  onConfirm: (data: Record<string, string>) => void;
  isLoading: boolean;
}

function ConvertDialog({ email, onClose, onConfirm, isLoading }: ConvertDialogProps) {
  const [form, setForm] = useState({
    title: email?.subject ?? '',
    system: 'CBS',
    module: 'General',
    form: 'Email',
    priority: 'Medium',
    environment: 'UAT',
    bankName: '',
  });

  if (!email) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Ticket from Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <div className="bg-muted/50 rounded p-3 space-y-1">
            <p className="font-medium">{email.senderName || email.senderEmail}</p>
            <p className="text-muted-foreground text-xs">{email.senderEmail}</p>
            <p className="text-muted-foreground text-xs">{email.subject}</p>
          </div>
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>System</Label>
              <Select value={form.system} onValueChange={(v) => setForm({ ...form, system: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBS">CBS</SelectItem>
                  <SelectItem value="ECL">ECL</SelectItem>
                  <SelectItem value="DCH">DCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Module</Label>
              <Input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Form</Label>
              <Input value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Bank Name (optional)</Label>
            <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Reliance Bank" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(form)} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GmailInboxView() {
  const [filter, setFilter] = useState<InboxFilter>('pending');
  const [converting, setConverting] = useState<InboxEmail | null>(null);
  const { data, isLoading, refetch } = useInboxEmails(filter);
  const { convertToTicket, dismiss, sync } = useInboxMutations();

  const emails = data?.emails ?? [];

  function handleConvertConfirm(formData: Record<string, string>) {
    if (!converting) return;
    convertToTicket.mutate(
      { id: converting.id, data: formData },
      { onSuccess: () => setConverting(null), onError: () => setConverting(null) }
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Gmail Inbox</h1>
          {(data?.pending ?? 0) > 0 && (
            <Badge variant="destructive" className="text-xs">{data?.pending} pending</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={() => { sync.mutate(); refetch(); }}
            disabled={sync.isPending}
          >
            {sync.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />
            }
            Sync Now
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as InboxFilter)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="ticket_created">Converted</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />Loading emails…
        </div>
      ) : emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Mail className="h-10 w-10 opacity-30" />
          <p className="text-sm">No emails in this view.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <div
              key={email.id}
              className={cn(
                'rounded-lg border bg-card p-4 flex gap-4 items-start transition-colors',
                email.status === 'pending' ? 'border-primary/20 hover:border-primary/40' : 'opacity-70'
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{email.senderName || email.senderEmail}</p>
                    <p className="text-xs text-muted-foreground">{email.senderEmail}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {statusBadge(email.status)}
                    <span className="text-xs text-muted-foreground">{formatDate(email.receivedAt)}</span>
                  </div>
                </div>
                <p className="text-sm font-medium mt-1.5 truncate">{email.subject ?? '(No Subject)'}</p>
                {email.bodyText && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{email.bodyText}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                    {email.accountEmail}
                  </Badge>
                  {email.status === 'pending' && (
                    <>
                      <Button
                        size="sm" variant="default" className="h-7 text-xs gap-1.5"
                        onClick={() => setConverting(email)}
                      >
                        <Ticket className="h-3.5 w-3.5" />
                        Create Ticket
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => dismiss.mutate(email.id)}
                        disabled={dismiss.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                    </>
                  )}
                  {email.status === 'ticket_created' && email.ticketId && (
                    <span className="text-xs text-green-600">→ {email.ticketId}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConvertDialog
        email={converting}
        onClose={() => setConverting(null)}
        onConfirm={handleConvertConfirm}
        isLoading={convertToTicket.isPending}
      />
    </div>
  );
}
