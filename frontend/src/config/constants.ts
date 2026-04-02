export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api/v1';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:9000/ws';

export const APP_NAME = 'GrayFSM';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Automated FSM Optimization with Gray Code Encoding';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const SUPPORTED_ALGORITHMS = [
  { value: 'greedy', label: 'Greedy', description: 'Fast local optimization' },
  { value: 'bfs_optimal', label: 'BFS-Optimal', description: 'Breadth-first optimal search' },
  {
    value: 'global_sa',
    label: 'Simulated Annealing',
    description: 'Global optimization via simulated annealing',
  },
  { value: 'global_ga', label: 'Genetic Algorithm', description: 'Global optimization via genetic algorithm' },
] as const;

export const EXPORT_FORMATS = [
  { value: 'verilog', label: 'Verilog', extension: '.v', description: 'Synthesizable Verilog' },
  { value: 'vhdl', label: 'VHDL', extension: '.vhd', description: 'VHDL code' },
  { value: 'json', label: 'JSON', extension: '.json', description: 'JSON definition' },
  { value: 'csv', label: 'CSV', extension: '.csv', description: 'State table' },
  {
    value: 'testbench',
    label: 'Testbench',
    extension: '_tb.v',
    description: 'Verilog testbench',
  },
] as const;

export const FSM_TYPES = [
  {
    value: 'moore',
    label: 'Moore Machine',
    description: 'Outputs depend only on current state',
  },
  {
    value: 'mealy',
    label: 'Mealy Machine',
    description: 'Outputs depend on state and inputs',
  },
] as const;

export const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private', description: 'Only you can see this FSM' },
  { value: 'unlisted', label: 'Unlisted', description: 'Anyone with link can see' },
  { value: 'public', label: 'Public', description: 'Visible in public gallery' },
] as const;
