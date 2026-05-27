import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { FSM } from '../types/fsm';
import { ROUTES } from '../config/routes';
import {
  CommandKey,
  CommandKeyRow,
  DataBlock,
  Kicktitle,
  MarginalNote,
  PullFigure,
  RuledTable,
  SpecField,
  TypedSection,
  type DataItem,
  type DataTone,
  type RuledColumn,
} from '../components/ui';

/* -------------------------------------------------------------------------- *
 * HomePage — "§ 0  Catalog"                                                  *
 * -------------------------------------------------------------------------- *
 * The redesigned home view treats every FSM in the system as a               *
 * specification entry. Datasheet-brutalism aesthetic; uses the Phase-2       *
 * primitives. The data flow is unchanged from the previous HomePage:         *
 * `/fsms` for the catalog, `/health` for the live status panel.              *
 * -------------------------------------------------------------------------- */

// The axios response interceptor in api/client.ts unwraps `response.data`
// at runtime; TS still types as AxiosResponse<T>. These narrow safely.
function unwrapList<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  if (
    r &&
    typeof r === 'object' &&
    'data' in r &&
    Array.isArray((r as { data: unknown }).data)
  ) {
    return (r as { data: T[] }).data;
  }
  return [];
}

function unwrap<T>(r: unknown, fallback: T): T {
  if (r && typeof r === 'object' && 'data' in r) {
    return (r as { data: T }).data;
  }
  return ((r as T) ?? fallback);
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

interface HealthShape {
  status: string;
  message?: string;
}

export default function HomePage() {
  const [selectedFSM, setSelectedFSM] = useState<FSM | null>(null);

  const {
    data: fsms,
    isLoading,
    error,
  } = useQuery<FSM[]>({
    queryKey: ['fsms'],
    queryFn: async () => unwrapList<FSM>(await api.get('/fsms?limit=10')),
    retry: 1,
  });

  const { data: healthData } = useQuery<HealthShape>({
    queryKey: ['health'],
    queryFn: async () =>
      unwrap<HealthShape>(await api.get('/health'), { status: 'unknown' }),
    retry: 1,
  });

  // Default the spec-detail panel to the first FSM in the catalog.
  const displayedFSM = selectedFSM ?? fsms?.[0] ?? null;

  // Derived: catalog summary statistics for the system DataBlock and
  // the PullFigure. Computed memoized from `fsms`. When the catalog is
  // empty the values fall back to em-dashes — the page never throws.
  const summary = useMemo(() => {
    if (!fsms || fsms.length === 0) {
      return {
        held: 0,
        optimised: 0,
        avgReductionPct: null as number | null,
      };
    }
    const optimised = fsms.filter((f) => f.is_optimized).length;
    // Mean Hamming distance across optimised entries; assume that if a
    // reduction has been applied, original avg ≈ bit-width / 2 (a coarse
    // baseline) so that "% reduction" is roughly (baseline - avg) / baseline.
    const reductions = fsms
      .filter(
        (f) =>
          f.is_optimized &&
          typeof f.avg_hamming_distance === 'number' &&
          typeof f.bit_width === 'number',
      )
      .map((f) => {
        const baseline = (f.bit_width ?? 0) / 2;
        const avg = f.avg_hamming_distance ?? 0;
        if (baseline <= 0) return 0;
        return Math.max(0, ((baseline - avg) / baseline) * 100);
      });
    const avgReductionPct =
      reductions.length === 0
        ? null
        : reductions.reduce((a, b) => a + b, 0) / reductions.length;
    return { held: fsms.length, optimised, avgReductionPct };
  }, [fsms]);

  // ----- catalog table column definitions ---------------------------------
  const columns: RuledColumn<FSM>[] = [
    {
      header: 'no.',
      width: 'w-12',
      align: 'right',
      tabular: true,
      cell: (_, i) => (
        <span className="text-ink-faint font-medium">{pad3(i + 1)}</span>
      ),
    },
    {
      header: 'Name',
      mono: false,
      cell: (f) => (
        <div>
          <div className="font-serif text-base font-medium text-ink">{f.name}</div>
          {f.description && (
            <div className="font-serif italic text-sm text-ink-soft mt-0.5">
              {f.description}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'states',
      width: 'w-20',
      align: 'right',
      tabular: true,
      cell: (f) => f.state_count,
    },
    {
      header: 'trans.',
      width: 'w-20',
      align: 'right',
      tabular: true,
      cell: (f) => f.transition_count,
    },
    {
      header: 'type',
      width: 'w-24',
      cell: (f) => (
        <span className="text-accent uppercase tracking-[0.05em] text-[0.78rem] font-medium">
          {f.fsm_type}
        </span>
      ),
    },
    {
      header: 'status',
      width: 'w-36',
      align: 'right',
      cell: (f) => (
        <span
          className={
            'inline-block px-2 py-[0.1rem] border text-[0.7rem] uppercase tracking-[0.08em] font-medium ' +
            (f.is_optimized
              ? 'border-ok text-ok'
              : 'border-rule-strong text-ink-soft')
          }
        >
          {f.is_optimized ? 'OPTIMISED' : 'DRAFT'}
        </span>
      ),
    },
  ];

  // ----- system status panel (marginalia) ---------------------------------
  const apiOk = healthData?.status === 'healthy';
  // Build hash — defined-on-define-config in vite.config.ts as a literal at
  // build time. Falls back to "dev" if the define isn't wired yet.
  const buildHash: string =
    typeof import.meta.env.VITE_BUILD_HASH === 'string'
      ? import.meta.env.VITE_BUILD_HASH
      : 'dev';

  const systemItems: DataItem[] = [
    {
      label: 'API',
      value: (
        <span>
          <span aria-hidden>● </span>
          {apiOk ? 'online' : healthData ? 'degraded' : 'unknown'}
        </span>
      ),
      tone: apiOk ? ('ok' as DataTone) : ('warn' as DataTone),
    },
    { label: 'Catalog', value: `${summary.held} entries` },
    { label: 'Optimised', value: `${summary.optimised} / ${summary.held}` },
    { label: 'Build', value: buildHash, tone: 'accent' },
    {
      label: 'Time',
      value: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
    },
  ];

  // ----- render helpers ----------------------------------------------------

  const catalogEmpty = (
    <div className="border-t border-b border-rule py-12 text-center text-ink-soft font-serif italic">
      <p className="text-base">The catalog is empty.</p>
      <p className="font-mono not-italic text-xs uppercase tracking-[0.15em] text-ink-faint mt-3">
        Create a new specification to begin.
      </p>
    </div>
  );

  const catalogError = (
    <div className="border-t border-b border-rule py-10 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.1em] text-warn">
        — backend not connected —
      </p>
      <p className="font-serif italic text-sm text-ink-soft mt-2 max-w-md mx-auto">
        The catalog API did not respond. Start the backend server, or browse the
        examples while you wait.
      </p>
    </div>
  );

  const catalogSkeleton = (
    <div className="border-t border-b border-rule py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-12 my-2"
          style={{ opacity: 1 - i * 0.18 }}
        />
      ))}
    </div>
  );

  // ----- the page ---------------------------------------------------------

  return (
    <div className="bg-paper text-ink min-h-screen" data-testid="page-home">
      <main className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 pb-24">
        {/* Page heading */}
        <Kicktitle number="0" className="mb-2">
          Catalog
        </Kicktitle>
        <h1
          className="font-sans text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.025em] leading-none text-ink mb-8 pb-4 border-b-[2px] border-ink"
          data-testid="home-title"
        >
          A Specification of Finite-State Machines.
        </h1>

        {/* ===================== LEAD GRID ====================== */}
        <section className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-12 lg:gap-16 items-start mb-12">
          <div className="font-serif max-w-[36rem]">
            <p className="text-[1.05rem] leading-[1.65] text-ink mb-4">
              <span className="font-mono not-italic font-medium border-b border-accent">
                This volume
              </span>{' '}
              is the working catalog of all finite-state machines presently held in
              the system. Each entry is a complete{' '}
              <span className="font-mono not-italic font-medium border-b border-accent">
                specification
              </span>
              : a list of states, transitions, outputs, and the encoding by which
              those states are realised in hardware.
            </p>
            <p className="text-[1.05rem] leading-[1.65] text-ink mb-6">
              The catalog is reproducible. Optimisation operates on a copy —
              original definitions are preserved indefinitely.{' '}
              <em className="text-ink-soft">Hamming distance</em> between adjacent
              state encodings is recorded for every transition; where it exceeds
              unity, dummy states may be inserted to enforce single-bit transitions
              and eliminate output glitches.
            </p>
            <CommandKeyRow>
              <CommandKey primary keyGlyph="↳" to={ROUTES.EDITOR_NEW}>
                New FSM
              </CommandKey>
              <CommandKey keyGlyph="⌃" to={ROUTES.EXAMPLES}>
                From example
              </CommandKey>
              <CommandKey keyGlyph="∅" to={ROUTES.GALLERY}>
                Browse gallery
              </CommandKey>
            </CommandKeyRow>
          </div>

          <MarginalNote heading="System">
            <DataBlock items={systemItems} />
            <div className="mt-5 pt-3 border-t border-rule space-y-1">
              <a
                href="/api/v1/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="block font-mono text-[0.72rem] text-ink-soft hover:text-accent transition-colors"
              >
                <span className="text-ink-faint mr-2 inline-block w-5">›</span>
                OpenAPI schema
              </a>
              <a
                href="https://github.com/Vaidurya-s/GrayFSM"
                target="_blank"
                rel="noreferrer"
                className="block font-mono text-[0.72rem] text-ink-soft hover:text-accent transition-colors"
              >
                <span className="text-ink-faint mr-2 inline-block w-5">›</span>
                Source
              </a>
            </div>
          </MarginalNote>
        </section>

        {/* ===================== § 0.1  CATALOG TABLE ===================== */}
        <TypedSection
          number="0.1"
          title="Held in catalog"
          meta={`N = ${fsms?.length ?? '—'}`}
        >
          {isLoading && catalogSkeleton}
          {!isLoading && error && catalogError}
          {!isLoading && !error && fsms && fsms.length === 0 && catalogEmpty}
          {!isLoading && !error && fsms && fsms.length > 0 && (
            <RuledTable<FSM>
              ariaLabel="FSM catalog"
              rows={fsms}
              columns={columns}
              rowKey={(f) => f.id}
              isSelected={(f) => displayedFSM?.id === f.id}
              onRowClick={(f) => setSelectedFSM(f)}
            />
          )}
        </TypedSection>

        {/* ===================== § 0.1.1  ENTRY DETAIL ==================== */}
        {displayedFSM && (
          <TypedSection
            level={3}
            number="0.1.1"
            title={
              <>
                Entry — <span className="font-serif italic">{displayedFSM.name}</span>
              </>
            }
          >
            {displayedFSM.description && (
              <p className="font-serif italic text-ink-soft text-base leading-relaxed max-w-[44rem] mb-6">
                {displayedFSM.description}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <SpecField
                noLeftRule
                label="States"
                value={displayedFSM.state_count}
                qual={
                  displayedFSM.is_optimized && displayedFSM.dummy_state_count
                    ? `${
                        displayedFSM.state_count - displayedFSM.dummy_state_count
                      } active, ${displayedFSM.dummy_state_count} dummy.`
                    : 'No dummy states inserted.'
                }
              />
              <SpecField
                label="Encoding bits"
                value={displayedFSM.bit_width ?? '—'}
                qual={
                  displayedFSM.encoding_type
                    ? `${displayedFSM.encoding_type.charAt(0).toUpperCase()}${displayedFSM.encoding_type.slice(1)} encoding.`
                    : 'Encoding not yet assigned.'
                }
              />
              <SpecField
                accent
                label="Avg Hamming"
                value={
                  typeof displayedFSM.avg_hamming_distance === 'number'
                    ? displayedFSM.avg_hamming_distance.toFixed(2)
                    : '—'
                }
                qual={
                  displayedFSM.is_optimized
                    ? 'Optimised; transitions flip near a single bit.'
                    : 'Pre-optimisation baseline.'
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SpecField
                noLeftRule
                valueSize="compact"
                label="Type"
                value={displayedFSM.fsm_type?.toUpperCase() ?? '—'}
                qual={
                  displayedFSM.fsm_type === 'moore'
                    ? 'Outputs depend on state alone.'
                    : 'Outputs depend on state and input.'
                }
              />
              <SpecField
                valueSize="compact"
                label="Initial state"
                value={
                  <span className="font-mono">{displayedFSM.initial_state}</span>
                }
                qual="The state on reset."
              />
              <SpecField
                valueSize="compact"
                label="Algorithm"
                value={
                  displayedFSM.optimization_algorithm
                    ? displayedFSM.optimization_algorithm.toUpperCase()
                    : '—'
                }
                qual={
                  displayedFSM.optimization_algorithm
                    ? 'Last optimisation algorithm applied.'
                    : 'No optimisation has been run.'
                }
              />
            </div>

            {displayedFSM.tags && displayedFSM.tags.length > 0 && (
              <div className="mt-8 pt-4 border-t border-rule">
                <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint mb-2">
                  Tags
                </div>
                <div className="flex flex-wrap gap-2 font-mono text-[0.72rem]">
                  {displayedFSM.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-rule-strong text-ink-soft px-2 py-[0.1rem] uppercase tracking-[0.08em]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </TypedSection>
        )}

        {/* ===================== PULL FIGURE ===================== */}
        {summary.avgReductionPct !== null ? (
          <PullFigure
            figure={`${summary.avgReductionPct.toFixed(0)}%`}
            unit="mean reduction in adjacent-state Hamming distance"
            caption={
              <>
                across the {summary.optimised}{' '}
                {summary.optimised === 1 ? 'specification' : 'specifications'}{' '}
                presently optimised, after Gray-code encoding and any required
                dummy-state insertion.
              </>
            }
            source="catalog summary, computed at load"
          />
        ) : (
          <PullFigure
            accent={false}
            figure="—"
            unit="catalog summary unavailable"
            caption="Optimise at least one FSM in the catalog to populate this figure."
            source="catalog summary"
          />
        )}

        {/* ===================== § 0.2  ALGORITHMS ===================== */}
        <TypedSection number="0.2" title="Available optimisations">
          <div className="grid grid-cols-1 md:grid-cols-3 border border-ink">
            {algorithms.map((alg, idx) => (
              <article
                key={alg.id}
                className={
                  'p-6 font-mono text-[0.85rem] leading-relaxed ' +
                  (idx < algorithms.length - 1 ? 'md:border-r border-ink' : '') +
                  (idx > 0 ? ' border-t md:border-t-0 border-ink' : '')
                }
              >
                <div className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent mb-2">
                  {alg.id}
                </div>
                <h3 className="font-sans text-lg font-semibold text-ink tracking-tight mb-2">
                  {alg.name}
                </h3>
                <div className="font-mono text-[0.78rem] text-ink mb-3 inline-block bg-accent-tint px-2 py-[0.15rem]">
                  {alg.complexity}
                </div>
                <p className="font-serif text-[0.92rem] leading-snug text-ink-soft">
                  {alg.desc}
                </p>
              </article>
            ))}
          </div>
        </TypedSection>

        {/* ===================== COLOPHON ===================== */}
        <footer className="mt-20 pt-6 border-t border-ink grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          <div>
            <strong className="text-ink font-medium">Set in</strong>
            {' · '}
            IBM Plex Mono / Sans / Serif
          </div>
          <div>
            <strong className="text-ink font-medium">Build</strong>
            {' · '}
            <span className="text-accent">{buildHash}</span>
          </div>
          <div>
            <strong className="text-ink font-medium">API</strong>
            {' · '}
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-ink transition-colors"
            >
              openapi.json
            </a>
          </div>
          <div>
            <strong className="text-ink font-medium">Source</strong>
            {' · '}
            <a
              href="https://github.com/Vaidurya-s/GrayFSM"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-ink transition-colors"
            >
              github.com/Vaidurya-s/GrayFSM
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

// Static algorithm registry shown in § 0.2. The values mirror what
// `app/core/algorithms/__init__.py` exposes; if the backend gains more
// algorithms this could move to a /algorithms endpoint.
const algorithms = [
  {
    id: '001 / Greedy',
    name: 'Greedy dummy-state insertion',
    complexity: 'O(T · log N)',
    desc:
      'Processes each problematic transition independently, inserting the minimum number of dummy states per transition. Fast; locally optimal.',
  },
  {
    id: '002 / BFS',
    name: 'BFS-optimal insertion',
    complexity: 'O(T · N)',
    desc:
      'Breadth-first search with smart encoding reuse to minimise the total dummy count across all transitions simultaneously. Slower; globally optimal under the bit-width constraint.',
  },
  {
    id: '003 / SA',
    name: 'Simulated annealing',
    complexity: 'O(I · T)',
    desc:
      'Reassigns state encodings using temperature-driven acceptance to minimise total Hamming distance before resorting to dummy-state insertion. Escapes local optima.',
  },
];

