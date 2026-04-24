'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  profileId: string;
};

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' };

type AuthContext = {
  state: AuthState;
  user: AuthUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const json = await res.json();
      if (json.ok) {
        setState({ status: 'authenticated', user: json.data as AuthUser });
      } else {
        setState({ status: 'unauthenticated' });
      }
    } catch {
      setState({ status: 'unauthenticated' });
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ status: 'unauthenticated' });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const user = state.status === 'authenticated' ? state.user : null;
  const isLoading = state.status === 'loading';

  return (
    <Ctx.Provider value={{ state, user, isLoading, refresh, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
