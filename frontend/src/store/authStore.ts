import { create } from 'zustand';

export const AUTH_TOKEN_KEY = 'auth_token';

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: readStoredToken(),
  setToken: (token) => {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    set({ token: null });
  },
  isAuthenticated: () => !!get().token,
}));
