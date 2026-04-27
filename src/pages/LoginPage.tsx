import { useEffect, useMemo, useState } from 'react';
import { Shield, Building2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import type { AuthUser } from '@/services/api';

export function LoginPage() {
  const { login } = useAuth();
  const [demoUsers, setDemoUsers] = useState<AuthUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await api.getDemoUsers();
        setDemoUsers(users);
      } catch {
        setDemoUsers([]);
      }
    };

    void loadUsers();
  }, []);

  const inorinsUsers = useMemo(
    () => demoUsers.filter((user) => user.role === 'inorins'),
    [demoUsers],
  );

  const clientUsers = useMemo(
    () => demoUsers.filter((user) => user.role === 'client'),
    [demoUsers],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 400)); // brief loading feel
    const result = await login(email.trim(), password);
    setIsLoading(false);
    if (!result.success) setError(result.error ?? 'Login failed.');
  };

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Left – Branding Panel */}
      <div className="hidden lg:flex w-[420px] shrink-0 bg-sidebar flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <Shield className="h-9 w-9 text-sidebar-primary" />
            <div>
              <p className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">Inorins</p>
              <p className="text-[10px] font-semibold text-sidebar-foreground tracking-widest uppercase">Technologies</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-sidebar-accent-foreground leading-tight mb-4">
            Unified Support<br />Portal
          </h1>
          <p className="text-sm text-sidebar-foreground leading-relaxed mb-8">
            One platform for Inorins support teams and client banks to collaborate, track issues, and resolve them — fast.
          </p>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/60 mb-3">
              Client Banks
            </p>
            {clientUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5 py-1.5">
                <div className="h-7 w-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 text-sidebar-primary" />
                </div>
                <span className="text-sm text-sidebar-foreground">{u.bankName}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/40">
          © {new Date().getFullYear()} Inorins Technologies. All rights reserved.
        </p>
      </div>

      {/* Right – Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile brand */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <Shield className="h-7 w-7 text-primary" />
          <span className="font-bold text-foreground text-lg">Inorins Technologies</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your support portal account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
{/*Uncomment this when testing so you can get list of demo users */}
          {/* Quick login section
         <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">Demo Quick Login</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-4">
              {/* Inorins Team *//*
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inorins Team</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {inorinsUsers.map((u) => (
                    <QuickLoginCard key={u.id} user={u} onSelect={quickLogin} />
                  ))}
                </div>
              </div>

              {/* Client Banks *//*
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-3.5 w-3.5 text-info" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Banks</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {clientUsers.map((u) => (
                    <QuickLoginCard key={u.id} user={u} onSelect={quickLogin} />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              All demo accounts use password: <span className="font-mono font-semibold">{DEMO_PASSWORD}</span>
            </p>
          </div>
         */}
        </div>
      </div>
    </div>
  );
}

 {/*function QuickLoginCard({ user, onSelect }: { user: AuthUser; onSelect: (u: AuthUser) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-left transition-colors',
        'bg-card border-border hover:bg-accent hover:border-primary/30 text-sm'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
          user.role === 'inorins' ? 'bg-secondary/20 text-secondary' : 'bg-info/20 text-info'
        )}>
          {user.role === 'inorins' ? user.name[0] : user.bankShortCode}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate text-xs leading-tight">
            {user.role === 'inorins' ? user.name : user.bankName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{user.title}</p>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </button>
  );
}*/}
