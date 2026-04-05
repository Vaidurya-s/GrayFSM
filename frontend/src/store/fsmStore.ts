import { create } from 'zustand';
import type { FSM, State, Transition } from '../types/fsm';

interface Snapshot {
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

  // Undo/redo history
  history: Snapshot[];
  historyIndex: number;
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

const MAX_HISTORY = 50;

const initialDraftState = {
  draftStates: [],
  draftTransitions: [],
  draftName: '',
  draftDescription: '',
  draftFsmType: 'moore' as const,
  draftInitialState: '',
};

function makeSnapshot(s: {
  draftStates: State[];
  draftTransitions: Transition[];
  draftName: string;
  draftInitialState: string;
}): Snapshot {
  return {
    draftStates: s.draftStates.map((st) => ({ ...st, position: st.position ? { ...st.position } : undefined })),
    draftTransitions: s.draftTransitions.map((t) => ({ ...t })),
    draftName: s.draftName,
    draftInitialState: s.draftInitialState,
  };
}

export const useFSMStore = create<FSMStore>((set, get) => ({
  currentFSM: null,
  selectedNode: null,
  selectedEdge: null,
  isEditing: false,
  ...initialDraftState,

  // Undo/redo history — starts empty; first mutation pushes initial + new snapshot
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  // Clipboard
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
    const s = get();
    const snap = makeSnapshot(s);
    // If we are not at the end, discard future history
    const base = s.history.slice(0, s.historyIndex + 1);
    const next = [...base, snap].slice(-MAX_HISTORY);
    const nextIndex = next.length - 1;
    set({
      history: next,
      historyIndex: nextIndex,
      canUndo: nextIndex > 0,
      canRedo: false,
    });
  },

  undo: () => {
    const s = get();
    if (s.historyIndex <= 0) return;
    const newIndex = s.historyIndex - 1;
    const snap = s.history[newIndex];
    set({
      draftStates: snap.draftStates,
      draftTransitions: snap.draftTransitions,
      draftName: snap.draftName,
      draftInitialState: snap.draftInitialState,
      historyIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) return;
    const newIndex = s.historyIndex + 1;
    const snap = s.history[newIndex];
    set({
      draftStates: snap.draftStates,
      draftTransitions: snap.draftTransitions,
      draftName: snap.draftName,
      draftInitialState: snap.draftInitialState,
      historyIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < s.history.length - 1,
    });
  },

  addState: (state) => {
    set((s) => ({ draftStates: [...s.draftStates, state] }));
    get().pushSnapshot();
  },

  updateState: (id, updates) => {
    set((s) => ({
      draftStates: s.draftStates.map((st) =>
        st.id === id ? { ...st, ...updates } : st
      ),
    }));
    get().pushSnapshot();
  },

  removeState: (id) => {
    set((s) => ({
      draftStates: s.draftStates.filter((st) => st.id !== id),
      draftTransitions: s.draftTransitions.filter(
        (t) => t.from_state !== id && t.to_state !== id
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
        i === index ? { ...t, ...updates } : t
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

  resetDraft: () =>
    set({
      ...initialDraftState,
      selectedNode: null,
      selectedEdge: null,
      history: [],
      historyIndex: -1,
      canUndo: false,
      canRedo: false,
      clipboard: null,
    }),

  loadFSMIntoDraft: (fsm) => {
    set({
      currentFSM: fsm,
      draftName: fsm.name,
      draftDescription: fsm.description || '',
      draftFsmType: fsm.fsm_type,
      draftInitialState: fsm.initial_state,
      draftStates:
        fsm.definition?.states ||
        fsm.states.map((name, i) => ({
          id: name,
          name,
          position: { x: 150 + (i % 4) * 200, y: 100 + Math.floor(i / 4) * 150 },
        })),
      draftTransitions: fsm.transitions || [],
      isEditing: true,
      // Reset history when loading a new FSM
      history: [],
      historyIndex: -1,
      canUndo: false,
      canRedo: false,
    });
    // Push the initial loaded state as the first history entry
    get().pushSnapshot();
  },

  copySelected: () => {
    const s = get();
    if (!s.selectedNode) return;
    const state = s.draftStates.find((st) => st.id === s.selectedNode);
    if (!state) return;
    const connectedTransitions = s.draftTransitions.filter(
      (t) => t.from_state === s.selectedNode || t.to_state === s.selectedNode
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
