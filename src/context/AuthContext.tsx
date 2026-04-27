import { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from '@/services/api';
import type { AuthUser } from '@/services/api';

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => ({ success: false }),
  logout: () => {},
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

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
