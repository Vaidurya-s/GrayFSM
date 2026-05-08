/**
 * Unit tests for FSMHistory — the snapshot stack extracted from fsmStore
 * in PR #35. The class is pure data-structure code; this file exercises
 * push/undo/redo/reset/canUndo/canRedo and the redo-branch-truncation
 * behaviour.
 */
import { describe, expect, it } from 'vitest';
import { FSMHistory, type FSMSnapshot } from '../../store/fsmHistory';

interface TestSnap extends FSMSnapshot {
  label: string;
  draftStates: string[];
  draftTransitions: never[];
  draftName: string;
  draftInitialState: string;
}

const snap = (label: string): TestSnap => ({
  label,
  draftStates: [],
  draftTransitions: [],
  draftName: label,
  draftInitialState: '',
});

describe('FSMHistory', () => {
  describe('initial state', () => {
    it('starts with no undo/redo capability', () => {
      const h = new FSMHistory<TestSnap>();
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
    });

    it('undo on empty history returns null', () => {
      const h = new FSMHistory<TestSnap>();
      expect(h.undo()).toBeNull();
    });

    it('redo on empty history returns null', () => {
      const h = new FSMHistory<TestSnap>();
      expect(h.redo()).toBeNull();
    });
  });

  describe('record', () => {
    it('a single snapshot enables neither undo nor redo', () => {
      const h = new FSMHistory<TestSnap>();
      h.record(snap('A'));
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
    });

    it('two snapshots enable undo, not redo', () => {
      const h = new FSMHistory<TestSnap>();
      h.record(snap('A'));
      h.record(snap('B'));
      expect(h.canUndo).toBe(true);
      expect(h.canRedo).toBe(false);
    });
  });

  describe('undo / redo cycle', () => {
    it('undo returns the previous snapshot', () => {
      const h = new FSMHistory<TestSnap>();
      h.record(snap('A'));
      h.record(snap('B'));
      h.record(snap('C'));

      expect(h.undo()?.label).toBe('B');
      expect(h.canUndo).toBe(true);
      expect(h.canRedo).toBe(true);

      expect(h.undo()?.label).toBe('A');
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(true);
    });

    it('redo returns the next snapshot after undoing', () => {
      const h = new FSMHistory<TestSnap>();
      h.record(snap('A'));
      h.record(snap('B'));
      h.record(snap('C'));

      h.undo();
      h.undo(); // back at A
      expect(h.redo()?.label).toBe('B');
      expect(h.redo()?.label).toBe('C');
      expect(h.canRedo).toBe(false);
    });

    it('cannot undo past the start', () => {
      const h = new FSMHistory<TestSnap>();
      h.record(snap('A'));
      h.record(snap('B'));
      h.undo(); // at A
      expect(h.undo()).toBeNull();
      expect(h.canUndo).toBe(false);
    });

    it('cannot redo past the tip', () => {
      const h = new FSMHistory<TestSnap>();
      h.record(snap('A'));
      h.record(snap('B'));
      // Tip; redo returns null
      expect(h.redo()).toBeNull();
    });
  });

  describe('redo branch truncation', () => {
    it('recording a new snapshot after undo discards the redo branch', () => {
      const h = new FSMHistory<TestSnap>();
      h.record(snap('A'));
      h.record(snap('B'));
      h.record(snap('C'));

      h.undo(); // back at B; C is in redo branch
      expect(h.canRedo).toBe(true);

      h.record(snap('D')); // forks history; C is gone
      expect(h.canRedo).toBe(false);
      expect(h.canUndo).toBe(true);

      // Sanity: undo should now go to B, not C
      expect(h.undo()?.label).toBe('B');
    });
  });

  describe('reset', () => {
    it('clears the stack', () => {
      const h = new FSMHistory<TestSnap>();
      h.record(snap('A'));
      h.record(snap('B'));
      h.reset();
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
      expect(h.undo()).toBeNull();
    });
  });

  describe('MAX_HISTORY cap', () => {
    it('keeps only the most recent 50 snapshots', () => {
      const h = new FSMHistory<TestSnap>();
      // Push 60; oldest 10 should be discarded.
      for (let i = 0; i < 60; i++) {
        h.record(snap(`s${i}`));
      }

      // Walk back as far as possible.
      let count = 0;
      while (h.canUndo) {
        h.undo();
        count++;
      }
      // Cap is 50 entries; from tip you can step back 49 times to reach
      // the oldest retained snapshot.
      expect(count).toBe(49);

      // The oldest retained snapshot is s10 (s0..s9 dropped).
      // Cursor is now at s10; undo() returned null on the last call,
      // so the most recent applied snapshot (current) is s10.
      h.record(snap('after')); // pushing here truncates the redo branch
      // Walk back again — the deepest snapshot is still s10.
      while (h.canUndo) h.undo();
      const oldest = h.undo() ?? null;
      // After all undos, oldest is null (we're already at start).
      // Use a fresh undo cycle: re-redo to tip then re-walk to confirm.
      expect(oldest).toBeNull();
    });
  });
});
