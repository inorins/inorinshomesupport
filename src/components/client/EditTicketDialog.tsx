import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ContactPicker } from '@/components/client/ContactPicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Ticket } from '@/data/mockData';
import { systemModules } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface EditTicketDialogProps {
  ticket: Ticket;
  open: boolean;
  onClose: () => void;
}

interface EditForm {
  title: string;
  description: string;
  priority: string;
  requestType: string;
  requestedDelivery: string;
  system: string;
  module: string;
  form: string;
  moduleDetails: string;
  contactName: string;
  contactDesignation: string;
  contactPhone: string;
  contactEmail: string;
}

export function EditTicketDialog({ ticket, open, onClose }: EditTicketDialogProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const [form, setForm] = useState<EditForm>({
    title: '',
    description: '',
    priority: '',
    requestType: '',
    requestedDelivery: '',
    system: '',
    module: '',
    form: '',
    moduleDetails: '',
    contactName: '',
    contactDesignation: '',
    contactPhone: '',
    contactEmail: '',
  });

  useEffect(() => {
    if (open && ticket) {
      setForm({
        title: ticket.title ?? '',
        description: ticket.description ?? '',
        priority: ticket.priority ?? 'Medium',
        requestType: ticket.requestType ?? 'Issue',
        requestedDelivery: ticket.requestedDelivery ?? '',
        system: ticket.system ?? '',
        module: ticket.module ?? '',
        form: ticket.form ?? '',
        moduleDetails: ticket.moduleDetails ?? '',
        contactName: ticket.contactName ?? '',
        contactDesignation: ticket.contactDesignation ?? '',
        contactPhone: ticket.contactPhone ?? '',
        contactEmail: ticket.contactEmail ?? '',
      });
      setError('');
    }
  }, [open, ticket]);

  const mutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => api.editTicket(ticket.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['messages', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function f(field: keyof EditForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const systems = Object.keys(systemModules);
  const modules = form.system ? Object.keys(systemModules[form.system] ?? {}) : [];
  const forms = form.system && form.module ? (systemModules[form.system]?.[form.module] ?? []) : [];

  const isIssue = form.requestType === 'Issue';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Ticket — {ticket.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Basic info */}
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => f('title', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Request Type</Label>
              <Select value={form.requestType} onValueChange={(v) => f('requestType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Issue">Issue / Bug</SelectItem>
                  <SelectItem value="Add Form">New Form Request</SelectItem>
                  <SelectItem value="Add Report">New Report Request</SelectItem>
                  <SelectItem value="Update">Update Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isIssue ? (
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => f('priority', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Requested Delivery</Label>
                <Select value={form.requestedDelivery} onValueChange={(v) => f('requestedDelivery', v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASAP">ASAP</SelectItem>
                    <SelectItem value="Within 1 week">Within 1 week</SelectItem>
                    <SelectItem value="Within 2 weeks">Within 2 weeks</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => f('description', e.target.value)} rows={4} />
          </div>

          {/* System & Module */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>System</Label>
              <Select value={form.system} onValueChange={(v) => { f('system', v); f('module', ''); f('form', ''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {systems.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Module</Label>
              <Select value={form.module} onValueChange={(v) => { f('module', v); f('form', ''); }} disabled={!form.system}>
                <SelectTrigger><SelectValue placeholder="Select module…" /></SelectTrigger>
                <SelectContent>
                  {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Form / Screen</Label>
            <Select value={form.form} onValueChange={(v) => f('form', v)} disabled={!form.module}>
              <SelectTrigger><SelectValue placeholder="Select form…" /></SelectTrigger>
              <SelectContent>
                {forms.map((fm) => <SelectItem key={fm} value={fm}>{fm}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Module Notes</Label>
            <Textarea value={form.moduleDetails} onChange={(e) => f('moduleDetails', e.target.value)} rows={2} placeholder="Additional module details…" />
          </div>

          {/* Contact info */}
          <div className="pt-1 border-t border-border space-y-3">
            <ContactPicker
              fields={{ contactName: form.contactName, contactDesignation: form.contactDesignation, contactPhone: form.contactPhone, contactEmail: form.contactEmail }}
              onApply={({ contactName: n, contactDesignation: d, contactPhone: p, contactEmail: e }) => {
                f('contactName', n);
                f('contactDesignation', d);
                f('contactPhone', p);
                f('contactEmail', e);
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact Name</Label>
                <Input value={form.contactName} onChange={(e) => f('contactName', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Designation</Label>
                <Input value={form.contactDesignation} onChange={(e) => f('contactDesignation', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact Phone</Label>
                <Input value={form.contactPhone} onChange={(e) => f('contactPhone', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Contact Email</Label>
                <Input type="email" value={form.contactEmail} onChange={(e) => f('contactEmail', e.target.value)} />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
