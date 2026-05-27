import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Monitor } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { authAPI } from '../../api/endpoints/auth';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
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
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const { theme, setTheme } = useTheme();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await authAPI.logout();
    logout();
    setMobileMenuOpen(false);
  };

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
      className="bg-paper border-b border-ink sticky top-0 z-30"
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
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
              build <span className="text-accent">{buildHash}</span>
            </span>

            <button
              type="button"
              onClick={cycleTheme}
              title={`Theme: ${THEME_LABEL[theme]} — click to cycle`}
              aria-label={`Switch theme (current: ${THEME_LABEL[theme]})`}
              className={cn(
                'inline-flex items-center justify-center h-7 w-7',
                'border border-rule-strong text-ink-soft',
                'hover:border-ink hover:text-ink',
                'focus-ring transition-colors',
              )}
              data-testid="theme-toggle"
            >
              {THEME_ICON[theme]}
            </button>

            {token ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="font-mono text-[0.72rem] uppercase tracking-[0.1em] text-ink-soft hover:text-ink transition-colors"
                data-testid="nav-logout"
              >
                Sign out
              </button>
            ) : (
              <Link
                to={ROUTES.LOGIN}
                className="font-mono text-[0.72rem] uppercase tracking-[0.1em] text-ink-soft hover:text-accent transition-colors"
                data-testid="nav-login"
              >
                Sign in
              </Link>
            )}

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
            {token ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="block w-full text-left px-3 py-2.5 font-mono text-[0.82rem] uppercase tracking-[0.12em] text-ink-soft hover:text-ink hover:bg-paper-shade border-b border-rule"
              >
                Sign out
              </button>
            ) : (
              <Link
                to={ROUTES.LOGIN}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 font-mono text-[0.82rem] uppercase tracking-[0.12em] text-ink-soft hover:text-ink hover:bg-paper-shade border-b border-rule"
              >
                Sign in
              </Link>
            )}
            <Link
              to={ROUTES.EDITOR_NEW}
              onClick={() => setMobileMenuOpen(false)}
              className="block mt-2 px-3 py-2.5 text-center font-mono text-[0.82rem] uppercase tracking-[0.1em] bg-accent text-paper border border-ink"
            >
              ↳ New FSM
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
