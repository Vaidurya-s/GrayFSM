import { Link } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../config/constants';

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="about-page">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">G</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{APP_NAME}</h1>
        <p className="text-lg text-gray-600 mt-2">{APP_DESCRIPTION}</p>
        <span className="inline-block mt-2 text-xs text-gray-400">v{APP_VERSION}</span>
      </div>

      {/* What is GrayFSM */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          What is GrayFSM?
        </h2>
        <div className="prose text-gray-600 text-sm space-y-3">
          <p>
            GrayFSM is a full-stack web application for optimizing Finite State Machines
            using Gray code encoding. It minimizes glitches and race conditions in hardware
            FSM implementations by ensuring adjacent state transitions differ by only one
            bit.
          </p>
          <p>
            When state transitions require multi-bit changes, GrayFSM automatically inserts
            dummy states along hypercube shortest paths to guarantee single-bit transitions,
            making your digital circuits more robust and reliable.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Design Your FSM',
              description:
                'Use the visual editor to create states and transitions with a drag-and-drop interface.',
            },
            {
              step: '2',
              title: 'Optimize',
              description:
                'Choose an optimization algorithm (greedy, BFS, simulated annealing, or global search) to apply Gray code encoding.',
            },
            {
              step: '3',
              title: 'Export',
              description:
                'Export your optimized FSM to Verilog, VHDL, or other formats ready for synthesis.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white rounded-lg shadow p-6 border border-gray-200 text-center"
            >
              <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                {item.step}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                {item.title}
              </h3>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Algorithms */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Optimization Algorithms
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              name: 'Greedy',
              description:
                'Fast local optimization that assigns Gray code encodings by processing transitions in order of frequency. Best for quick results.',
              speed: 'Fast',
              quality: 'Good',
            },
            {
              name: 'BFS-Optimal',
              description:
                'Breadth-first search through encoding space to find optimal assignments for small FSMs. Guarantees minimum Hamming distance.',
              speed: 'Medium',
              quality: 'Optimal',
            },
            {
              name: 'Simulated Annealing',
              description:
                'Global optimization using probabilistic acceptance of worse solutions to escape local minima. Good for medium-large FSMs.',
              speed: 'Slow',
              quality: 'Near-optimal',
            },
            {
              name: 'Global Search',
              description:
                'Exhaustive search over all possible encodings. Guarantees the best result but only practical for very small FSMs.',
              speed: 'Very Slow',
              quality: 'Best',
            },
          ].map((algo) => (
            <div
              key={algo.name}
              className="bg-white rounded-lg shadow p-5 border border-gray-200"
            >
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {algo.name}
              </h3>
              <p className="text-xs text-gray-500 mb-3">{algo.description}</p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-400">
                  Speed: <span className="text-gray-700 font-medium">{algo.speed}</span>
                </span>
                <span className="text-gray-400">
                  Quality:{' '}
                  <span className="text-gray-700 font-medium">{algo.quality}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Technology Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'React 18', category: 'Frontend' },
            { name: 'TypeScript', category: 'Language' },
            { name: 'FastAPI', category: 'Backend' },
            { name: 'PostgreSQL', category: 'Database' },
            { name: 'ReactFlow', category: 'Diagrams' },
            { name: 'Tailwind CSS', category: 'Styling' },
            { name: 'Zustand', category: 'State' },
            { name: 'React Query', category: 'Data' },
          ].map((tech) => (
            <div
              key={tech.name}
              className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200"
            >
              <div className="text-sm font-medium text-gray-900">{tech.name}</div>
              <div className="text-xs text-gray-400">{tech.category}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="text-center bg-blue-50 rounded-lg p-8 border border-blue-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Ready to optimize your FSMs?
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Start by creating a new FSM or explore the gallery for inspiration.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to={ROUTES.EDITOR_NEW}
            data-testid="about-create-fsm"
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Create FSM
          </Link>
          <Link
            to={ROUTES.GALLERY}
            data-testid="about-browse-gallery"
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Browse Gallery
          </Link>
        </div>
      </div>
    </div>
  );
}
