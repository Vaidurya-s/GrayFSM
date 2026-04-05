import { describe, it, expect } from 'vitest';
import { fsmToMermaid, mermaidToFSM } from '@/utils/mermaid';
import type { FSM } from '@/types/fsm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMooreFSM(overrides: Partial<FSM> = {}): FSM {
  return {
    id: 'test-id',
    name: 'Traffic Light',
    description: 'A simple Moore FSM',
    fsm_type: 'moore',
    states: ['S0', 'S1', 'S2'],
    initial_state: 'S0',
    transitions: [
      { from_state: 'S0', to_state: 'S1', input: 'clk' },
      { from_state: 'S1', to_state: 'S2', input: 'clk' },
      { from_state: 'S2', to_state: 'S0', input: 'reset' },
    ],
    outputs: { S0: '00', S1: '01', S2: '10' },
    definition: {
      states: [
        { id: 'S0', name: 'S0', output: '00' },
        { id: 'S1', name: 'S1', output: '01' },
        { id: 'S2', name: 'S2', output: '10' },
      ],
      transitions: [
        { from_state: 'S0', to_state: 'S1', input: 'clk' },
        { from_state: 'S1', to_state: 'S2', input: 'clk' },
        { from_state: 'S2', to_state: 'S0', input: 'reset' },
      ],
    },
    state_count: 3,
    transition_count: 3,
    visibility: 'public',
    ...overrides,
  };
}

function makeMealyFSM(overrides: Partial<FSM> = {}): FSM {
  return {
    id: 'mealy-id',
    name: 'Mealy Machine',
    fsm_type: 'mealy',
    states: ['A', 'B'],
    initial_state: 'A',
    transitions: [
      { from_state: 'A', to_state: 'B', input: 'x', output: '1' },
      { from_state: 'B', to_state: 'A', input: 'y', output: '0' },
    ],
    definition: {
      transitions: [
        { from_state: 'A', to_state: 'B', input: 'x', output: '1' },
        { from_state: 'B', to_state: 'A', input: 'y', output: '0' },
      ],
    },
    state_count: 2,
    transition_count: 2,
    visibility: 'public',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fsmToMermaid
// ---------------------------------------------------------------------------

describe('fsmToMermaid', () => {
  it('produces stateDiagram-v2 directive', () => {
    const result = fsmToMermaid(makeMooreFSM());
    expect(result).toContain('stateDiagram-v2');
  });

  it('includes initial state arrow', () => {
    const result = fsmToMermaid(makeMooreFSM());
    expect(result).toContain('[*] --> S0');
  });

  it('includes all transitions for Moore FSM', () => {
    const result = fsmToMermaid(makeMooreFSM());
    expect(result).toContain('S0 --> S1 : clk');
    expect(result).toContain('S1 --> S2 : clk');
    expect(result).toContain('S2 --> S0 : reset');
  });

  it('includes Moore state output descriptions', () => {
    const result = fsmToMermaid(makeMooreFSM());
    expect(result).toContain('S0 : Output = 00');
    expect(result).toContain('S1 : Output = 01');
    expect(result).toContain('S2 : Output = 10');
  });

  it('includes FSM name in header comment', () => {
    const result = fsmToMermaid(makeMooreFSM());
    expect(result).toContain('%% FSM: Traffic Light');
  });

  it('includes FSM type in header comment', () => {
    const result = fsmToMermaid(makeMooreFSM());
    expect(result).toContain('%% Type: moore');
  });

  it('uses input/output format for Mealy transitions', () => {
    const result = fsmToMermaid(makeMealyFSM());
    expect(result).toContain('A --> B : x / 1');
    expect(result).toContain('B --> A : y / 0');
  });

  it('does not add state descriptions for Mealy FSM', () => {
    const result = fsmToMermaid(makeMealyFSM());
    expect(result).not.toContain(': Output =');
  });

  it('handles self-loops', () => {
    const fsm = makeMooreFSM({
      transitions: [{ from_state: 'S0', to_state: 'S0', input: 'hold' }],
      definition: {
        transitions: [{ from_state: 'S0', to_state: 'S0', input: 'hold' }],
      },
    });
    const result = fsmToMermaid(fsm);
    expect(result).toContain('S0 --> S0 : hold');
  });

  it('includes encoding annotations when present', () => {
    const fsm = makeMooreFSM({
      encoding: { S0: '00', S1: '01', S2: '11' },
    });
    const result = fsmToMermaid(fsm);
    expect(result).toContain('%% S0 = 00');
    expect(result).toContain('%% S1 = 01');
    expect(result).toContain('%% S2 = 11');
  });

  it('includes encoding_type comment when present', () => {
    const fsm = makeMooreFSM({ encoding_type: 'gray' });
    const result = fsmToMermaid(fsm);
    expect(result).toContain('%% Encoding: gray');
  });

  it('handles transitions with no label', () => {
    const fsm = makeMooreFSM({
      transitions: [{ from_state: 'S0', to_state: 'S1' }],
      definition: { transitions: [{ from_state: 'S0', to_state: 'S1' }] },
    });
    const result = fsmToMermaid(fsm);
    expect(result).toContain('S0 --> S1');
    // Should not have trailing colon
    expect(result).not.toMatch(/S0 --> S1 :/);
  });

  it('handles single-state FSM', () => {
    const fsm = makeMooreFSM({
      states: ['IDLE'],
      initial_state: 'IDLE',
      transitions: [],
      definition: { transitions: [], states: [{ id: 'IDLE', name: 'IDLE', output: '0' }] },
      outputs: { IDLE: '0' },
      state_count: 1,
      transition_count: 0,
    });
    const result = fsmToMermaid(fsm);
    expect(result).toContain('[*] --> IDLE');
    expect(result).toContain('IDLE : Output = 0');
  });
});

// ---------------------------------------------------------------------------
// mermaidToFSM
// ---------------------------------------------------------------------------

describe('mermaidToFSM', () => {
  const simpleMoore = `
%% FSM: Traffic Light
%% Type: moore
stateDiagram-v2
    [*] --> S0
    S0 --> S1 : clk
    S1 --> S2 : clk
    S2 --> S0 : reset
    S0 : Output = 00
    S1 : Output = 01
    S2 : Output = 10
`.trim();

  it('parses initial state', () => {
    const result = mermaidToFSM(simpleMoore);
    expect(result.initialState).toBe('S0');
  });

  it('parses all states', () => {
    const result = mermaidToFSM(simpleMoore);
    const names = result.states.map((s) => s.name);
    expect(names).toContain('S0');
    expect(names).toContain('S1');
    expect(names).toContain('S2');
  });

  it('parses transitions', () => {
    const result = mermaidToFSM(simpleMoore);
    expect(result.transitions).toHaveLength(3);
    const t = result.transitions.find((t) => t.from_state === 'S0' && t.to_state === 'S1');
    expect(t).toBeDefined();
    expect(t?.input).toBe('clk');
  });

  it('parses state output from description', () => {
    const result = mermaidToFSM(simpleMoore);
    const s0 = result.states.find((s) => s.name === 'S0');
    expect(s0?.output).toBe('00');
  });

  it('extracts FSM name from comment', () => {
    const result = mermaidToFSM(simpleMoore);
    expect(result.name).toBe('Traffic Light');
  });

  it('parses Mealy input/output label', () => {
    const mealy = `
stateDiagram-v2
    [*] --> A
    A --> B : x / 1
    B --> A : y / 0
`.trim();
    const result = mermaidToFSM(mealy);
    const t = result.transitions.find((t) => t.from_state === 'A');
    expect(t?.input).toBe('x');
    expect(t?.output).toBe('1');
  });

  it('parses self-loops', () => {
    const diagram = `
stateDiagram-v2
    [*] --> S0
    S0 --> S0 : hold
    S0 --> S1 : go
`.trim();
    const result = mermaidToFSM(diagram);
    const selfLoop = result.transitions.find(
      (t) => t.from_state === 'S0' && t.to_state === 'S0',
    );
    expect(selfLoop).toBeDefined();
    expect(selfLoop?.input).toBe('hold');
  });

  it('collects unique state names (no duplicates)', () => {
    const result = mermaidToFSM(simpleMoore);
    const names = result.states.map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('ignores comment lines (%% ...)', () => {
    const diagram = `
stateDiagram-v2
    %% This is a comment
    [*] --> A
    %% Another comment
    A --> B : go
`.trim();
    const result = mermaidToFSM(diagram);
    expect(result.states).toHaveLength(2);
  });

  it('ignores empty lines', () => {
    const diagram = `
stateDiagram-v2

    [*] --> A

    A --> B : go

`.trim();
    const result = mermaidToFSM(diagram);
    expect(result.initialState).toBe('A');
  });

  it('handles transitions with no label', () => {
    const diagram = `
stateDiagram-v2
    [*] --> A
    A --> B
`.trim();
    const result = mermaidToFSM(diagram);
    const t = result.transitions.find((t) => t.from_state === 'A' && t.to_state === 'B');
    expect(t).toBeDefined();
    expect(t?.input).toBeUndefined();
  });

  it('throws on empty input', () => {
    expect(() => mermaidToFSM('')).toThrow('Input is empty');
  });

  it('throws when stateDiagram-v2 directive is missing', () => {
    expect(() =>
      mermaidToFSM('A --> B : go'),
    ).toThrow(/does not appear to be a Mermaid stateDiagram/);
  });

  it('throws when no states are found', () => {
    expect(() =>
      mermaidToFSM('stateDiagram-v2\n%% just a comment'),
    ).toThrow(/No states found/);
  });

  it('handles stateDiagram (v1) directive as valid', () => {
    const diagram = `
stateDiagram
    [*] --> A
    A --> B : go
`.trim();
    const result = mermaidToFSM(diagram);
    expect(result.initialState).toBe('A');
  });

  it('handles single-state diagram', () => {
    const diagram = `
stateDiagram-v2
    [*] --> IDLE
    IDLE --> IDLE : tick
`.trim();
    const result = mermaidToFSM(diagram);
    expect(result.states).toHaveLength(1);
    expect(result.initialState).toBe('IDLE');
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('round-trip (fsmToMermaid -> mermaidToFSM)', () => {
  it('preserves states through round-trip for Moore FSM', () => {
    const fsm = makeMooreFSM();
    const mermaid = fsmToMermaid(fsm);
    const parsed = mermaidToFSM(mermaid);

    const originalNames = new Set(fsm.states);
    const parsedNames = new Set(parsed.states.map((s) => s.name));
    for (const name of originalNames) {
      expect(parsedNames).toContain(name);
    }
  });

  it('preserves initial state through round-trip', () => {
    const fsm = makeMooreFSM();
    const mermaid = fsmToMermaid(fsm);
    const parsed = mermaidToFSM(mermaid);
    expect(parsed.initialState).toBe(fsm.initial_state);
  });

  it('preserves transition count through round-trip', () => {
    const fsm = makeMooreFSM();
    const mermaid = fsmToMermaid(fsm);
    const parsed = mermaidToFSM(mermaid);
    expect(parsed.transitions).toHaveLength(fsm.transitions.length);
  });

  it('preserves transition from/to through round-trip', () => {
    const fsm = makeMooreFSM();
    const mermaid = fsmToMermaid(fsm);
    const parsed = mermaidToFSM(mermaid);

    for (const orig of fsm.transitions) {
      const found = parsed.transitions.find(
        (t) => t.from_state === orig.from_state && t.to_state === orig.to_state,
      );
      expect(found).toBeDefined();
    }
  });

  it('preserves Mealy transition inputs and outputs through round-trip', () => {
    const fsm = makeMealyFSM();
    const mermaid = fsmToMermaid(fsm);
    const parsed = mermaidToFSM(mermaid);

    for (const orig of fsm.transitions) {
      const found = parsed.transitions.find(
        (t) => t.from_state === orig.from_state && t.to_state === orig.to_state,
      );
      expect(found).toBeDefined();
      expect(found?.input).toBe(orig.input);
      expect(found?.output).toBe(orig.output);
    }
  });

  it('preserves FSM name through round-trip', () => {
    const fsm = makeMooreFSM();
    const mermaid = fsmToMermaid(fsm);
    const parsed = mermaidToFSM(mermaid);
    expect(parsed.name).toBe(fsm.name);
  });

  it('preserves Moore outputs through round-trip', () => {
    const fsm = makeMooreFSM();
    const mermaid = fsmToMermaid(fsm);
    const parsed = mermaidToFSM(mermaid);

    for (const [stateName, expectedOutput] of Object.entries(fsm.outputs ?? {})) {
      const state = parsed.states.find((s) => s.name === stateName);
      expect(state?.output).toBe(expectedOutput);
    }
  });
});
