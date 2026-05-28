import { create } from 'zustand';
import type { FSM, State, Transition } from '../types/fsm';
import { FSMHistory, type FSMSnapshot } from './fsmHistory';

interface Snapshot extends FSMSnapshot {
  draftStates: State[];
  draftTransitions: Transition[];
  draftName: string;
  draftInitialState: string;
}

interface FSMStore {
  currentFSM: FSM | null;
  selectedNode: string | null;
  selectedEdge: string | null;
  isEditing: boolean;
  draftStates: State[];
  draftTransitions: Transition[];
  draftName: string;
  draftDescription: string;
  draftFsmType: 'moore' | 'mealy';
  draftInitialState: string;
  /** Map from state name → encoding string (e.g. "S0" → "011"). Populated
   *  from `fsm.encoding` on load; consumed by FSMCanvas to render the
   *  encoding subtitle on each StateNode. Empty when no encoding is
   *  attached to the FSM. */
  draftEncoding: Record<string, string>;

  // Undo/redo cursor mirror — kept in store state because React components
  // subscribe to canUndo/canRedo to disable buttons. The actual stack lives
  // in the `FSMHistory` instance below.
  canUndo: boolean;
  canRedo: boolean;

  // Clipboard
  clipboard: { states: State[]; transitions: Transition[] } | null;

  setCurrentFSM: (fsm: FSM | null) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  setIsEditing: (editing: boolean) => void;

  setDraftName: (name: string) => void;
  setDraftDescription: (description: string) => void;
  setDraftFsmType: (type: 'moore' | 'mealy') => void;
  setDraftInitialState: (state: string) => void;

  addState: (state: State) => void;
  updateState: (id: string, updates: Partial<State>) => void;
  removeState: (id: string) => void;

  addTransition: (transition: Transition) => void;
  updateTransition: (index: number, updates: Partial<Transition>) => void;
  removeTransition: (index: number) => void;

  resetDraft: () => void;
  loadFSMIntoDraft: (fsm: FSM) => void;

  // Undo/redo actions
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Copy/paste actions
  copySelected: () => void;
  pasteClipboard: () => void;
}

const initialDraftState = {
  draftStates: [] as State[],
  draftTransitions: [] as Transition[],
  draftName: '',
  draftDescription: '',
  draftFsmType: 'moore' as const,
  draftInitialState: '',
  draftEncoding: {} as Record<string, string>,
};

function makeSnapshot(s: {
  draftStates: State[];
  draftTransitions: Transition[];
  draftName: string;
  draftInitialState: string;
}): Snapshot {
  return {
    draftStates: s.draftStates.map((st) => ({
      ...st,
      position: st.position ? { ...st.position } : undefined,
    })),
    draftTransitions: s.draftTransitions.map((t) => ({ ...t })),
    draftName: s.draftName,
    draftInitialState: s.draftInitialState,
  };
}

// History stack lives outside the zustand state tree because it's a pure
// data-structure concern, not part of the rendered UI state. Components
// only need to read `canUndo` / `canRedo` (which we do mirror into the
// store), and call `undo()` / `redo()` (which delegate to this instance).
const history = new FSMHistory<Snapshot>();

export const useFSMStore = create<FSMStore>((set, get) => ({
  currentFSM: null,
  selectedNode: null,
  selectedEdge: null,
  isEditing: false,
  ...initialDraftState,

  canUndo: false,
  canRedo: false,

  clipboard: null,

  setCurrentFSM: (fsm) => set({ currentFSM: fsm }),
  setSelectedNode: (id) => set({ selectedNode: id, selectedEdge: null }),
  setSelectedEdge: (id) => set({ selectedEdge: id, selectedNode: null }),
  setIsEditing: (editing) => set({ isEditing: editing }),

  setDraftName: (name) => set({ draftName: name }),
  setDraftDescription: (description) => set({ draftDescription: description }),
  setDraftFsmType: (type) => set({ draftFsmType: type }),
  setDraftInitialState: (state) => set({ draftInitialState: state }),

  pushSnapshot: () => {
    history.record(makeSnapshot(get()));
    set({ canUndo: history.canUndo, canRedo: history.canRedo });
  },

  undo: () => {
    const snap = history.undo();
    if (!snap) return;
    set({
      draftStates: snap.draftStates,
      draftTransitions: snap.draftTransitions,
      draftName: snap.draftName,
      draftInitialState: snap.draftInitialState,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    });
  },

  redo: () => {
    const snap = history.redo();
    if (!snap) return;
    set({
      draftStates: snap.draftStates,
      draftTransitions: snap.draftTransitions,
      draftName: snap.draftName,
      draftInitialState: snap.draftInitialState,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    });
  },

  addState: (state) => {
    // Compute id/name/position INSIDE the set callback so two rapid clicks
    // (which React batches against the same `draftStates` snapshot) can't
    // produce duplicate IDs/positions. The caller's hints are honoured only
    // if they don't collide with existing states.
    set((s) => {
      const used = new Set(s.draftStates.map((st) => st.id));
      let id = state.id;
      let name = state.name;
      if (!id || !name || used.has(id) || used.has(name)) {
        let n = 0;
        while (used.has(`S${n}`)) n++;
        id = `S${n}`;
        name = `S${n}`;
      }
      // Position: derived from the deduped id's numeric suffix so two states
      // can never land on the same spot. Tight 4-column grid so newly-added
      // nodes stay in the initial React Flow viewport (no "where did my state
      // go?" — previous circular layout pushed nodes out to ±640 px which
      // sat outside the default visible area until the user hit Fit View).
      const m = id.match(/^S(\d+)$/);
      const i = m ? parseInt(m[1], 10) : s.draftStates.length;
      const cols = 4;
      const dx = 160;
      const dy = 130;
      const startX = 80;
      const startY = 80;
      const position = {
        x: startX + (i % cols) * dx,
        y: startY + Math.floor(i / cols) * dy,
      };
      return { draftStates: [...s.draftStates, { ...state, id, name, position }] };
    });
    get().pushSnapshot();
  },

  updateState: (id, updates) => {
    set((s) => {
      const target = s.draftStates.find((st) => st.id === id);
      // The app uses `id === name` everywhere (transitions key by name, the
      // initial-state pointer stores the name). On rename we update the
      // id too AND cascade the new name into transitions + draftInitialState
      // so the sidebar list, the canvas labels, and the initial-state badge
      // all stay in sync. Abort the rename on collision so two states can't
      // end up with the same identifier.
      const isRename = !!updates.name && target && updates.name !== target.name;
      if (isRename) {
        const newName = updates.name!;
        const collision = s.draftStates.some(
          (st) => st.id !== id && (st.id === newName || st.name === newName),
        );
        if (collision) return s; // no-op; UI shows the unchanged name
        const oldName = target!.name;
        return {
          draftStates: s.draftStates.map((st) =>
            st.id === id ? { ...st, ...updates, id: newName, name: newName } : st,
          ),
          draftTransitions: s.draftTransitions.map((t) => ({
            ...t,
            from_state: t.from_state === oldName ? newName : t.from_state,
            to_state: t.to_state === oldName ? newName : t.to_state,
          })),
          draftInitialState:
            s.draftInitialState === oldName ? newName : s.draftInitialState,
          selectedNode: s.selectedNode === oldName ? newName : s.selectedNode,
        };
      }
      return {
        draftStates: s.draftStates.map((st) =>
          st.id === id ? { ...st, ...updates } : st,
        ),
      };
    });
    get().pushSnapshot();
  },

  removeState: (id) => {
    set((s) => ({
      draftStates: s.draftStates.filter((st) => st.id !== id),
      draftTransitions: s.draftTransitions.filter(
        (t) => t.from_state !== id && t.to_state !== id,
      ),
      selectedNode: s.selectedNode === id ? null : s.selectedNode,
    }));
    get().pushSnapshot();
  },

  addTransition: (transition) => {
    set((s) => ({ draftTransitions: [...s.draftTransitions, transition] }));
    get().pushSnapshot();
  },

  updateTransition: (index, updates) => {
    set((s) => ({
      draftTransitions: s.draftTransitions.map((t, i) =>
        i === index ? { ...t, ...updates } : t,
      ),
    }));
    get().pushSnapshot();
  },

  removeTransition: (index) => {
    set((s) => ({
      draftTransitions: s.draftTransitions.filter((_, i) => i !== index),
    }));
    get().pushSnapshot();
  },

  resetDraft: () => {
    history.reset();
    set({
      ...initialDraftState,
      selectedNode: null,
      selectedEdge: null,
      canUndo: false,
      canRedo: false,
      clipboard: null,
    });
  },

  loadFSMIntoDraft: (fsm) => {
    history.reset();
    set({
      currentFSM: fsm,
      draftName: fsm.name,
      draftDescription: fsm.description || '',
      draftFsmType: fsm.fsm_type,
      draftInitialState: fsm.initial_state,
      // Prefer the rich State[] from definition only when it actually
      // has entries; a truthy-but-empty array would suppress the
      // string-list fall-through and silently drop all states.
      draftStates:
        fsm.definition?.states && fsm.definition.states.length > 0
          ? fsm.definition.states
          : (fsm.states ?? []).map((name, i) => ({
              id: name,
              name,
              position: { x: 150 + (i % 4) * 200, y: 100 + Math.floor(i / 4) * 150 },
            })),
      draftTransitions:
        fsm.transitions && fsm.transitions.length > 0
          ? fsm.transitions
          : (fsm.definition?.transitions ?? []),
      // Encoding map is optional on the FSM payload — fall back to {} so
      // the StateNode renders without an encoding subtitle when missing.
      draftEncoding: fsm.encoding ?? {},
      isEditing: true,
      canUndo: false,
      canRedo: false,
    });
    // Push the initial loaded state as the first history entry, so an
    // immediate undo can return to "as-loaded".
    get().pushSnapshot();
  },

  copySelected: () => {
    const s = get();
    if (!s.selectedNode) return;
    const state = s.draftStates.find((st) => st.id === s.selectedNode);
    if (!state) return;
    const connectedTransitions = s.draftTransitions.filter(
      (t) => t.from_state === s.selectedNode || t.to_state === s.selectedNode,
    );
    set({ clipboard: { states: [state], transitions: connectedTransitions } });
  },

  pasteClipboard: () => {
    const s = get();
    if (!s.clipboard || s.clipboard.states.length === 0) return;

    const timestamp = Date.now();
    // Build a map from old ID to new ID
    const idMap: Record<string, string> = {};
    const newStates: State[] = s.clipboard.states.map((st, i) => {
      const newId = `${st.id}_copy_${timestamp}_${i}`;
      idMap[st.id] = newId;
      return {
        ...st,
        id: newId,
        name: `${st.name}_copy`,
        position: st.position
          ? { x: st.position.x + 20, y: st.position.y + 20 }
          : undefined,
      };
    });

    // Only include transitions where BOTH endpoints are in the copied set
    const copiedIds = new Set(Object.keys(idMap));
    const newTransitions: Transition[] = s.clipboard.transitions
      .filter((t) => copiedIds.has(t.from_state) && copiedIds.has(t.to_state))
      .map((t) => ({
        ...t,
        id: t.id ? `${t.id}_copy_${timestamp}` : undefined,
        from_state: idMap[t.from_state],
        to_state: idMap[t.to_state],
      }));

    // Select the first pasted state so the user can move it immediately
    const firstNewId = newStates.length > 0 ? newStates[0].id : null;
    set((prev) => ({
      draftStates: [...prev.draftStates, ...newStates],
      draftTransitions: [...prev.draftTransitions, ...newTransitions],
      selectedNode: firstNewId,
      selectedEdge: null,
    }));
    get().pushSnapshot();
  },
}));
