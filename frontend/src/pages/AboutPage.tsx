import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Tabs,
  TabPanel,
  Card,
  Badge,
  Button,
} from '../components/ui';
import { ROUTES } from '../config/routes';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../config/constants';
import {
  Zap,
  Code2,
  Box,
  BarChart3,
  Globe,
  Layers,
  BookOpen,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface FeatureItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface TechItem {
  category: string;
  items: string[];
}

interface StepItem {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
}

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState<string>('about');

  const features: FeatureItem[] = [
    {
      title: 'Visual FSM Editor',
      description: 'React Flow drag-and-drop interface for intuitive FSM design',
      icon: <Layers className="w-6 h-6 text-blue-600" />,
    },
    {
      title: 'Gray Code Optimization',
      description: 'Minimize glitches and race conditions in hardware transitions',
      icon: <Zap className="w-6 h-6 text-yellow-600" />,
    },
    {
      title: 'HDL Export',
      description: 'Export to Verilog, VHDL, testbenches, and other formats',
      icon: <Code2 className="w-6 h-6 text-purple-600" />,
    },
    {
      title: '3D Visualization',
      description: 'Explore hypercube state space with Three.js rendering',
      icon: <Box className="w-6 h-6 text-indigo-600" />,
    },
    {
      title: 'Metrics Dashboard',
      description: 'Before/after analysis with detailed optimization metrics',
      icon: <BarChart3 className="w-6 h-6 text-green-600" />,
    },
    {
      title: 'REST API',
      description: 'Full REST API for programmatic access and integration',
      icon: <Globe className="w-6 h-6 text-red-600" />,
    },
  ];

  const techStack: TechItem[] = [
    {
      category: 'Frontend',
      items: ['React 18', 'TypeScript', 'Tailwind CSS', 'React Flow', 'Three.js', 'Recharts'],
    },
    {
      category: 'Backend',
      items: ['FastAPI', 'SQLAlchemy', 'PostgreSQL', 'Alembic', 'Celery', 'Redis'],
    },
    {
      category: 'Testing',
      items: ['Pytest', 'Vitest', 'Playwright'],
    },
    {
      category: 'Infrastructure',
      items: ['Docker', 'Kubernetes', 'GitHub Actions', 'CI/CD'],
    },
  ];

  const steps: StepItem[] = [
    {
      number: 1,
      title: 'Design',
      description:
        'Create your FSM by defining states and transitions in the visual editor with drag-and-drop simplicity.',
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    {
      number: 2,
      title: 'Optimize',
      description:
        'Select from multiple algorithms (Greedy, BFS, Simulated Annealing) to apply Gray code encoding.',
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    {
      number: 3,
      title: 'Compare',
      description:
        'View before/after metrics and visualizations to understand the optimization impact.',
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    {
      number: 4,
      title: 'Export',
      description:
        'Download your optimized FSM in Verilog, VHDL, testbench, or other formats for synthesis.',
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
  ];

  const apiEndpoints: ApiEndpoint[] = [
    {
      method: 'POST',
      path: '/fsm',
      description: 'Create a new FSM',
    },
    {
      method: 'GET',
      path: '/fsm/{id}',
      description: 'Retrieve FSM details',
    },
    {
      method: 'PUT',
      path: '/fsm/{id}',
      description: 'Update an FSM',
    },
    {
      method: 'DELETE',
      path: '/fsm/{id}',
      description: 'Delete an FSM',
    },
    {
      method: 'POST',
      path: '/fsm/{id}/optimize',
      description: 'Run optimization on an FSM',
    },
    {
      method: 'POST',
      path: '/fsm/{id}/export',
      description: 'Export FSM to desired format',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900" data-testid="about-page">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white font-bold text-3xl">G</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-3">
            {APP_NAME}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">{APP_DESCRIPTION}</p>
          <span className="inline-block text-sm text-gray-400 dark:text-gray-500">v{APP_VERSION}</span>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-gray-900/50 overflow-hidden">
          <Tabs
            tabs={[
              { value: 'about', label: 'About' },
              { value: 'tech', label: 'Tech Stack' },
              { value: 'how', label: 'How It Works' },
              { value: 'api', label: 'API' },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            className="p-6"
            variant="underline"
          >
            {/* TAB 1: About */}
            <TabPanel value="about" activeValue={activeTab}>
              <div className="space-y-10">
                {/* Project Description */}
                <section>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">What is GrayFSM?</h2>
                  <div className="space-y-3 text-gray-600 dark:text-gray-400">
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

                {/* Features Grid */}
                <section>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Core Features</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map((feature) => (
                      <Card
                        key={feature.title}
                        variant="bordered"
                        className="hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">{feature.icon}</div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                              {feature.title}
                            </h4>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>

                {/* CTA Section */}
                <section className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-lg p-8 border border-blue-200 dark:border-blue-800">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Ready to optimize your FSMs?
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Start by creating a new FSM or explore the gallery for inspiration.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Link to={ROUTES.EDITOR_NEW} data-testid="about-create-fsm">
                        <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                          Create FSM
                        </Button>
                      </Link>
                      <Link to={ROUTES.GALLERY} data-testid="about-browse-gallery">
                        <Button variant="outline" size="lg">
                          Browse Gallery
                        </Button>
                      </Link>
                    </div>
                  </div>
                </section>
              </div>
            </TabPanel>

            {/* TAB 2: Tech Stack */}
            <TabPanel value="tech" activeValue={activeTab}>
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Technology Stack</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    GrayFSM is built with modern, production-grade technologies across the full stack.
                  </p>
                </div>

                {techStack.map((category) => (
                  <section key={category.category}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {category.category}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {category.items.map((tech) => (
                        <Badge key={tech} variant="info" size="md">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </section>
                ))}

                <Card variant="bordered" className="bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">Want to learn more?</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Check out the full documentation and architecture guide.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </TabPanel>

            {/* TAB 3: How It Works */}
            <TabPanel value="how" activeValue={activeTab}>
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Workflow Overview</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    GrayFSM simplifies FSM optimization into four intuitive steps.
                  </p>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {steps.map((step) => (
                    <Card key={step.number} variant="bordered">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                            {step.number}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                            {step.title}
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Gray Code Explanation */}
                <Card variant="bordered" className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    Understanding Gray Code Optimization
                  </h3>
                  <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                    <p>
                      Gray code is a binary numeral system where two successive values differ in only
                      one bit. In FSM design, this property is crucial because:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Prevents race conditions from simultaneous bit changes</li>
                      <li>Minimizes glitches and metastable state occurrences</li>
                      <li>Improves circuit reliability and timing margins</li>
                      <li>Reduces unnecessary dummy state insertions</li>
                    </ul>
                  </div>
                </Card>
              </div>
            </TabPanel>

            {/* TAB 4: API */}
            <TabPanel value="api" activeValue={activeTab}>
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">REST API</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    GrayFSM provides a comprehensive REST API for programmatic access to all features.
                  </p>
                </div>

                {/* API Info Card */}
                <Card variant="bordered" className="bg-gray-50 dark:bg-gray-800">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Base URL:</strong>{' '}
                      <code className="bg-white dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded text-xs">
                        /api/v1
                      </code>
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Interactive Docs:</strong>{' '}
                      <a href="/docs" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline">
                        Swagger UI
                      </a>
                    </p>
                  </div>
                </Card>

                {/* Endpoints Table */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Key Endpoints</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                            Method
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                            Path
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                        {apiEndpoints.map((endpoint, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className="px-4 py-3 text-sm">
                              <Badge
                                variant={
                                  endpoint.method === 'GET'
                                    ? 'info'
                                    : endpoint.method === 'POST'
                                      ? 'success'
                                      : endpoint.method === 'PUT'
                                        ? 'warning'
                                        : 'danger'
                                }
                                size="sm"
                              >
                                {endpoint.method}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                              {endpoint.path}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              {endpoint.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Documentation Card */}
                <Card variant="bordered" className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Full API Documentation</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Visit{' '}
                        <a href="/docs" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-medium">
                          /docs
                        </a>
                        {' '}for interactive Swagger UI with request/response examples and schema definitions.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
