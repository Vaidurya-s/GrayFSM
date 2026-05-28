import { create } from 'zustand';
import { authAPI, AuthUser } from '../api/endpoints/auth';

const TOKEN_KEY = 'auth_token';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Restore session on app load from a persisted token.
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  loading: false,

  login: async (email, password) => {
    const res = await authAPI.login(email, password);
    const token = res.data.access_token;
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, isAuthenticated: true });
    const me = await authAPI.me();
    set({ user: me.data });
  },

  register: async (email, password) => {
    const res = await authAPI.register(email, password);
    const token = res.data.access_token;
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, isAuthenticated: true });
    const me = await authAPI.me();
    set({ user: me.data });
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch {
      // Best-effort server-side blacklist; clear locally regardless.
    }
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  init: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    set({ loading: true });
    try {
      const me = await authAPI.me();
      set({ token, user: me.data, isAuthenticated: true });
    } catch (err) {
      // Only treat 401/403 as "session expired" and drop the token.
      // Transient backend errors (502/503/timeout/network) must NOT log the
      // user out — a single hiccup would otherwise wipe an authenticated
      // session and force re-login. We keep the token + last known auth
      // state so the next request can succeed when the backend recovers.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null, isAuthenticated: false });
      } else {
        set({ token, isAuthenticated: true });
      }
    } finally {
      set({ loading: false });
    }
  },
}));
