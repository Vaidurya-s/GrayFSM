/**
 * Test fixtures - FSM examples for testing
 */

export const trafficLightFSM = {
  type: 'moore',
  states: ['Red', 'Yellow', 'Green', 'RedYellow'],
  initial_state: 'Red',
  transitions: [
    { from_state: 'Red', to_state: 'RedYellow', input: 'timer' },
    { from_state: 'RedYellow', to_state: 'Green', input: 'timer' },
    { from_state: 'Green', to_state: 'Yellow', input: 'timer' },
    { from_state: 'Yellow', to_state: 'Red', input: 'timer' },
  ],
  outputs: {
    Red: '100',
    Yellow: '010',
    Green: '001',
    RedYellow: '110',
  },
};

export const vendingMachineFSM = {
  type: 'moore',
  states: ['Idle', 'Coin5', 'Coin10', 'Dispense'],
  initial_state: 'Idle',
  transitions: [
    { from_state: 'Idle', to_state: 'Coin5', input: '5' },
    { from_state: 'Idle', to_state: 'Coin10', input: '10' },
    { from_state: 'Coin5', to_state: 'Coin10', input: '5' },
    { from_state: 'Coin5', to_state: 'Dispense', input: '10' },
    { from_state: 'Coin10', to_state: 'Dispense', input: '5' },
    { from_state: 'Dispense', to_state: 'Idle', input: 'reset' },
  ],
  outputs: {
    Idle: '00',
    Coin5: '01',
    Coin10: '10',
    Dispense: '11',
  },
};

export const sequenceDetectorFSM = {
  type: 'mealy',
  states: ['S0', 'S1', 'S2', 'S3'],
  initial_state: 'S0',
  transitions: [
    { from_state: 'S0', to_state: 'S0', input: '0', output: '0' },
    { from_state: 'S0', to_state: 'S1', input: '1', output: '0' },
    { from_state: 'S1', to_state: 'S0', input: '0', output: '0' },
    { from_state: 'S1', to_state: 'S2', input: '1', output: '0' },
    { from_state: 'S2', to_state: 'S3', input: '0', output: '0' },
    { from_state: 'S2', to_state: 'S2', input: '1', output: '0' },
    { from_state: 'S3', to_state: 'S0', input: '0', output: '0' },
    { from_state: 'S3', to_state: 'S1', input: '1', output: '1' },
  ],
};

export const simpleFSM = {
  type: 'moore',
  states: ['A', 'B', 'C'],
  initial_state: 'A',
  transitions: [
    { from_state: 'A', to_state: 'B', input: '0' },
    { from_state: 'B', to_state: 'C', input: '1' },
    { from_state: 'C', to_state: 'A', input: '0' },
  ],
  outputs: {
    A: '0',
    B: '1',
    C: '0',
  },
};

export const complexFSM = {
  type: 'moore',
  states: ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'],
  initial_state: 'S0',
  transitions: [
    { from_state: 'S0', to_state: 'S1', input: '0' },
    { from_state: 'S0', to_state: 'S2', input: '1' },
    { from_state: 'S1', to_state: 'S3', input: '0' },
    { from_state: 'S1', to_state: 'S4', input: '1' },
    { from_state: 'S2', to_state: 'S5', input: '0' },
    { from_state: 'S2', to_state: 'S6', input: '1' },
    { from_state: 'S3', to_state: 'S7', input: '0' },
    { from_state: 'S4', to_state: 'S7', input: '1' },
    { from_state: 'S5', to_state: 'S0', input: '0' },
    { from_state: 'S6', to_state: 'S0', input: '1' },
    { from_state: 'S7', to_state: 'S0', input: '0' },
  ],
  outputs: {
    S0: '000',
    S1: '001',
    S2: '010',
    S3: '011',
    S4: '100',
    S5: '101',
    S6: '110',
    S7: '111',
  },
};

export const invalidFSM = {
  type: 'moore',
  states: ['A', 'B'],
  initial_state: 'C', // Invalid - state doesn't exist
  transitions: [
    { from_state: 'A', to_state: 'B', input: '0' },
    { from_state: 'B', to_state: 'D', input: '1' }, // Invalid - state D doesn't exist
  ],
  outputs: {
    A: '0',
    B: '1',
  },
};

export const csvFSMData = `from_state,to_state,input,output
A,B,0,00
B,C,1,01
C,A,0,10`;

export const largeFSM = {
  type: 'moore',
  states: Array.from({ length: 32 }, (_, i) => `S${i}`),
  initial_state: 'S0',
  transitions: Array.from({ length: 32 }, (_, i) => ({
    from_state: `S${i}`,
    to_state: `S${(i + 1) % 32}`,
    input: i % 2 === 0 ? '0' : '1',
  })),
  outputs: Object.fromEntries(
    Array.from({ length: 32 }, (_, i) => [`S${i}`, i.toString(2).padStart(5, '0')])
  ),
};
