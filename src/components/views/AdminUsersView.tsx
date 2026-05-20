import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, Plus, Pencil, KeyRound, UserX, UserCheck, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import type { AppUser } from '@/data/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type UserWithActive = AppUser & { isActive?: boolean };

type DialogMode = 'create' | 'edit' | 'reset-password' | null;

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: 'inorins' | 'client';
  title: string;
  bankName: string;
  bankDomain: string;
  bankShortCode: string;
}

const emptyForm: UserFormState = {
  name: '', email: '', password: '', role: 'client',
  title: '', bankName: '', bankDomain: '', bankShortCode: '',
};

export function AdminUsersView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'all' | 'staff' | 'clients'>('all');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithActive | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: api.getAdminUsers as () => Promise<UserWithActive[]>,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const createMutation = useMutation({
    mutationFn: (data: UserFormState) => api.createUser(data),
    onSuccess: () => { invalidate(); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormState> }) => api.updateUser(id, data),
    onSuccess: () => { invalidate(); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => api.resetUserPassword(id, password),
    onSuccess: () => { invalidate(); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.deactivateUser(id),
    onSuccess: invalidate,
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.updateUser(id, { isActive: true }),
    onSuccess: invalidate,
  });

  function openCreate() {
    setForm(emptyForm);
    setError('');
    setDialogMode('create');
  }

  function openEdit(u: UserWithActive) {
    setSelectedUser(u);
    setForm({
      name: u.name, email: u.email, password: '',
      role: u.role as 'inorins' | 'client',
      title: u.title ?? '',
      bankName: u.bankName ?? '',
      bankDomain: u.bankDomain ?? '',
      bankShortCode: u.bankShortCode ?? '',
    });
    setError('');
    setDialogMode('edit');
  }

  function openResetPassword(u: UserWithActive) {
    setSelectedUser(u);
    setNewPassword('');
    setError('');
    setDialogMode('reset-password');
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedUser(null);
    setError('');
  }

  function handleSubmit() {
    setError('');
    if (dialogMode === 'create') {
      createMutation.mutate(form);
    } else if (dialogMode === 'edit' && selectedUser) {
      const { password, ...rest } = form;
      updateMutation.mutate({ id: selectedUser.id, data: rest });
    } else if (dialogMode === 'reset-password' && selectedUser) {
      resetPasswordMutation.mutate({ id: selectedUser.id, password: newPassword });
    }
  }

  const filtered = users.filter((u) => {
    if (tab === 'staff') return u.role === 'inorins';
    if (tab === 'clients') return u.role === 'client';
    return true;
  });

  const isBusy = createMutation.isPending || updateMutation.isPending || resetPasswordMutation.isPending;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">User Management</h1>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All ({users.length})</TabsTrigger>
          <TabsTrigger value="staff">Staff ({users.filter((u) => u.role === 'inorins').length})</TabsTrigger>
          <TabsTrigger value="clients">Clients ({users.filter((u) => u.role === 'client').length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading users…
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Title / Bank</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u) => (
                <tr key={u.id} className={cn('hover:bg-muted/30', u.isActive === false && 'opacity-50')}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === 'inorins' ? 'default' : 'secondary'}>
                      {u.role === 'inorins' ? 'Staff' : 'Client'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.role === 'client' ? (u.bankName ?? '—') : (u.title ?? '—')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium', u.isActive === false ? 'text-destructive' : 'text-green-600')}>
                      {u.isActive === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEdit(u)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset Password" onClick={() => openResetPassword(u)}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      {u.isActive === false ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Reactivate" onClick={() => reactivateMutation.mutate(u.id)}>
                          <UserCheck className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Deactivate" onClick={() => deactivateMutation.mutate(u.id)}>
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogMode === 'create' || dialogMode === 'edit'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Add New User' : 'Edit User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as 'inorins' | 'client' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inorins">Staff</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
            </div>
            {dialogMode === 'create' && (
              <div className="space-y-1">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Title / Designation</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Support Engineer" />
            </div>
            {form.role === 'client' && (
              <>
                <div className="space-y-1">
                  <Label>Bank Name</Label>
                  <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Guheshwori Bank" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Email Domain</Label>
                    <Input value={form.bankDomain} onChange={(e) => setForm({ ...form, bankDomain: e.target.value })} placeholder="guheshwori.com.np" />
                  </div>
                  <div className="space-y-1">
                    <Label>Short Code</Label>
                    <Input value={form.bankShortCode} onChange={(e) => setForm({ ...form, bankShortCode: e.target.value })} placeholder="GHW" />
                  </div>
                </div>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isBusy}>
              {isBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {dialogMode === 'create' ? 'Create User' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={dialogMode === 'reset-password'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password — {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
