/**
 * Snapshot-based undo/redo for the FSM draft.
 *
 * Pure logic, no zustand or React. Lives in its own file so the
 * stack-management code is testable without spinning up a store, and so
 * future stores can reuse it.
 *
 * The previous implementation interleaved this logic with the store
 * mutators — every mutator manually called `pushSnapshot()`, and the
 * `history`/`historyIndex`/`canUndo`/`canRedo` fields were tracked on
 * the store itself. That made every mutation site a potential source
 * of "forgot to push" bugs and tied undo/redo to the specific draft
 * shape (couldn't handle, e.g., per-field changes differently).
 *
 * The audit recommended decoupling via zustand subscription middleware
 * for fully-automatic capture. That has higher regression risk because
 * subscription order matters and some mutations should NOT push (e.g.
 * an undo itself shouldn't push). This file is a step toward that —
 * the stack is encapsulated and testable; the store still calls
 * `record()` explicitly, but only one helper, in one place.
 */

export interface FSMSnapshot {
  draftStates: unknown;       // domain-shape lives in fsmStore.ts
  draftTransitions: unknown;
  draftName: string;
  draftInitialState: string;
}

const MAX_HISTORY = 50;

export class FSMHistory<T extends FSMSnapshot = FSMSnapshot> {
  private stack: T[] = [];
  private cursor = -1; // -1 = empty; otherwise index into stack of "current"

  /** Push a snapshot. Truncates any redo branch. Caps at MAX_HISTORY. */
  record(snapshot: T): void {
    // If we're not at the tip (i.e. user did some undos), discard the
    // redo branch — recording a new mutation forks history.
    const base = this.stack.slice(0, this.cursor + 1);
    const next = [...base, snapshot].slice(-MAX_HISTORY);
    this.stack = next;
    this.cursor = next.length - 1;
  }

  /** Move cursor back one. Returns the snapshot to apply, or null if at start. */
  undo(): T | null {
    if (this.cursor <= 0) return null;
    this.cursor -= 1;
    return this.stack[this.cursor];
  }

  /** Move cursor forward one. Returns the snapshot to apply, or null if at tip. */
  redo(): T | null {
    if (this.cursor >= this.stack.length - 1) return null;
    this.cursor += 1;
    return this.stack[this.cursor];
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.stack.length - 1;
  }

  /** Reset to empty — used by `resetDraft` and `loadFSMIntoDraft`. */
  reset(): void {
    this.stack = [];
    this.cursor = -1;
  }
}
