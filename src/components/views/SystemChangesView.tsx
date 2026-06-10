import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CheckCircle2, Clock, CircleDot, Filter, Building2, ChevronDown, ChevronUp, X, Ticket, Paperclip, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { systemModules } from '@/data/mockData';
import type { SystemChange, SystemChangeBank, SystemChangeItem, TicketSystemChangeLink } from '@/data/mockData';

const STATUS_CONFIG = {
  'Not Started': { color: 'bg-muted text-muted-foreground border-border', icon: CircleDot },
  'In Progress': { color: 'bg-info/10 text-info border-info/20', icon: Clock },
  'Completed':   { color: 'bg-success/10 text-success border-success/20', icon: CheckCircle2 },
} as const;

const BANKS = ['Guheshwori', 'Reliance', 'Progressive', 'Ganapati', 'Goodwill', 'Shree Finance', 'Durdristi', 'Gurkhas'];

const CHANGE_TYPES = ['Function', 'Procedure', 'Table', 'View', 'Trigger', 'Constraint', 'Index', 'Column', 'Other'];

function StatusBadge({ status }: { status: SystemChange['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border', cfg.color)}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

// ── Item form state ───────────────────────────────────────────────────────────

interface ItemDraft {
  key: number; // local only, for React key
  changeType: string;
  objectName: string;
  beforeState: string;
  afterState: string;
  attachmentFile?: File | null;
  attachmentName?: string;
  attachmentUrl?: string;
}

function emptyItem(key: number): ItemDraft {
  return { key, changeType: '', objectName: '', beforeState: '', afterState: '' };
}

// ── Change card item display ──────────────────────────────────────────────────

function ItemCard({ item, index }: { item: SystemChangeItem; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasDetails = item.beforeState || item.afterState || item.attachmentUrl;

  return (
    <div className="rounded border border-border bg-background">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[11px] font-bold text-muted-foreground w-5 shrink-0">#{index + 1}</span>
        {item.changeType && (
          <span className="text-[11px] font-semibold text-secondary bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 rounded">
            {item.changeType}
          </span>
        )}
        {item.objectName && (
          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground font-mono flex-1 truncate">
            {item.objectName}
          </code>
        )}
        {!item.changeType && !item.objectName && (
          <span className="text-[11px] text-muted-foreground flex-1 italic">Unnamed item</span>
        )}
        {hasDetails && (
          <span className="text-muted-foreground shrink-0">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="px-3 pb-3 space-y-2">
          {item.attachmentUrl && (
            <a
              href={item.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              {item.attachmentName ?? 'Download attachment'}
            </a>
          )}
          {(item.beforeState || item.afterState) && (
            <div className="grid grid-cols-2 gap-3">
              {item.beforeState && (
                <div className="rounded border border-border bg-muted/30 p-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Before</p>
                  <pre className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap font-mono break-words">
                    {item.beforeState}
                  </pre>
                </div>
              )}
              {item.afterState && (
                <div className="rounded border border-success/25 bg-success/5 p-2.5">
                  <p className="text-[10px] font-bold text-success uppercase tracking-wide mb-1.5">After</p>
                  <pre className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap font-mono break-words">
                    {item.afterState}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Legacy single-item display (backward compat) ──────────────────────────────

function LegacyItemCard({ change }: { change: SystemChange }) {
  const [expanded, setExpanded] = useState(true);
  const hasDetails = change.beforeState || change.afterState;
  return (
    <div className="rounded border border-border bg-background">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[11px] font-bold text-muted-foreground w-5 shrink-0">#1</span>
        {change.changeType && (
          <span className="text-[11px] font-semibold text-secondary bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 rounded">
            {change.changeType}
          </span>
        )}
        {change.objectName && (
          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground font-mono flex-1 truncate">
            {change.objectName}
          </code>
        )}
        {hasDetails && (
          <span className="text-muted-foreground shrink-0">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>
      {expanded && hasDetails && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-3">
          {change.beforeState && (
            <div className="rounded border border-border bg-muted/30 p-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Before</p>
              <pre className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap font-mono break-words">
                {change.beforeState}
              </pre>
            </div>
          )}
          {change.afterState && (
            <div className="rounded border border-success/25 bg-success/5 p-2.5">
              <p className="text-[10px] font-bold text-success uppercase tracking-wide mb-1.5">After</p>
              <pre className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap font-mono break-words">
                {change.afterState}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bank tracking ─────────────────────────────────────────────────────────────

interface BankDraftEntry { included: boolean; status: 'Pending' | 'Done'; note: string }
type BankDraft = Record<string, BankDraftEntry>;

function initDraft(banks: SystemChangeBank[]): BankDraft {
  const draft: BankDraft = {};
  for (const b of BANKS) {
    const found = banks.find((x) => x.bankName === b);
    draft[b] = found
      ? { included: true, status: found.status, note: found.note ?? '' }
      : { included: false, status: 'Pending', note: '' };
  }
  return draft;
}

function BankPanel({ change, onManage, isAdmin }: { change: SystemChange; onManage: () => void; isAdmin: boolean }) {
  const { data: banks = [], isLoading } = useQuery<SystemChangeBank[]>({
    queryKey: ['change-banks', change.id],
    queryFn: () => api.getSystemChangeBanks(change.id),
  });

  if (isLoading) return <div className="text-xs text-muted-foreground pt-2 border-t border-border">Loading banks…</div>;

  const done = banks.filter((b) => b.status === 'Done').length;
  const total = banks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (total === 0) {
    return (
      <div className="pt-2 border-t border-border flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground italic">No banks assigned yet</span>
        {isAdmin && (
          <button onClick={onManage} className="text-[11px] text-primary hover:underline font-medium">+ Assign Banks</button>
        )}
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-border space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground">
          Bank Rollout — {done}/{total} done ({pct}%)
        </span>
        {isAdmin && (
          <button onClick={onManage} className="text-[11px] text-primary hover:underline font-medium">Manage</button>
        )}
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-success' : 'bg-info')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {banks.map((b) => (
          <span
            key={b.bankName}
            title={b.note ?? undefined}
            className={cn(
              'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium',
              b.status === 'Done'
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-muted border-border text-muted-foreground'
            )}
          >
            {b.status === 'Done' ? '✓' : '○'} {b.bankName}
            {b.updatedBy && b.status === 'Done' && (
              <span className="opacity-60 font-normal">· {b.updatedBy.split(' ')[0]}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function BankManageDialog({ change, onClose }: { change: SystemChange; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: existingBanks = [] } = useQuery<SystemChangeBank[]>({
    queryKey: ['change-banks', change.id],
    queryFn: () => api.getSystemChangeBanks(change.id),
  });

  const [draft, setDraft] = useState<BankDraft>(() => initDraft(existingBanks));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  if (!initialized && existingBanks.length > 0) {
    setDraft(initDraft(existingBanks));
    setInitialized(true);
  }

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const banks = Object.entries(draft)
        .filter(([, v]) => v.included)
        .map(([bankName, v]) => ({ bankName, status: v.status, note: v.note || undefined }));
      await api.setSystemChangeBanks(change.id, banks);
      queryClient.invalidateQueries({ queryKey: ['change-banks', change.id] });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally { setSaving(false); }
  };

  const includedCount = Object.values(draft).filter((v) => v.included).length;
  const doneCount = Object.values(draft).filter((v) => v.included && v.status === 'Done').length;

  return (
    <Dialog open onOpenChange={() => { if (!saving) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Bank Rollout</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 font-normal">{change.title}</p>
        </DialogHeader>
        {includedCount > 0 && (
          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', doneCount === includedCount ? 'bg-success' : 'bg-info')}
                style={{ width: `${includedCount > 0 ? (doneCount / includedCount) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-foreground shrink-0">{doneCount}/{includedCount} done</span>
          </div>
        )}
        <div className="space-y-2 py-2">
          <p className="text-xs text-muted-foreground">Check banks this change applies to, then mark each as Done when deployed.</p>
          {BANKS.map((bank) => {
            const entry = draft[bank] ?? { included: false, status: 'Pending' as const, note: '' };
            return (
              <div key={bank} className={cn('rounded-md border p-3 space-y-2 transition-colors',
                entry.included
                  ? entry.status === 'Done' ? 'border-success/30 bg-success/5' : 'border-info/30 bg-info/5'
                  : 'border-border bg-card opacity-60'
              )}>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                    <input type="checkbox" className="h-4 w-4 rounded accent-primary" checked={entry.included}
                      onChange={(e) => setDraft((d) => ({ ...d, [bank]: { ...entry, included: e.target.checked } }))}
                    />
                    <span className="text-sm font-medium text-foreground">{bank}</span>
                  </label>
                  {entry.included && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(['Pending', 'Done'] as const).map((s) => (
                        <button key={s} type="button"
                          onClick={() => setDraft((d) => ({ ...d, [bank]: { ...entry, status: s } }))}
                          className={cn('text-[11px] px-2 py-0.5 rounded border font-medium transition-colors',
                            entry.status === s
                              ? s === 'Done' ? 'bg-success/15 border-success/40 text-success' : 'bg-muted border-border text-foreground'
                              : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                          )}
                        >{s === 'Done' ? '✓ Done' : 'Pending'}</button>
                      ))}
                    </div>
                  )}
                </div>
                {entry.included && (
                  <input type="text" placeholder="Note (optional)"
                    className="w-full h-6 text-[11px] bg-transparent border-0 border-b border-border/50 focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60 px-0"
                    value={entry.note}
                    onChange={(e) => setDraft((d) => ({ ...d, [bank]: { ...entry, note: e.target.value } }))}
                  />
                )}
              </div>
            );
          })}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Bank Status'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Item editor row (in form) ─────────────────────────────────────────────────

const ALLOWED_ITEM_EXTENSIONS = ['.sql', '.txt', '.log', '.pdf', '.csv', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];

function ItemEditorRow({
  item, index, onChange, onRemove, canRemove,
}: {
  item: ItemDraft;
  index: number;
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      onChange({ attachmentFile: file, attachmentName: file.name, attachmentUrl: undefined });
    }
    e.target.value = '';
  };

  const clearAttachment = () => {
    onChange({ attachmentFile: null, attachmentName: undefined, attachmentUrl: undefined });
  };

  const currentAttachmentName = item.attachmentFile?.name ?? item.attachmentName;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Item #{index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Object Type</label>
          <Select value={item.changeType || '_none'} onValueChange={(v) => onChange({ changeType: v === '_none' ? '' : v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— None —</SelectItem>
              {CHANGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Object Name</label>
          <Input className="h-7 text-xs" placeholder="e.g. sp_CreateAccount"
            value={item.objectName}
            onChange={(e) => onChange({ objectName: e.target.value })}
          />
        </div>
      </div>

      {/* File attachment */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Script / File Attachment <span className="text-muted-foreground/60">(sql, txt, pdf, csv, xlsx…)</span></label>
        {currentAttachmentName ? (
          <div className="flex items-center gap-2 rounded border border-border bg-background px-2.5 py-1.5">
            <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-xs text-foreground flex-1 truncate">{currentAttachmentName}</span>
            {item.attachmentUrl && !item.attachmentFile && (
              <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-primary hover:underline shrink-0">view</a>
            )}
            <button type="button" onClick={clearAttachment}
              className="text-muted-foreground hover:text-destructive shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground border border-dashed border-border rounded px-3 py-1.5 hover:border-primary hover:text-primary transition-colors w-full"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Attach file
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_ITEM_EXTENSIONS.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Before <span className="text-muted-foreground/60">(optional)</span></label>
          <Textarea placeholder="Previous state / original code…" rows={4}
            className="text-xs font-mono resize-y"
            value={item.beforeState}
            onChange={(e) => onChange({ beforeState: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-success font-medium">After <span className="text-muted-foreground/60">(optional)</span></label>
          <Textarea placeholder="New state / updated code…" rows={4}
            className="text-xs font-mono resize-y border-success/30 focus-visible:ring-success/30"
            value={item.afterState}
            onChange={(e) => onChange({ afterState: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main form state ───────────────────────────────────────────────────────────

interface ChangeFormData {
  title: string;
  description: string;
  system: string;
  module: string;
  bankName: string;
  status: SystemChange['status'];
  items: ItemDraft[];
}

let _itemKey = 0;
const nextKey = () => ++_itemKey;

const emptyForm = (): ChangeFormData => ({
  title: '', description: '', system: '', module: '', bankName: '', status: 'Not Started',
  items: [emptyItem(nextKey())],
});

function fromChange(c: SystemChange): ChangeFormData {
  let items: ItemDraft[];
  if (c.items && c.items.length > 0) {
    items = c.items.map((it) => ({
      key: nextKey(),
      changeType: it.changeType ?? '',
      objectName: it.objectName ?? '',
      beforeState: it.beforeState ?? '',
      afterState: it.afterState ?? '',
      attachmentName: it.attachmentName,
      attachmentUrl: it.attachmentUrl,
    }));
  } else if (c.changeType || c.objectName || c.beforeState || c.afterState) {
    // Legacy single-item migration into the editor
    items = [{
      key: nextKey(),
      changeType: c.changeType ?? '',
      objectName: c.objectName ?? '',
      beforeState: c.beforeState ?? '',
      afterState: c.afterState ?? '',
    }];
  } else {
    items = [emptyItem(nextKey())];
  }
  return {
    title: c.title,
    description: c.description ?? '',
    system: c.system ?? '',
    module: c.module ?? '',
    bankName: c.bankName ?? '',
    status: c.status,
    items,
  };
}

// ── Linked tickets panel ──────────────────────────────────────────────────────

function TicketLinksPanel({ change, canManage }: { change: SystemChange; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data: links = [], isLoading } = useQuery<TicketSystemChangeLink[]>({
    queryKey: ['sc-ticket-links', change.id],
    queryFn: () => api.getSystemChangeTickets(change.id),
  });

  if (isLoading) return <p className="text-[11px] text-muted-foreground">Loading tickets…</p>;

  const statusColor: Record<string, string> = {
    'Open': 'text-primary', 'In Progress': 'text-info',
    'Pending Client': 'text-warning', 'Resolved': 'text-success', 'Closed': 'text-muted-foreground',
  };

  return (
    <div className="space-y-1.5">
      {links.length === 0 && <p className="text-[11px] text-muted-foreground italic">No tickets linked yet.</p>}
      {links.map((l) => {
        const t = l.ticket!;
        return (
          <div key={l.id} className="flex items-start gap-2 p-2 rounded border border-border bg-background">
            <Ticket className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono font-bold text-secondary">{t.id}</span>
                <span className={cn('text-[10px] font-medium', statusColor[t.status] ?? 'text-muted-foreground')}>{t.status}</span>
                {t.bankName && <span className="text-[10px] text-muted-foreground">{t.bankName}</span>}
              </div>
              <p className="text-[11px] text-foreground truncate">{t.title}</p>
              {l.note && <p className="text-[10px] text-muted-foreground/70 italic">{l.note}</p>}
            </div>
            {canManage && (
              <button
                onClick={async () => {
                  await api.unlinkTicketFromChange(change.id, t.id);
                  queryClient.invalidateQueries({ queryKey: ['sc-ticket-links', change.id] });
                }}
                className="text-muted-foreground hover:text-destructive shrink-0"
                title="Unlink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SystemChangesView({ isAdmin = false }: { isAdmin?: boolean }) {
  const queryClient = useQueryClient();

  // Fetch the current user's effective permissions
  const { data: myPerms } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => api.getMyPermissions(),
    staleTime: 60_000,
  });
  // canManage: true by default (optimistic) until permissions load
  const canManage = myPerms ? (myPerms.canManageSystemChanges !== false) : isAdmin;

  const [statusFilter, setStatusFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SystemChange | null>(null);
  const [form, setForm] = useState<ChangeFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SystemChange | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [bankDialogChange, setBankDialogChange] = useState<SystemChange | null>(null);
  const [expandedBanks, setExpandedBanks] = useState<Set<number>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleSection = (id: number, set: Set<number>, setter: React.Dispatch<React.SetStateAction<Set<number>>>) =>
    setter((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const { data: allChanges = [], isLoading } = useQuery<SystemChange[]>({
    queryKey: ['system-changes'],
    queryFn: () => api.getSystemChanges(),
  });

  const filtered = allChanges.filter((c) => {
    if (activeTab === 'completed' && c.status !== 'Completed') return false;
    if (activeTab === 'pending' && c.status === 'Completed') return false;
    if (statusFilter && statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (systemFilter && systemFilter !== 'all' && c.system !== systemFilter) return false;
    return true;
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(''); setDialogOpen(true); };
  const openEdit = (c: SystemChange) => { setEditing(c); setForm(fromChange(c)); setError(''); setDialogOpen(true); };

  const setItem = (index: number, patch: Partial<ItemDraft>) =>
    setForm((f) => {
      const items = [...f.items];
      items[index] = { ...items[index], ...patch };
      return { ...f, items };
    });

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, emptyItem(nextKey())] }));

  const removeItem = (index: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title, description: form.description,
        system: form.system, module: form.module,
        bankName: form.bankName, status: form.status,
      };
      let changeId: number;
      if (editing) {
        const updated = await api.updateSystemChange(editing.id, payload as Record<string, unknown>);
        changeId = updated.id;
      } else {
        const created = await api.createSystemChange(payload as Record<string, unknown>);
        changeId = created.id;
      }
      // Save items via setAll
      const readFileAsBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      const itemsPayload = await Promise.all(
        form.items
          .filter((it) => it.changeType || it.objectName || it.beforeState || it.afterState || it.attachmentFile || it.attachmentUrl)
          .map(async (it) => {
            const base: Record<string, string | undefined> = {
              changeType: it.changeType || undefined,
              objectName: it.objectName || undefined,
              beforeState: it.beforeState || undefined,
              afterState: it.afterState || undefined,
            };
            if (it.attachmentFile) {
              base.attachmentContent = await readFileAsBase64(it.attachmentFile);
              base.attachmentName = it.attachmentFile.name;
            } else if (it.attachmentUrl) {
              base.attachmentUrl = it.attachmentUrl;
              base.attachmentName = it.attachmentName;
            }
            return base;
          })
      );
      await api.setSystemChangeItems(changeId, itemsPayload);
      queryClient.invalidateQueries({ queryKey: ['system-changes'] });
      setDialogOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteSystemChange(deleteTarget.id);
    queryClient.invalidateQueries({ queryKey: ['system-changes'] });
    setDeleteTarget(null);
  };

  const handleStatusQuickChange = async (change: SystemChange, status: SystemChange['status']) => {
    await api.updateSystemChange(change.id, { status });
    queryClient.invalidateQueries({ queryKey: ['system-changes'] });
  };

  const modules = form.system ? Object.keys(systemModules[form.system] || {}) : [];

  const stats = {
    notStarted: allChanges.filter((c) => c.status === 'Not Started').length,
    inProgress: allChanges.filter((c) => c.status === 'In Progress').length,
    completed: allChanges.filter((c) => c.status === 'Completed').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Change Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Track system modifications, implementations, and updates across all modules.</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Change
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Not Started', count: stats.notStarted, color: 'border-border', bg: 'bg-muted/30' },
          { label: 'In Progress',  count: stats.inProgress,  color: 'border-info/30', bg: 'bg-info/5' },
          { label: 'Completed',    count: stats.completed,   color: 'border-success/30', bg: 'bg-success/5' },
        ] as const).map(({ label, count, color, bg }) => (
          <div key={label} className={cn('rounded-lg border p-4', color, bg)}>
            <p className="text-2xl font-bold text-foreground">{count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(['pending', 'completed'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'pending' ? 'Pending Changes' : 'Completed Changes'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {activeTab === 'pending' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={systemFilter} onValueChange={setSystemFilter}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Systems" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Systems</SelectItem>
            {Object.keys(systemModules).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Change List */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {activeTab === 'completed' ? 'No completed changes yet.' : 'No pending changes.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((change) => {
            const hasNewItems = (change.items?.length ?? 0) > 0;
            const hasLegacyItem = !hasNewItems && (change.changeType || change.objectName || change.beforeState || change.afterState);
            const itemCount = hasNewItems ? change.items!.length : (hasLegacyItem ? 1 : 0);
            const itemsExpanded = expandedItems.has(change.id);

            return (
              <div key={change.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={change.status} />
                      {change.system && (
                        <span className="text-xs font-medium text-secondary bg-secondary/10 border border-secondary/20 px-2 py-0.5 rounded">
                          {change.system}{change.module ? ` › ${change.module}` : ''}
                        </span>
                      )}
                      {change.bankName && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                          {change.bankName}
                        </span>
                      )}
                      {itemCount > 0 && (
                        <Badge className="text-[10px] bg-muted text-muted-foreground border-border">
                          {itemCount} {itemCount === 1 ? 'change item' : 'change items'}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground mt-2 text-sm">{change.title}</h3>
                    {change.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{change.description}</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(change)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(change)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Change items section */}
                {itemCount > 0 && (
                  <div className="space-y-2">
                    <button
                      onClick={() => toggleSection(change.id, expandedItems, setExpandedItems)}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                      {itemsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {itemsExpanded ? 'Hide' : 'Show'} change details ({itemCount})
                    </button>
                    {itemsExpanded && (
                      <div className="space-y-2 pl-1">
                        {hasNewItems
                          ? change.items!.map((item, i) => <ItemCard key={item.id} item={item} index={i} />)
                          : <LegacyItemCard change={change} />
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Bank rollout panel */}
                <div>
                  <button
                    onClick={() => toggleSection(change.id, expandedBanks, setExpandedBanks)}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Bank Rollout
                    {expandedBanks.has(change.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {expandedBanks.has(change.id) && (
                    <div className="mt-2">
                      <BankPanel change={change} onManage={() => setBankDialogChange(change)} isAdmin={canManage} />
                    </div>
                  )}
                </div>

                {/* Linked tickets */}
                {(() => {
                  const isOpen = expandedBanks.has(change.id + 100000); // offset to avoid bank collision
                  return (
                    <div>
                      <button
                        onClick={() => toggleSection(change.id + 100000, expandedBanks, setExpandedBanks)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Ticket className="h-3.5 w-3.5" />
                        Linked Tickets
                        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {isOpen && (
                        <div className="mt-2">
                          <TicketLinksPanel change={change} canManage={canManage} />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Quick status change — admin only */}
                {canManage && change.status !== 'Completed' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">Move to:</span>
                    {change.status === 'Not Started' && (
                      <button onClick={() => handleStatusQuickChange(change, 'In Progress')}
                        className="text-[11px] font-medium text-info hover:underline">
                        In Progress
                      </button>
                    )}
                    <button onClick={() => handleStatusQuickChange(change, 'Completed')}
                      className="text-[11px] font-medium text-success hover:underline">
                      Completed
                    </button>
                    {change.updatedBy && (
                      <span className="ml-auto text-[10px] text-muted-foreground">Updated by {change.updatedBy}</span>
                    )}
                  </div>
                )}
                {change.status === 'Completed' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                    {change.completedAt && <span>Completed {new Date(change.completedAt).toLocaleDateString('en-GB')}</span>}
                    {change.updatedBy && <span>· by {change.updatedBy}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit System Change' : 'Record New System Change'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title <span className="text-primary">*</span></label>
              <Input placeholder="Brief description of the change"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description / Context</label>
              <Textarea placeholder="What issue triggered this change? What is the business impact?…"
                rows={2} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* System + Module + Bank + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">System</label>
                <Select value={form.system} onValueChange={(v) => setForm((f) => ({ ...f, system: v, module: '' }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select system" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(systemModules).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Module</label>
                <Select value={form.module} onValueChange={(v) => setForm((f) => ({ ...f, module: v }))} disabled={!form.system}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={form.system ? 'Select module' : '—'} /></SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bank</label>
                <Select value={form.bankName || '_all'} onValueChange={(v) => setForm((f) => ({ ...f, bankName: v === '_all' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All banks" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All banks</SelectItem>
                    {BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as SystemChange['status'] }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Change Items */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Change Items <span className="text-muted-foreground font-normal normal-case ml-1">({form.items.length})</span>
                </p>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Each item represents one object/procedure/constraint that changed. Add as many as needed.
              </p>
              <div className="space-y-3">
                {form.items.map((item, i) => (
                  <ItemEditorRow
                    key={item.key}
                    item={item}
                    index={i}
                    onChange={(patch) => setItem(i, patch)}
                    onRemove={() => removeItem(i)}
                    canRemove={form.items.length > 1}
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete System Change</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>"{deleteTarget.title}"</strong>? This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Bank Manage Dialog */}
      {bankDialogChange && (
        <BankManageDialog change={bankDialogChange} onClose={() => setBankDialogChange(null)} />
      )}
    </div>
  );
}
