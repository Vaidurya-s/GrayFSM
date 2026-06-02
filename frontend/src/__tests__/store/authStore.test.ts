/**
 * authStore.init() resilience against transient /auth/me failures.
 *
 * Pinned at fix 9039879: a single 502/timeout from /auth/me MUST NOT
 * log the user out. Only 401/403 means "session truly expired", at
 * which point both the token and the cached user are cleared.
 *
 * Before the fix, any rejection from authAPI.me dropped the token and
 * left the navbar half-logged-out — token gone, isAuthenticated
 * sometimes still true depending on which selector ran first, no
 * email shown but LOGOUT visible.
 */
import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';

vi.mock('../../api/endpoints/auth', () => ({
  authAPI: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

import { authAPI } from '../../api/endpoints/auth';
import { useAuthStore } from '../../store/authStore';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const FAKE_USER = {
  id: 'u1',
  email: 'cached@example.com',
  is_active: true,
  created_at: '2020-01-01T00:00:00Z',
};

function resetStore() {
  // Reset zustand store between tests so token from earlier tests does
  // not bleed in. Zustand has no built-in `reset` here — we restore the
  // initial shape explicitly.
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    loading: false,
  });
}

beforeEach(() => {
  vi.mocked(authAPI.me).mockReset();
  localStorage.clear();
  resetStore();
});

afterEach(() => {
  localStorage.clear();
  resetStore();
});

describe('authStore.init', () => {
  it('502 on /auth/me preserves token + cached user, keeps isAuthenticated true', async () => {
    // Seed: token + cached user already in localStorage, like a real
    // returning visitor with a still-valid session.
    localStorage.setItem(TOKEN_KEY, 'jwt-token-abc');
    localStorage.setItem(USER_KEY, JSON.stringify(FAKE_USER));
    // Force the store to re-read from localStorage by re-setting initial state.
    useAuthStore.setState({
      token: 'jwt-token-abc',
      user: FAKE_USER,
      isAuthenticated: true,
    });

    vi.mocked(authAPI.me).mockRejectedValueOnce({
      response: { status: 502 },
    });

    await useAuthStore.getState().init();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('jwt-token-abc');
    expect(state.user).toEqual(FAKE_USER);
    // Token must remain in localStorage so subsequent reqs still send it.
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-token-abc');
    expect(localStorage.getItem(USER_KEY)).toBe(JSON.stringify(FAKE_USER));
  });

  it('401 on /auth/me clears token + cached user, isAuthenticated=false', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token-expired');
    localStorage.setItem(USER_KEY, JSON.stringify(FAKE_USER));
    useAuthStore.setState({
      token: 'jwt-token-expired',
      user: FAKE_USER,
      isAuthenticated: true,
    });

    vi.mocked(authAPI.me).mockRejectedValueOnce({
      response: { status: 401 },
    });

    await useAuthStore.getState().init();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('403 on /auth/me also clears token (same severity as 401)', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-token-banned');
    localStorage.setItem(USER_KEY, JSON.stringify(FAKE_USER));
    useAuthStore.setState({
      token: 'jwt-token-banned',
      user: FAKE_USER,
      isAuthenticated: true,
    });

    vi.mocked(authAPI.me).mockRejectedValueOnce({
      response: { status: 403 },
    });

    await useAuthStore.getState().init();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('no token in storage: init is a no-op', async () => {
    // No token -> /auth/me must not be called at all.
    await useAuthStore.getState().init();
    expect(vi.mocked(authAPI.me)).not.toHaveBeenCalled();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
  });
});
