import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUser } from '@/types';
import { uploadUrl, DEFAULT_AVATAR } from '@/utils/api';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  login:       (user: AuthUser, token: string, isAdmin: boolean) => void;
  logout:      () => void;
  refreshUser: (user: AuthUser) => void;
  avatarUrl:   string;
}

// ─── Context ───────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(): AuthState {
  const token   = localStorage.getItem('shotzoo_token');
  const isAdmin = localStorage.getItem('shotzoo_admin') === 'true';
  try {
    const raw  = localStorage.getItem('shotzoo_user');
    const user = raw ? (JSON.parse(raw) as AuthUser) : null;
    return { user, token, isAdmin };
  } catch {
    return { user: null, token: null, isAdmin: false };
  }
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readStorage);

  const login = useCallback((user: AuthUser, token: string, isAdmin: boolean) => {
    localStorage.setItem('shotzoo_token',  token);
    localStorage.setItem('shotzoo_user',   JSON.stringify(user));
    localStorage.setItem('shotzoo_admin',  String(isAdmin));
    setState({ user, token, isAdmin });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('shotzoo_token');
    localStorage.removeItem('shotzoo_user');
    localStorage.removeItem('shotzoo_admin');
    localStorage.removeItem('shotzoo_photo_v');
    setState({ user: null, token: null, isAdmin: false });
  }, []);

  const refreshUser = useCallback((user: AuthUser) => {
    localStorage.setItem('shotzoo_user', JSON.stringify(user));
    if (user.photo) localStorage.setItem('shotzoo_photo_v', Date.now().toString());
    setState(prev => ({ ...prev, user }));
  }, []);

  const avatarUrl = state.user?.photo
    ? uploadUrl(state.user.photo)
    : DEFAULT_AVATAR;

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser, avatarUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
