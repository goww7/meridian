import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthState {
  token: string | null;
  user: { id: string; email: string; name: string } | null;
  org: { id: string; name: string; slug: string } | null;
  login: (token: string, user: AuthState['user'], org: AuthState['org']) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('meridian_token'));
  const [user, setUser] = useState<AuthState['user']>(() => {
    const stored = localStorage.getItem('meridian_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [org, setOrg] = useState<AuthState['org']>(() => {
    const stored = localStorage.getItem('meridian_org');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback((t: string, u: AuthState['user'], o: AuthState['org']) => {
    localStorage.setItem('meridian_token', t);
    localStorage.setItem('meridian_user', JSON.stringify(u));
    localStorage.setItem('meridian_org', JSON.stringify(o));
    setToken(t);
    setUser(u);
    setOrg(o);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('meridian_token');
    localStorage.removeItem('meridian_user');
    localStorage.removeItem('meridian_org');
    setToken(null);
    setUser(null);
    setOrg(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, org, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
