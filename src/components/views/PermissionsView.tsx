import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Shield, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import type { RolePermission } from '@/data/mockData';
import type { AppUser } from '@/data/users';

const BANKS = ['Guheshwori', 'Reliance', 'Progressive', 'Ganapati', 'Goodwill', 'Shree Finance', 'Durdristi', 'Gurkhas'];
const DEPARTMENTS = ['CBS', 'ECL', 'DCH', 'Support', 'Development', 'QA', 'Management'];

// ── Helpers ──────────────────────────────────────────────────────────────────

const defaultPerms = (role: 'inorins' | 'client') => ({
  canViewHistoricalTickets: true,
  historicalTicketDays: 365,
  allowedBanks: [] as string[],
  canViewOthersOpen: role === 'inorins',
  canViewOthersInProgress: role === 'inorins',
  canViewOthersResolved: role === 'inorins',
  canViewOthersClosed: role === 'inorins',
  canCreateTickets: true,
  canAssignTickets: role === 'inorins',
  canUpdateTickets: true,
  canCloseTickets: role === 'inorins',
  canViewSystemChanges: role === 'inorins',
  canManageSystemChanges: role === 'inorins',
});

interface PermFormState {
  scope: 'role' | 'user';
  // role-scoped
  role: 'inorins' | 'client';
  department: string;
  // user-scoped
  userId: string;
  // shared toggles
  canViewHistoricalTickets: boolean;
  historicalTicketDays: number;
  allowedBanks: string[];
  canViewOthersOpen: boolean;
  canViewOthersInProgress: boolean;
  canViewOthersResolved: boolean;
  canViewOthersClosed: boolean;
  canCreateTickets: boolean;
  canAssignTickets: boolean;
  canUpdateTickets: boolean;
  canCloseTickets: boolean;
  canViewSystemChanges: boolean;
  canManageSystemChanges: boolean;
}

function emptyForm(scope: 'role' | 'user' = 'role', role: 'inorins' | 'client' = 'inorins'): PermFormState {
  return { scope, role, department: '', userId: '', ...defaultPerms(role) };
}

function fromPerm(p: RolePermission): PermFormState {
  return {
    scope: p.userId ? 'user' : 'role',
    role: p.role,
    department: p.department ?? '',
    userId: p.userId ? String(p.userId) : '',
    canViewHistoricalTickets: p.canViewHistoricalTickets,
    historicalTicketDays: p.historicalTicketDays,
    allowedBanks: p.allowedBanks ?? [],
    canViewOthersOpen: p.canViewOthersOpen,
    canViewOthersInProgress: p.canViewOthersInProgress ?? true,
    canViewOthersResolved: p.canViewOthersResolved,
    canViewOthersClosed: p.canViewOthersClosed,
    canCreateTickets: p.canCreateTickets,
    canAssignTickets: p.canAssignTickets,
    canUpdateTickets: p.canUpdateTickets,
    canCloseTickets: p.canCloseTickets,
    canViewSystemChanges: p.canViewSystemChanges ?? true,
    canManageSystemChanges: p.canManageSystemChanges ?? true,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SwitchRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PermSummary({ perm }: { perm: RolePermission }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
      {[
        { label: 'Create', val: perm.canCreateTickets },
        { label: 'Assign', val: perm.canAssignTickets },
        { label: 'Update', val: perm.canUpdateTickets },
        { label: 'Close',  val: perm.canCloseTickets },
        { label: "Others' Open",       val: perm.canViewOthersOpen },
        { label: "Others' InProgress", val: perm.canViewOthersInProgress ?? true },
        { label: "Others' Resolved",   val: perm.canViewOthersResolved },
        { label: "Others' Closed",     val: perm.canViewOthersClosed },
        { label: 'View SysChanges',    val: perm.canViewSystemChanges ?? true },
        { label: 'Manage SysChanges',  val: perm.canManageSystemChanges ?? true },
      ].map(({ label, val }) => (
        <span key={label} className={cn('text-[11px] font-medium', val ? 'text-success' : 'text-muted-foreground/50 line-through')}>
          {label}
        </span>
      ))}
      {perm.canViewHistoricalTickets && (
        <span className="text-[11px] text-muted-foreground">· History: {perm.historicalTicketDays}d</span>
      )}
      {!perm.canViewHistoricalTickets && (
        <span className="text-[11px] text-muted-foreground/50 line-through">No history</span>
      )}
      {perm.allowedBanks?.length ? (
        <span className="text-[11px] text-muted-foreground">· Banks: {perm.allowedBanks.join(', ')}</span>
      ) : null}
    </div>
  );
}

// ── Permission form panels (shared) ──────────────────────────────────────────

function PermToggles({ form, set, toggleBank }: {
  form: PermFormState;
  set: <K extends keyof PermFormState>(k: K, v: PermFormState[K]) => void;
  toggleBank: (b: string) => void;
}) {
  return (
    <>
      {/* Ticket History */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ticket History</p>
        <SwitchRow
          label="Can view historical tickets"
          desc="Allow access to past tickets"
          checked={form.canViewHistoricalTickets}
          onChange={(v) => set('canViewHistoricalTickets', v)}
        />
        {form.canViewHistoricalTickets && (
          <div className="flex items-center gap-3 pt-1">
            <label className="text-sm text-muted-foreground flex-1">Days of history allowed</label>
            <Input
              type="number" min={1} max={3650}
              className="h-7 w-24 text-xs"
              value={form.historicalTicketDays}
              onChange={(e) => set('historicalTicketDays', Math.max(1, Number(e.target.value)))}
            />
          </div>
        )}
      </div>

      {/* Visibility */}
      <div className="rounded-md border border-border p-3 space-y-0.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Visibility of Other Users' Tickets</p>
        <SwitchRow label="View others' Open tickets"        desc="Covers Open and Pending Client statuses"
          checked={form.canViewOthersOpen}        onChange={(v) => set('canViewOthersOpen', v)} />
        <SwitchRow label="View others' In Progress tickets" desc="Tickets currently being worked on"
          checked={form.canViewOthersInProgress}  onChange={(v) => set('canViewOthersInProgress', v)} />
        <SwitchRow label="View others' Resolved tickets"
          checked={form.canViewOthersResolved}    onChange={(v) => set('canViewOthersResolved', v)} />
        <SwitchRow label="View others' Closed tickets"
          checked={form.canViewOthersClosed}      onChange={(v) => set('canViewOthersClosed', v)} />
      </div>

      {/* Actions */}
      <div className="rounded-md border border-border p-3 space-y-0.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ticket Actions</p>
        <SwitchRow label="Create tickets"          checked={form.canCreateTickets} onChange={(v) => set('canCreateTickets', v)} />
        <SwitchRow label="Assign tickets"          checked={form.canAssignTickets} onChange={(v) => set('canAssignTickets', v)} />
        <SwitchRow label="Update ticket details"   checked={form.canUpdateTickets} onChange={(v) => set('canUpdateTickets', v)} />
        <SwitchRow label="Close / Resolve tickets" checked={form.canCloseTickets}  onChange={(v) => set('canCloseTickets', v)} />
      </div>

      {/* System Changes */}
      <div className="rounded-md border border-border p-3 space-y-0.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">System Changes</p>
        <SwitchRow label="View System Changes"   desc="Can access the System Change Tracker"
          checked={form.canViewSystemChanges}   onChange={(v) => set('canViewSystemChanges', v)} />
        <SwitchRow label="Manage System Changes" desc="Can create, edit, and delete system change entries"
          checked={form.canManageSystemChanges} onChange={(v) => set('canManageSystemChanges', v)} />
      </div>

      {/* Bank restriction */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Access Restriction</p>
        <p className="text-xs text-muted-foreground">Select specific banks to restrict access to. Leave all unchecked to allow all banks.</p>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {BANKS.map((bank) => (
            <button
              key={bank} type="button" onClick={() => toggleBank(bank)}
              className={cn(
                'text-xs px-2 py-1.5 rounded border text-left transition-colors',
                form.allowedBanks.includes(bank)
                  ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                  : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {form.allowedBanks.includes(bank) ? '✓ ' : ''}{bank}
            </button>
          ))}
        </div>
        {form.allowedBanks.length === 0 && (
          <p className="text-[11px] text-success">All banks accessible</p>
        )}
      </div>
    </>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function PermissionsView() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'role' | 'user'>('role');
  const [dialogOpen, setDialogOpen]  = useState(false);
  const [editingId, setEditingId]    = useState<number | null>(null);
  const [form, setForm]              = useState<PermFormState>(emptyForm());
  const [saving, setSaving]          = useState(false);
  const [error, setError]            = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RolePermission | null>(null);
  const [userSearch, setUserSearch]  = useState('');

  const { data: permissions = [], isLoading } = useQuery<RolePermission[]>({
    queryKey: ['permissions'],
    queryFn: () => api.getPermissions(),
  });

  const { data: allUsers = [] } = useQuery<AppUser[]>({
    queryKey: ['admin-users'],
    queryFn: api.getAdminUsers as () => Promise<AppUser[]>,
  });

  const rolePerms = permissions.filter((p) => !p.userId);
  const userPerms = permissions.filter((p) => !!p.userId);

  const filteredUsers = userSearch.trim()
    ? allUsers.filter((u) =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
      )
    : allUsers;

  const set = <K extends keyof PermFormState>(key: K, val: PermFormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const toggleBank = (bank: string) =>
    setForm((f) => ({
      ...f,
      allowedBanks: f.allowedBanks.includes(bank)
        ? f.allowedBanks.filter((b) => b !== bank)
        : [...f.allowedBanks, bank],
    }));

  const openCreate = (scope: 'role' | 'user') => {
    setEditingId(null);
    setForm(emptyForm(scope));
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (p: RolePermission) => {
    setEditingId(p.id);
    setForm(fromPerm(p));
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        role: form.role,
        canViewHistoricalTickets: form.canViewHistoricalTickets,
        historicalTicketDays: form.historicalTicketDays,
        allowedBanks: form.allowedBanks.length > 0 ? form.allowedBanks : null,
        canViewOthersOpen: form.canViewOthersOpen,
        canViewOthersInProgress: form.canViewOthersInProgress,
        canViewOthersResolved: form.canViewOthersResolved,
        canViewOthersClosed: form.canViewOthersClosed,
        canCreateTickets: form.canCreateTickets,
        canAssignTickets: form.canAssignTickets,
        canUpdateTickets: form.canUpdateTickets,
        canCloseTickets: form.canCloseTickets,
        canViewSystemChanges: form.canViewSystemChanges,
        canManageSystemChanges: form.canManageSystemChanges,
      };

      if (form.scope === 'user') {
        if (!form.userId) { setError('Please select a user.'); setSaving(false); return; }
        payload.userId = Number(form.userId);
      } else {
        payload.department = form.department || null;
      }

      await api.upsertPermission(payload as Parameters<typeof api.upsertPermission>[0]);
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setDialogOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deletePermission(deleteTarget.id);
    queryClient.invalidateQueries({ queryKey: ['permissions'] });
    setDeleteTarget(null);
  };

  // Selected user's name for display
  const selectedUserObj = form.userId
    ? allUsers.find((u) => String(u.id) === form.userId)
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permission Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure access by role/department <em>or</em> override for a specific user.
            User-level rules take highest priority.
          </p>
        </div>
        <Button size="sm" onClick={() => openCreate(activeTab)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Rule
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { id: 'role' as const, label: `Role / Department (${rolePerms.length})` },
          { id: 'user' as const, label: `Per User (${userPerms.length})` },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* ── Role / Dept tab ── */}
          {activeTab === 'role' && (
            <div className="space-y-3">
              {rolePerms.length === 0 ? (
                <div className="py-14 text-center space-y-3">
                  <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">No role-level rules yet.</p>
                  <Button size="sm" variant="outline" onClick={() => openCreate('role')}>Create First Rule</Button>
                </div>
              ) : rolePerms.map((perm) => (
                <div key={perm.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                        perm.role === 'inorins' ? 'bg-secondary/10' : 'bg-info/10'
                      )}>
                        <ShieldCheck className={cn('h-4 w-4', perm.role === 'inorins' ? 'text-secondary' : 'text-info')} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {perm.role === 'inorins' ? 'Staff' : 'Client'} Role
                          </span>
                          {perm.department ? (
                            <span className="text-xs bg-muted border border-border px-2 py-0.5 rounded text-muted-foreground">
                              {perm.department} dept.
                            </span>
                          ) : (
                            <span className="text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-primary">Default</span>
                          )}
                        </div>
                        <PermSummary perm={perm} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(perm)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(perm)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Per User tab ── */}
          {activeTab === 'user' && (
            <div className="space-y-3">
              {userPerms.length === 0 ? (
                <div className="py-14 text-center space-y-3">
                  <User className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">No user-specific overrides yet.</p>
                  <Button size="sm" variant="outline" onClick={() => openCreate('user')}>Add User Override</Button>
                </div>
              ) : userPerms.map((perm) => (
                <div key={perm.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{perm.userName ?? 'Unknown User'}</span>
                          <span className="text-xs text-muted-foreground">{perm.userEmail}</span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded border font-medium',
                            perm.role === 'inorins' ? 'bg-secondary/10 border-secondary/20 text-secondary' : 'bg-info/10 border-info/20 text-info'
                          )}>
                            {perm.role === 'inorins' ? 'Staff' : 'Client'}
                          </span>
                          <span className="text-[10px] bg-warning/10 border border-warning/20 text-warning px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">
                            User Override
                          </span>
                        </div>
                        <PermSummary perm={perm} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(perm)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(perm)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Permission Rule' : form.scope === 'user' ? 'New User Override' : 'New Role Rule'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">

            {/* Scope toggle (only when creating) */}
            {!editingId && (
              <div className="flex rounded-md border border-border overflow-hidden text-sm font-medium">
                {(['role', 'user'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(emptyForm(s, form.role))}
                    className={cn(
                      'flex-1 py-2 transition-colors',
                      form.scope === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {s === 'role' ? 'Role / Department' : 'Specific User'}
                  </button>
                ))}
              </div>
            )}

            {/* Role-scoped fields */}
            {form.scope === 'role' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Role <span className="text-primary">*</span></label>
                  <Select value={form.role} onValueChange={(v) => set('role', v as 'inorins' | 'client')}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inorins">Staff (inorins)</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Department <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Select value={form.department} onValueChange={(v) => set('department', v === '_all' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All departments (default)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All departments (default)</SelectItem>
                      {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* User-scoped fields */}
            {form.scope === 'user' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Select User <span className="text-primary">*</span></label>
                  {selectedUserObj ? (
                    <div className="flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5">
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {selectedUserObj.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{selectedUserObj.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedUserObj.email}</p>
                      </div>
                      <button onClick={() => set('userId', '')} className="text-xs text-muted-foreground hover:text-destructive shrink-0">
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder="Search by name or email…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <div className="max-h-44 overflow-y-auto rounded-md border border-border divide-y divide-border">
                        {filteredUsers.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3 text-center">No users found.</p>
                        ) : filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              set('userId', String(u.id));
                              set('role', (u.role as 'inorins' | 'client') ?? 'inorins');
                              setUserSearch('');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left transition-colors"
                          >
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <span className={cn('text-[10px] font-medium shrink-0',
                              u.role === 'inorins' ? 'text-secondary' : 'text-info'
                            )}>
                              {u.role === 'inorins' ? 'Staff' : 'Client'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Role selector still needed for user-scoped (in case override differs from user's actual role) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Role Context</label>
                  <Select value={form.role} onValueChange={(v) => set('role', v as 'inorins' | 'client')}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inorins">Staff (inorins)</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Set to match the user's role.</p>
                </div>
              </div>
            )}

            {/* Shared permission toggles */}
            <PermToggles form={form} set={set} toggleBank={toggleBank} />

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Permission Rule</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              {deleteTarget.userId
                ? <>Remove user override for <strong>{deleteTarget.userName}</strong>?</>
                : <>Remove the <strong>{deleteTarget.role === 'inorins' ? 'Staff' : 'Client'}</strong>
                    {deleteTarget.department ? ` / ${deleteTarget.department}` : ' default'} rule?</>
              }
            </p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
