import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { CommandKey, CommandKeyRow } from '../components/ui';

/* -------------------------------------------------------------------------- *
 * NotFoundPage — terminal-austere "ERR.404" treatment.                       *
 * -------------------------------------------------------------------------- *
 * Holds the same datasheet voice as the rest of the app: typographic only,   *
 * no decorative imagery, accent only on the error code itself. The path      *
 * being requested is echoed back as a reassurance that the URL was read.     *
 * -------------------------------------------------------------------------- */

export default function NotFoundPage() {
  const location = useLocation();
  const path = location.pathname || '/';

  return (
    <div
      className="min-h-screen bg-paper text-ink flex items-center px-4 py-12"
      data-testid="page-not-found"
    >
      <main className="max-w-[42rem] mx-auto w-full">
        {/* status code line */}
        <div className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink-faint mb-3">
          <span className="text-accent">ERR</span> · 404 · catalog
        </div>

        {/* hero — tight tracking + tabular figures so the digits sit
         *  evenly under the kicker line above. */}
        <h1 className="font-mono font-tabular font-light leading-[0.92] tracking-[-0.04em] text-[clamp(3.5rem,12vw,7rem)] text-ink mb-4">
          <span className="text-accent">404</span>
        </h1>

        {/* tagline */}
        <p className="font-sans text-2xl sm:text-3xl font-medium tracking-tight text-ink mb-2">
          Referent not in catalog.
        </p>
        <p className="font-serif italic text-ink-soft text-base sm:text-lg leading-relaxed mb-8 max-w-[36rem]">
          The path you requested is not registered against any specification
          presently held in the system. The URL was read and rejected; nothing
          in the catalog answers to that name.
        </p>

        {/* path echo */}
        <div className="border-t border-b border-rule py-3 mb-10 font-mono text-[0.85rem]">
          <span className="text-ink-faint mr-3">requested</span>
          <span className="text-ink break-all">{path}</span>
        </div>

        {/* actions */}
        <CommandKeyRow>
          <CommandKey primary keyGlyph="↳" to={ROUTES.HOME}>
            Return to catalog
          </CommandKey>
          <CommandKey keyGlyph="∅" to={ROUTES.EXAMPLES}>
            Examples
          </CommandKey>
        </CommandKeyRow>

        {/* footnote */}
        <p className="mt-12 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          <span className="text-accent">‡</span> If you arrived here from
          <span className="text-ink mx-1.5">
            <Link to={ROUTES.HOME} className="underline hover:text-accent">
              within the application
            </Link>
          </span>
          this is a defect. The catalog should never link to a missing entry.
        </p>
      </main>
    </div>
  );
}
