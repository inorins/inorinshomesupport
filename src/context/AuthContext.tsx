import { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken, SESSION_EXPIRED_EVENT } from '@/services/api';
import type { AuthUser } from '@/services/api';
import { toast } from 'sonner';

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: (reason?: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => ({ success: false }),
  logout: (_reason?: string) => {},
  isLoading: true,
});

const STORAGE_KEY = 'inorins_user_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreUser = async () => {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (!savedId) {
        setIsLoading(false);
        return;
      }

      try {
        const restored = await api.getUser(savedId);
        setUser(restored);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void restoreUser();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const found = await api.login(email, password);
      setUser(found);
      localStorage.setItem(STORAGE_KEY, found.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid email or password.',
      };
    }
  };

  const logout = (reason?: string) => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    if (typeof reason === 'string' && reason) toast.warning(reason);
  };

  // Auto-logout when the server rejects the token (expired or revoked)
  useEffect(() => {
    function handleExpired() {
      logout('Your session has expired. Please log in again.');
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
