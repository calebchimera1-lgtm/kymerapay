import type { AuthSession, AuthUser } from '@app/shared';
import { create } from 'zustand';

export type AuthStatus = 'initializing' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Kept in memory only — never persisted — so XSS cannot lift it from storage. */
  accessToken: string | null;
  setSession: (session: AuthSession) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'initializing',
  user: null,
  accessToken: null,
  setSession: (session) =>
    set({ status: 'authenticated', user: session.user, accessToken: session.accessToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ status: 'anonymous', user: null, accessToken: null }),
}));
