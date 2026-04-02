import { create } from 'zustand';
import type { FSM, State, Transition } from '../types/fsm';

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
}

const initialDraftState = {
  draftStates: [],
  draftTransitions: [],
  draftName: '',
  draftDescription: '',
  draftFsmType: 'moore' as const,
  draftInitialState: '',
};

export const useFSMStore = create<FSMStore>((set) => ({
  currentFSM: null,
  selectedNode: null,
  selectedEdge: null,
  isEditing: false,
  ...initialDraftState,

  setCurrentFSM: (fsm) => set({ currentFSM: fsm }),
  setSelectedNode: (id) => set({ selectedNode: id, selectedEdge: null }),
  setSelectedEdge: (id) => set({ selectedEdge: id, selectedNode: null }),
  setIsEditing: (editing) => set({ isEditing: editing }),

  setDraftName: (name) => set({ draftName: name }),
  setDraftDescription: (description) => set({ draftDescription: description }),
  setDraftFsmType: (type) => set({ draftFsmType: type }),
  setDraftInitialState: (state) => set({ draftInitialState: state }),

  addState: (state) =>
    set((s) => ({ draftStates: [...s.draftStates, state] })),

  updateState: (id, updates) =>
    set((s) => ({
      draftStates: s.draftStates.map((st) =>
        st.id === id ? { ...st, ...updates } : st
      ),
    })),

  removeState: (id) =>
    set((s) => ({
      draftStates: s.draftStates.filter((st) => st.id !== id),
      draftTransitions: s.draftTransitions.filter(
        (t) => t.from_state !== id && t.to_state !== id
      ),
      selectedNode: s.selectedNode === id ? null : s.selectedNode,
    })),

  addTransition: (transition) =>
    set((s) => ({ draftTransitions: [...s.draftTransitions, transition] })),

  updateTransition: (index, updates) =>
    set((s) => ({
      draftTransitions: s.draftTransitions.map((t, i) =>
        i === index ? { ...t, ...updates } : t
      ),
    })),

  removeTransition: (index) =>
    set((s) => ({
      draftTransitions: s.draftTransitions.filter((_, i) => i !== index),
    })),

  resetDraft: () => set({ ...initialDraftState, selectedNode: null, selectedEdge: null }),

  loadFSMIntoDraft: (fsm) =>
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
    }),
}));
