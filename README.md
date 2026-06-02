# GrayFSM

GrayFSM helps teams design safer digital systems by making finite state machines easier to build, optimize, and ship. In many hardware workflows, state transitions that flip multiple bits at once can cause temporary glitches. GrayFSM solves that problem by assigning state encodings that reduce bit changes and by inserting safe intermediate states when needed. The result is a cleaner path from idea to reliable HDL output, with a modern interface that supports both deep engineering work and quick stakeholder reviews.

Whether you are a hardware developer, a software engineer supporting hardware workflows, or a non-technical reviewer trying to understand what the system does, GrayFSM is built to be approachable: clear screens, practical outputs, and a workflow that focuses on outcomes.

## Why GrayFSM exists

Finite state machines are everywhere, but correctness and timing safety can be hard to maintain as designs grow. GrayFSM’s vision is to make FSM optimization practical and understandable:

- **For engineers:** reduce risk from multi-bit transitions and speed up implementation.
- **For teams:** standardize optimization workflows and make design decisions easier to review.
- **For organizations:** improve confidence in generated outputs before synthesis and deployment.

## Key features

GrayFSM stands out because it combines optimization logic, visualization, and export tools in one place.

- **FSM authoring and management**
  - Create, edit, and store finite state machine specifications.
  - Organize machines by category and browse existing examples.

- **Multiple optimization strategies**
  - Run **Greedy** optimization for fast, practical improvements.
  - Use **BFS-optimal** for globally optimal transition paths under constraints.
  - Apply **Simulated Annealing** to explore improved encodings and avoid local optima.

- **Safe transition enforcement**
  - Detect transitions with high Hamming distance.
  - Automatically insert intermediate dummy states to enforce one-bit hops.
  - Reduce glitch risk caused by simultaneous multi-bit register changes.

- **Visualization-first workflow**
  - Inspect FSM structures visually.
  - Compare optimization outcomes and metrics.
  - Review behavior with charts and hypercube-oriented visual views.

- **Export-ready outputs**
  - Export optimized designs in formats used by implementation flows, including Verilog and VHDL paths in the main workflow.
  - Share results for collaboration and downstream verification.

- **Full-stack developer experience**
  - FastAPI backend, React/TypeScript frontend, PostgreSQL and Redis support.
  - API documentation via Swagger once backend services are running.

## Quick start

You can run GrayFSM with Docker Compose (recommended) or with a manual local setup.

### Option 1: Docker Compose (recommended)

1. Open a terminal.
2. Go to the Docker setup folder:
   ```bash
   cd infrastructure/docker
   ```
3. Start services:
   ```bash
   docker compose up -d
   ```
4. Open the app and tools:
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8000`
   - API Docs: `http://localhost:8000/docs`

### Option 2: Manual local setup

#### Backend

1. Move to backend:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment, then install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Copy environment settings:
   ```bash
   cp .env.example .env
   ```
4. Run database migrations:
   ```bash
   alembic upgrade head
   ```
5. Start the API server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

#### Frontend

1. In a new terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Open `http://localhost:3000`.

## Basic usage flow

Once GrayFSM is running, a typical workflow looks like this:

1. **Create or import** an FSM definition.
2. **Choose an optimization algorithm** based on speed vs optimality needs.
3. **Run optimization** and review transitions, inserted states, and metrics.
4. **Compare results** if you want to evaluate multiple algorithm outputs.
5. **Export artifacts** for implementation or team handoff.

Example use case: if an FSM transition jumps from one state code to another with a Hamming distance of 3, GrayFSM can route that jump through valid intermediate states so each step changes only one bit.

## Planned improvements

GrayFSM is actively evolving. Planned and ongoing areas include:

- Better async progress feedback for long-running optimization jobs.
- Expanded export and verification options.
- Stronger collaboration and sharing features for team workflows.
- Continued improvements to performance, accessibility, and developer tooling.

## Contributing

Contributions are welcome. If you want to improve algorithms, UX, performance, testing, or docs, please open an issue or submit a pull request. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution guidelines.

## License

GrayFSM is released under the MIT License. See [`LICENSE`](LICENSE) for details.

---

If GrayFSM helps your team, we would love your feedback. Share ideas, report issues, and help shape the next iteration of safer FSM design tooling.
