import { useState } from 'react';
import { KeyRound, User, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

export function SettingsView() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Profile</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Name</p>
            <p className="text-sm font-medium text-foreground">{user?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Role</p>
            <p className="text-sm font-medium text-foreground capitalize">{user?.title ?? user?.role}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* Password Change */}
      <section className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>

          {pwError && (
            <p className="text-xs text-primary font-medium">{pwError}</p>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-success font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Password changed successfully.
            </div>
          )}

          <div className="pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className={cn(isSaving && 'opacity-70')}
            >
              {isSaving ? 'Saving…' : 'Update Password'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
