import { Link } from 'react-router-dom';
import {
  CommandKey,
  CommandKeyRow,
  Kicktitle,
  MarginalNote,
  TypedSection,
} from '../components/ui';
import { ROUTES } from '../config/routes';
import { OPENAPI_URL } from '../config/constants';

/* -------------------------------------------------------------------------- *
 * AboutPage — "§ 5 About"                                                    *
 * -------------------------------------------------------------------------- *
 * Long-form engineering essay. Single 36rem serif column with a drop cap;    *
 * sidenotes via MarginalNote at md+ widths. The text is the primary           *
 * artefact — no marketing tiles, no lucide icons. Real prose about Gray      *
 * code, glitches, and the algorithms that ship in this repo.                 *
 * -------------------------------------------------------------------------- */

export default function AboutPage() {
  return (
    <div className="bg-paper text-ink min-h-screen" data-testid="page-about">
      <main className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 pb-24">
        {/* heading */}
        <Kicktitle number="5" className="mb-2">
          About
        </Kicktitle>
        <h1 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.025em] leading-none text-ink mb-8 pb-4 border-b-[2px] border-ink">
          Theory of Operation.
        </h1>

        {/* essay grid: prose + marginal sidenotes */}
        <article className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-12 lg:gap-16 items-start">
          {/* ───── PROSE COLUMN ───── */}
          <div className="font-serif max-w-[36rem] text-ink leading-[1.7] text-[1.05rem]">
            {/* lead with drop cap */}
            <p>
              <span className="float-left font-sans font-semibold text-accent text-[5.2rem] leading-[0.85] pr-3 pt-1 -ml-1">
                G
              </span>
              rayFSM is a tool for designers of synchronous digital hardware.
              It takes a finite-state machine — a set of states, the transitions
              between them, and the outputs they produce — and assigns to each
              state a binary code such that adjacent states differ in as few
              bits as possible. Where a single-bit transition is impossible
              within a fixed encoding width, the tool inserts intermediate
              dummy states to enforce one. The output is synthesisable Verilog
              or VHDL.
            </p>

            <p className="mt-5">
              The motivation is mundane and old.{' '}
              <em className="text-ink-soft">Glitches</em> &mdash; transient
              wrong values on combinational outputs &mdash; arise when more
              than one bit of a state register changes during a transition,
              because the bits do not switch at the same instant.{' '}
              <span className="font-mono not-italic text-[0.95em] border-b border-accent">
                Gray-coded
              </span>{' '}
              transitions, where adjacent codes differ in exactly one bit,
              eliminate this class of fault by construction. Frank Gray
              described the encoding in 1947 for use in pulse-code modulation;
              the geometry of the underlying hypercube is older still.
            </p>

            <h2 className="font-sans text-xl font-semibold tracking-tight text-ink mt-12 mb-3 pb-1 border-b border-rule-strong">
              <span className="font-mono text-sm font-medium text-accent mr-3">
                5.1
              </span>
              Why dummy states.
            </h2>
            <p>
              Not every machine fits into a Gray-coded encoding of minimum
              width. With <em>n</em> states one needs at least
              <span className="font-mono not-italic"> ⌈log₂ n⌉</span> bits;
              packed tightly, the codes form a Hamiltonian path through the
              hypercube of that width, and there is no slack to route around a
              transition that needs to skip over a missing edge.
            </p>
            <p className="mt-4">
              Two answers exist. One is to widen the encoding &mdash; spend
              another bit, gain twice the codes, accept the area cost. The
              other is to interpose an unobservable{' '}
              <em className="text-ink-soft">dummy state</em> whose only job is
              to occupy a code adjacent to both endpoints, splitting a
              two-bit jump into two one-bit hops. A dummy state lengthens the
              transition by one clock; a glitch lengthens the transition by
              forever. The trade is rarely close.
            </p>

            <h2 className="font-sans text-xl font-semibold tracking-tight text-ink mt-12 mb-3 pb-1 border-b border-rule-strong">
              <span className="font-mono text-sm font-medium text-accent mr-3">
                5.2
              </span>
              The algorithms shipped here.
            </h2>
            <p>
              Three optimisers are available; each operates on a copy of the
              specification and never mutates the original.
            </p>
            <p className="mt-4">
              The{' '}
              <span className="font-mono not-italic font-medium">
                Greedy
              </span>{' '}
              optimiser walks the transition list in order, inserting the
              minimum number of dummy states for each problematic transition
              independently. It is fast and locally optimal; on small machines
              it often matches the global optimum.
            </p>
            <p className="mt-4">
              The{' '}
              <span className="font-mono not-italic font-medium">
                BFS-optimal
              </span>{' '}
              optimiser is a breadth-first search over encoding-reuse
              opportunities. It minimises the total dummy count across all
              transitions simultaneously, at the cost of running time
              proportional to states &times; transitions.
            </p>
            <p className="mt-4">
              The{' '}
              <span className="font-mono not-italic font-medium">
                Simulated annealing
              </span>{' '}
              optimiser sidesteps the dummy-state question by reassigning
              the encodings themselves. It begins with a random Gray-code
              assignment, perturbs it by swapping pairs of codes, and accepts
              worse configurations with a temperature-dependent probability
              so it can escape local optima. When the temperature drops it
              terminates with whatever assignment is best so far.
            </p>

            <h2 className="font-sans text-xl font-semibold tracking-tight text-ink mt-12 mb-3 pb-1 border-b border-rule-strong">
              <span className="font-mono text-sm font-medium text-accent mr-3">
                5.3
              </span>
              What the tool will not do.
            </h2>
            <p>
              The optimiser does not synthesise. It emits HDL; whatever
              decisions a synthesis tool makes about register encoding,
              don&rsquo;t-care minimisation, and retiming are downstream. The tool
              also does not reason about asynchronous inputs or metastability:
              the FSM is assumed to be clocked, with all inputs registered.
              Hazard-free <em>combinational</em> output logic is a separate
              optimisation problem the tool does not currently solve.
            </p>
            <p className="mt-4">
              These omissions are deliberate. The scope is the encoding
              question; everything else is left to the tools that already
              do those things well.
            </p>

            <h2 className="font-sans text-xl font-semibold tracking-tight text-ink mt-12 mb-3 pb-1 border-b border-rule-strong">
              <span className="font-mono text-sm font-medium text-accent mr-3">
                5.4
              </span>
              Implementation.
            </h2>
            <p>
              The backend is FastAPI on Python 3.12 with SQLAlchemy 2.0 and
              asyncpg; the optimisation algorithms are pure Python over
              NetworkX graphs. The frontend is React 18 with Vite, ReactFlow
              for the editor, three.js for the hypercube visualisation, and
              the type system you are presently reading: IBM Plex, set
              datasheet-style.
            </p>
            <p className="mt-4">
              The repository is open. Specifications, optimised outputs, HDL
              exports, and the full source are at the address in the colophon
              below.
            </p>

            {/* CTA */}
            <div className="mt-12 pt-6 border-t border-rule">
              <CommandKeyRow>
                <CommandKey primary keyGlyph="↳" to={ROUTES.EDITOR_NEW}>
                  Begin a specification
                </CommandKey>
                <CommandKey keyGlyph="∅" to={ROUTES.EXAMPLES}>
                  Browse examples
                </CommandKey>
              </CommandKeyRow>
            </div>
          </div>

          {/* ───── MARGINAL SIDENOTES ───── */}
          <MarginalNote heading="In the margin">
            <ol className="list-none m-0 p-0 space-y-4 [counter-reset:fn]">
              <li className="pl-7 relative [counter-increment:fn] before:content-[counter(fn)] before:absolute before:left-0 before:top-0 before:font-mono before:text-accent before:font-semibold before:text-[0.85rem] before:font-tabular">
                <span className="font-serif italic">
                  A Hamming distance of one between adjacent states is the
                  textbook definition of a Gray code; the term is owed to
                  Frank Gray&rsquo;s 1953 patent on pulse-code modulation.
                </span>
              </li>
              <li className="pl-7 relative [counter-increment:fn] before:content-[counter(fn)] before:absolute before:left-0 before:top-0 before:font-mono before:text-accent before:font-semibold before:text-[0.85rem] before:font-tabular">
                <span className="font-serif italic">
                  The hypercube of dimension <em>n</em> has{' '}
                  <span className="font-mono not-italic">2ⁿ</span> vertices and{' '}
                  <span className="font-mono not-italic">n · 2ⁿ⁻¹</span> edges.
                  A traversal that visits every vertex exactly once is a
                  Hamiltonian path; the construction is what makes Gray
                  codes work.
                </span>
              </li>
              <li className="pl-7 relative [counter-increment:fn] before:content-[counter(fn)] before:absolute before:left-0 before:top-0 before:font-mono before:text-accent before:font-semibold before:text-[0.85rem] before:font-tabular">
                <span className="font-serif italic">
                  The simulated-annealing optimiser ships with a fixed
                  cooling schedule. Custom schedules are accepted via the
                  <span className="font-mono not-italic"> /optimize </span>
                  endpoint.
                </span>
              </li>
              <li className="pl-7 relative [counter-increment:fn] before:content-[counter(fn)] before:absolute before:left-0 before:top-0 before:font-mono before:text-accent before:font-semibold before:text-[0.85rem] before:font-tabular">
                <span className="font-serif italic">
                  HDL is emitted with synthesis pragmas opt-in. The default is
                  unannotated; Vivado, Quartus, and Yosys read all three
                  styles without complaint.
                </span>
              </li>
            </ol>

            <div className="mt-8 pt-4 border-t border-rule">
              <h4 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-ink pb-1.5 border-b border-ink mb-3">
                Reading further
              </h4>
              <ul className="space-y-2 not-italic">
                <li>
                  <a
                    href="https://en.wikipedia.org/wiki/Gray_code"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[0.75rem] text-ink-soft hover:text-accent transition-colors"
                  >
                    <span className="text-ink-faint mr-2 inline-block w-4">
                      ↗
                    </span>
                    Gray code (Wikipedia)
                  </a>
                </li>
                <li>
                  <a
                    href="https://en.wikipedia.org/wiki/Hypercube_graph"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[0.75rem] text-ink-soft hover:text-accent transition-colors"
                  >
                    <span className="text-ink-faint mr-2 inline-block w-4">
                      ↗
                    </span>
                    Hypercube graph
                  </a>
                </li>
                <li>
                  <a
                    href="https://en.wikipedia.org/wiki/Simulated_annealing"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[0.75rem] text-ink-soft hover:text-accent transition-colors"
                  >
                    <span className="text-ink-faint mr-2 inline-block w-4">
                      ↗
                    </span>
                    Simulated annealing
                  </a>
                </li>
                <li>
                  <Link
                    to={OPENAPI_URL}
                    className="font-mono text-[0.75rem] text-ink-soft hover:text-accent transition-colors"
                  >
                    <span className="text-ink-faint mr-2 inline-block w-4">
                      ‡
                    </span>
                    REST API · openapi.json
                  </Link>
                </li>
              </ul>
            </div>
          </MarginalNote>
        </article>

        {/* colophon */}
        <TypedSection number="5.5" title="Colophon">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-serif text-[0.95rem] leading-relaxed text-ink-soft">
            <p>
              Set in <em>IBM Plex Mono</em>, <em>Sans</em>, and{' '}
              <em>Serif</em> — open-source typefaces commissioned by IBM and
              designed by Mike Abbink with the Bold Monday foundry. The mono
              variant carries data and numerals; the sans, headings; the
              serif, prose.
            </p>
            <p>
              The aesthetic is{' '}
              <em>datasheet brutalism</em>. Hairline rules, no rounded corners,
              one accent colour, asymmetric grids. References include the
              technical reference manuals of Texas Instruments and Hewlett-
              Packard from the late 1970s, and contemporary editorial
              typography that takes the same documents seriously.
            </p>
          </div>
        </TypedSection>
      </main>
    </div>
  );
}
