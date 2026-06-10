import { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken, SESSION_EXPIRED_EVENT, NETWORK_ERROR_EVENT } from '@/services/api';
import type { AuthUser } from '@/services/api';

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: (reason?: string) => void;
  isLoading: boolean;
  logoutReason: string | null;
  clearLogoutReason: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => ({ success: false }),
  logout: (_reason?: string) => {},
  isLoading: true,
  logoutReason: null,
  clearLogoutReason: () => {},
});

const STORAGE_KEY = 'inorins_user_id';
export const LOGOUT_REASON_KEY = 'inorins_logout_reason';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoutReason, setLogoutReason] = useState<string | null>(
    () => localStorage.getItem(LOGOUT_REASON_KEY),
  );

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

  const clearLogoutReason = () => {
    setLogoutReason(null);
    localStorage.removeItem(LOGOUT_REASON_KEY);
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const found = await api.login(email, password);
      setUser(found);
      setLogoutReason(null);
      localStorage.setItem(STORAGE_KEY, found.id);
      localStorage.removeItem(LOGOUT_REASON_KEY);
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
    if (typeof reason === 'string' && reason) {
      setLogoutReason(reason);
      localStorage.setItem(LOGOUT_REASON_KEY, reason);
    }
  };

  // Auto-logout when the server rejects the token (expired or revoked)
  useEffect(() => {
    function handleExpired() {
      logout('Your session has expired. Please log in again.');
    }
    function handleNetworkError() {
      logout('You were signed out because the server could not be reached (Failed to fetch). Please check your connection and sign in again.');
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    window.addEventListener(NETWORK_ERROR_EVENT, handleNetworkError);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
      window.removeEventListener(NETWORK_ERROR_EVENT, handleNetworkError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, logoutReason, clearLogoutReason }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
