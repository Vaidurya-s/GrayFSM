import { create } from 'zustand';
import { authAPI, AuthUser } from '../api/endpoints/auth';

const TOKEN_KEY = 'auth_token';
// Cache the user record alongside the token so the navbar stays populated
// across reloads and transient /auth/me failures (502/timeout). Without
// this, a single hiccup would leave the UI in a "half-logged-out" state:
// isAuthenticated stayed true (token present), but `user` was null because
// /auth/me failed before we could populate it.
const USER_KEY = 'auth_user';

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    /* localStorage unavailable — fine */
  }
}

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
  user: readCachedUser(),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  loading: false,

  login: async (email, password) => {
    const res = await authAPI.login(email, password);
    const token = res.data.access_token;
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, isAuthenticated: true });
    const me = await authAPI.me();
    writeCachedUser(me.data);
    set({ user: me.data });
  },

  register: async (email, password) => {
    const res = await authAPI.register(email, password);
    const token = res.data.access_token;
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, isAuthenticated: true });
    const me = await authAPI.me();
    writeCachedUser(me.data);
    set({ user: me.data });
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch {
      // Best-effort server-side blacklist; clear locally regardless.
    }
    localStorage.removeItem(TOKEN_KEY);
    writeCachedUser(null);
    set({ token: null, user: null, isAuthenticated: false });
  },

  init: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    set({ loading: true });
    try {
      const me = await authAPI.me();
      writeCachedUser(me.data);
      set({ token, user: me.data, isAuthenticated: true });
    } catch (err) {
      // Only 401/403 means "session expired" — drop everything.
      // Transient backend errors (502/503/timeout/network) MUST preserve
      // both the token AND the cached user, otherwise a single hiccup
      // leaves the navbar half-logged-out (no email, but LOGOUT visible).
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        writeCachedUser(null);
        set({ token: null, user: null, isAuthenticated: false });
      } else {
        // Preserve cached user explicitly so a subsequent re-init (or any
        // selector reading `user`) sees the last known good record.
        set({ token, user: readCachedUser(), isAuthenticated: true });
      }
    } finally {
      set({ loading: false });
    }
  },
}));
