/**
 * Mermaid stateDiagram-v2 import/export utilities for FSMs
 */

import type { FSM, State, Transition } from '../types/fsm';

// ---------------------------------------------------------------------------
// Export: FSM → Mermaid
// ---------------------------------------------------------------------------

/**
 * Convert an FSM to Mermaid stateDiagram-v2 syntax.
 *
 * Moore machines:  state descriptions carry the output (`S0 : Output = 00`)
 * Mealy machines:  outputs appear on transition labels (`S0 --> S1 : in / out`)
 */
export function fsmToMermaid(fsm: FSM): string {
  const lines: string[] = [];

  // Header comment with metadata
  lines.push(`%% FSM: ${fsm.name}`);
  lines.push(`%% Type: ${fsm.fsm_type}`);
  if (fsm.encoding_type) {
    lines.push(`%% Encoding: ${fsm.encoding_type}`);
  }
  lines.push('');
  lines.push('stateDiagram-v2');

  // Resolve state objects from definition (may be richer than fsm.states strings)
  const stateObjects: State[] = fsm.definition?.states ?? [];
  const stateMap = new Map<string, State>(stateObjects.map((s) => [s.name, s]));

  // Resolve outputs: definition.outputs takes precedence, then fsm.outputs
  const outputMap: Record<string, string> = {
    ...(fsm.outputs ?? {}),
    ...(fsm.definition?.outputs ?? {}),
  };

  // Initial state arrow
  const initial = fsm.initial_state;
  if (initial) {
    lines.push(`    [*] --> ${initial}`);
  }

  // Transitions
  const transitions: Transition[] =
    fsm.definition?.transitions ?? fsm.transitions ?? [];

  for (const t of transitions) {
    const from = t.from_state;
    const to = t.to_state;

    // Build label
    const parts: string[] = [];
    const inputPart = t.input ?? t.label ?? '';
    if (inputPart) parts.push(inputPart);

    if (fsm.fsm_type === 'mealy') {
      const outputPart = t.output ?? '';
      if (outputPart) {
        parts.push(`/ ${outputPart}`);
      } else if (inputPart) {
        // keep only input part
      }
    }

    const label = parts.join(' ');
    if (label) {
      lines.push(`    ${from} --> ${to} : ${label}`);
    } else {
      lines.push(`    ${from} --> ${to}`);
    }
  }

  // State descriptions (Moore outputs or encoding)
  const stateNames = fsm.states ?? [];
  const hasDescriptions =
    fsm.fsm_type === 'moore' &&
    stateNames.some((name) => {
      const stateObj = stateMap.get(name);
      const output = stateObj?.output ?? outputMap[name];
      return output !== undefined && output !== '';
    });

  if (hasDescriptions) {
    lines.push('');
    for (const name of stateNames) {
      const stateObj = stateMap.get(name);
      const output = stateObj?.output ?? outputMap[name];
      if (output !== undefined && output !== '') {
        lines.push(`    ${name} : Output = ${output}`);
      }
    }
  }

  // Encoding annotations (always include if present)
  const encoding = fsm.encoding ?? {};
  const encodingEntries = Object.entries(encoding);
  if (encodingEntries.length > 0) {
    lines.push('');
    lines.push('    %% State Encodings');
    for (const [state, code] of encodingEntries) {
      lines.push(`    %% ${state} = ${code}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Import: Mermaid → FSM partial
// ---------------------------------------------------------------------------

export interface ParsedFSM {
  states: State[];
  transitions: Transition[];
  initialState: string;
  name: string;
}

/**
 * Parse Mermaid stateDiagram-v2 text back into FSM structures.
 *
 * Supported syntax:
 *   [*] --> X            → initial state
 *   A --> B : label      → transition (label optionally split on `/` for Mealy)
 *   A --> B              → transition with no label
 *   A : description      → state description / output
 *   %% comment           → ignored
 *   stateDiagram-v2      → directive, ignored
 *   stateDiagram         → directive, ignored
 */
export function mermaidToFSM(text: string): ParsedFSM {
  if (!text || text.trim() === '') {
    throw new Error('Input is empty');
  }

  const rawLines = text.split('\n');
  const lines = rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  // Validate that this looks like a stateDiagram
  const hasDiagramDirective = lines.some(
    (l) => l === 'stateDiagram-v2' || l === 'stateDiagram',
  );
  if (!hasDiagramDirective) {
    throw new Error(
      'Input does not appear to be a Mermaid stateDiagram. Expected "stateDiagram-v2" directive.',
    );
  }

  // Extract name from first comment line `%% FSM: <name>`
  let name = 'Imported FSM';
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    const nameMatch = trimmed.match(/^%%\s*FSM:\s*(.+)$/);
    if (nameMatch) {
      name = nameMatch[1].trim();
      break;
    }
  }

  let initialState = '';
  const stateNames = new Set<string>();
  const transitions: Transition[] = [];
  const stateDescriptions: Record<string, string> = {};

  // Regex patterns
  const initialRe = /^\[\*\]\s*-->\s*(\S+)$/;
  const transitionRe = /^(\S+)\s*-->\s*(\S+)(?:\s*:\s*(.+))?$/;
  // State description: `StateName : some description` (must not contain -->)
  const descriptionRe = /^(\S+)\s*:\s*(.+)$/;

  for (const line of lines) {
    // Skip directives
    if (line === 'stateDiagram-v2' || line === 'stateDiagram') continue;

    // Initial state
    const initMatch = line.match(initialRe);
    if (initMatch) {
      initialState = initMatch[1];
      stateNames.add(initialState);
      continue;
    }

    // Transition (must come before description check since both share `:`)
    const transMatch = line.match(transitionRe);
    if (transMatch) {
      const from = transMatch[1];
      const to = transMatch[2];

      // Skip if either side is [*] terminal (end state — not initial)
      if (from === '[*]' || to === '[*]') {
        // [*] --> X is initial (handled above); X --> [*] is a terminal note, skip
        if (to !== '[*]') {
          stateNames.add(from);
          stateNames.add(to);
        }
        continue;
      }

      stateNames.add(from);
      stateNames.add(to);

      const rawLabel = transMatch[3]?.trim() ?? '';
      const transition: Transition = {
        from_state: from,
        to_state: to,
      };

      if (rawLabel) {
        // Check for Mealy split: `input / output`
        const slashIdx = rawLabel.indexOf('/');
        if (slashIdx !== -1) {
          transition.input = rawLabel.slice(0, slashIdx).trim();
          transition.output = rawLabel.slice(slashIdx + 1).trim();
        } else {
          transition.input = rawLabel;
        }
        transition.label = rawLabel;
      }

      transitions.push(transition);
      continue;
    }

    // State description: `S0 : Output = 00`
    const descMatch = line.match(descriptionRe);
    if (descMatch) {
      const stateName = descMatch[1];
      const desc = descMatch[2].trim();
      stateDescriptions[stateName] = desc;
      stateNames.add(stateName);
      continue;
    }
  }

  if (stateNames.size === 0) {
    throw new Error('No states found in the diagram. Check transition syntax.');
  }

  if (!initialState && stateNames.size > 0) {
    // Fall back to first state encountered
    initialState = [...stateNames][0];
  }

  // Build State objects
  const states: State[] = [...stateNames].map((sName) => {
    const desc = stateDescriptions[sName];
    // Extract raw output value from description like "Output = 00"
    let output: string | undefined;
    if (desc) {
      const outputMatch = desc.match(/Output\s*=\s*(.+)/i);
      output = outputMatch ? outputMatch[1].trim() : desc;
    }
    return {
      id: sName,
      name: sName,
      ...(output !== undefined ? { output } : {}),
    };
  });

  return { states, transitions, initialState, name };
}
