import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, Monitor } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme, type Theme } from '../providers/theme-context';
import { cn } from '../../utils/cn';

/* -------------------------------------------------------------------------- *
 * Navbar — datasheet-aesthetic top chrome.                                   *
 * -------------------------------------------------------------------------- *
 * Brand mark in mono uppercase tracking, current-page indicated by an        *
 * accent bottom rule, theme toggle as a single icon-only square. No          *
 * rounded corners. No shadows. Hairline rule under the bar.                  *
 * -------------------------------------------------------------------------- */

const NAV_LINKS: { to: string; label: string }[] = [
  { to: ROUTES.HOME, label: 'Catalog' },
  { to: ROUTES.EDITOR, label: 'Editor' },
  { to: ROUTES.GALLERY, label: 'Gallery' },
  { to: ROUTES.EXAMPLES, label: 'Examples' },
  { to: ROUTES.ABOUT, label: 'About' },
];

const THEME_ORDER: Theme[] = ['light', 'dark', 'system'];

const THEME_ICON: Record<Theme, React.ReactNode> = {
  light: <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />,
  dark: <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />,
  system: <Monitor className="h-3.5 w-3.5" strokeWidth={1.5} />,
};

const THEME_LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const buildHash: string =
  typeof import.meta.env.VITE_BUILD_HASH === 'string'
    ? import.meta.env.VITE_BUILD_HASH
    : 'dev';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const { theme, setTheme } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.HOME);
  };

  // Close the mobile drawer on every route change. Without this, navigating
  // via the drawer leaves it open over the next page; navigating via any
  // other means (back/forward, in-page link) leaves it stuck open too.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, setMobileMenuOpen]);

  const isActive = (path: string): boolean => {
    if (path === ROUTES.HOME) return location.pathname === ROUTES.HOME;
    return location.pathname.startsWith(path);
  };

  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    setTheme(next);
  };

  return (
    <nav
      // z-50 so any in-page absolute element (e.g. the editor sidebar) can
      // never cover the navbar controls (theme toggle, NEW, logout).
      className="bg-paper border-b border-ink sticky top-0 z-50"
      data-testid="navbar"
    >
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center h-12 gap-4">
          {/* Brand */}
          <Link
            to={ROUTES.HOME}
            className="font-mono font-bold uppercase tracking-[0.18em] text-ink hover:text-accent transition-colors"
            data-testid="navbar-logo"
            aria-label="GrayFSM home"
          >
            GrayFSM
            <span className="text-accent mx-1.5" aria-hidden>·</span>
            <span className="font-medium text-ink-faint tracking-[0.12em] text-[0.72rem]">
              v1.0
            </span>
          </Link>

          {/* Center nav (desktop) */}
          <div className="hidden md:flex items-center justify-center gap-7 self-stretch">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  data-testid={`nav-link-${link.label.toLowerCase()}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center self-stretch px-1',
                    'font-mono text-[0.78rem] uppercase tracking-[0.12em]',
                    'border-b-2 -mb-[1px] transition-colors',
                    active
                      ? 'text-ink border-accent'
                      : 'text-ink-soft border-transparent hover:text-ink hover:border-rule-strong',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right meta + actions (desktop) */}
          <div className="hidden md:flex items-center gap-4">
            {/* Build hash — informational only; styled as muted text so it
                doesn't read as a link. */}
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint select-text">
              build <span className="text-ink-soft">{buildHash}</span>
            </span>

            <button
              type="button"
              onClick={cycleTheme}
              title={`Theme: ${THEME_LABEL[theme]} — click to cycle`}
              aria-label={`Switch theme (current: ${THEME_LABEL[theme]})`}
              className={cn(
                'inline-flex items-center justify-center h-7 w-7',
                // text-ink (not ink-soft) so the icon stays readable in dark
                // mode where ink-soft renders near the muted navbar grey.
                'border border-rule-strong text-ink',
                'hover:border-ink hover:bg-paper-shade',
                'focus-ring transition-colors',
              )}
              data-testid="theme-toggle"
            >
              {THEME_ICON[theme]}
            </button>

            <Link
              to={ROUTES.EDITOR_NEW}
              data-testid="nav-new-fsm"
              className={cn(
                'inline-flex items-center font-mono font-medium uppercase',
                'text-[0.72rem] tracking-[0.1em] no-underline',
                'border border-ink bg-accent text-paper',
                'px-3 py-1.5 transition-colors',
                'hover:bg-ink hover:text-paper focus-ring',
              )}
            >
              <span className="mr-1.5">↳</span>New
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {user?.email && (
                  <span
                    className="font-mono text-[0.7rem] text-ink-soft max-w-[12ch] truncate"
                    title={user.email}
                  >
                    {user.email}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  data-testid="nav-logout"
                  className="font-mono font-medium uppercase text-[0.72rem] tracking-[0.1em] border border-rule-strong text-ink-soft hover:border-ink hover:text-ink px-3 py-1.5 transition-colors focus-ring"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to={ROUTES.LOGIN}
                data-testid="nav-login"
                className="font-mono font-medium uppercase text-[0.72rem] tracking-[0.1em] no-underline border border-rule-strong text-ink-soft hover:border-ink hover:text-ink px-3 py-1.5 transition-colors focus-ring"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-1">
            <button
              type="button"
              onClick={cycleTheme}
              title={`Theme: ${THEME_LABEL[theme]}`}
              aria-label={`Switch theme (current: ${THEME_LABEL[theme]})`}
              className="inline-flex items-center justify-center h-8 w-8 text-ink-soft hover:text-ink hover:bg-paper-shade focus-ring transition-colors"
              data-testid="theme-toggle-mobile"
            >
              {THEME_ICON[theme]}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              className="inline-flex items-center justify-center h-8 w-8 text-ink-soft hover:text-ink hover:bg-paper-shade focus-ring transition-colors"
              data-testid="mobile-menu-button"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-t border-rule bg-paper"
          data-testid="mobile-menu"
        >
          <div className="px-2 py-2 space-y-0">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block px-3 py-2.5 font-mono text-[0.82rem] uppercase tracking-[0.12em]',
                    'border-b border-rule transition-colors',
                    active
                      ? 'text-ink bg-accent-tint'
                      : 'text-ink-soft hover:text-ink hover:bg-paper-shade',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              to={ROUTES.EDITOR_NEW}
              onClick={() => setMobileMenuOpen(false)}
              className="block mt-2 px-3 py-2.5 text-center font-mono text-[0.82rem] uppercase tracking-[0.1em] bg-accent text-paper border border-ink"
            >
              ↳ New FSM
            </Link>

            {/* Auth row — sign-in link or logout button so authenticated
                state isn't trapped on the desktop-only right cluster. */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                data-testid="nav-logout-mobile"
                className="block w-full px-3 py-2.5 border-t border-rule font-mono text-xs uppercase tracking-[0.15em] text-ink-soft text-left hover:bg-paper-shade hover:text-ink transition-colors"
              >
                Logout
                {user?.email && (
                  <span className="ml-2 text-ink-faint normal-case tracking-normal text-[0.7rem]">
                    ({user.email})
                  </span>
                )}
              </button>
            ) : (
              <Link
                to={ROUTES.LOGIN}
                onClick={() => setMobileMenuOpen(false)}
                data-testid="nav-login-mobile"
                className="block w-full px-3 py-2.5 border-t border-rule font-mono text-xs uppercase tracking-[0.15em] text-ink-soft text-left hover:bg-paper-shade hover:text-ink transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
