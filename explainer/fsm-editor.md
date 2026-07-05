# FSM Editor — React Flow, undo/redo, clipboard, mobile

This document covers the FSM editor page in depth: the React Flow
layer, the undo/redo stack, the copy/paste system, the property panel,
the toolbar, the mobile responsive behaviour, keyboard shortcuts, and
the import path.

Files touched most often:
- `frontend/src/pages/EditorPage.tsx` (739 lines)
- `frontend/src/pages/editor/useEditorModals.ts`
- `frontend/src/components/fsm/FSMCanvas.tsx`
- `frontend/src/components/fsm/StateNode.tsx`
- `frontend/src/components/fsm/TransitionEdge.tsx`
- `frontend/src/components/fsm/PropertyPanel.tsx`
- `frontend/src/store/fsmStore.ts`
- `frontend/src/store/fsmHistory.ts`
- `frontend/src/hooks/useKeyboardShortcuts.ts`
- `frontend/src/components/forms/{FSMCreateForm,ImportForm,OptimizationForm,KeyboardShortcutsModal}.tsx`

## 1. The React Flow layer

The graph editor is `reactflow@11`, imported and rendered by
`FSMCanvas` (`frontend/src/components/fsm/FSMCanvas.tsx:1`). React
Flow is a headless graph-editor library that ships primitives
(`ReactFlow`, `Handle`, `useNodesState`, `useEdgesState`, `addEdge`,
`Controls`, `MiniMap`, `Background`) but leaves node/edge rendering
entirely to the consumer.

### Node types

One custom node type is registered: `stateNode` maps to `StateNode`
(`FSMCanvas.tsx:23`). Each state is rendered as:

- A hairline-bordered rectangle (`w-32 min-h-[5rem]`) — no rounded
  corners, no shadows — datasheet aesthetic (`StateNode.tsx:37`).
- Label in mono uppercase (state name) with an optional accent
  subtitle showing the encoding (`"011"` etc.) or the Moore output
  (`StateNode.tsx:88`).
- A status footer with `INITIAL` / `DUMMY` badge when applicable.
- Left-side `<Handle type="target">` and right-side
  `<Handle type="source">` (`StateNode.tsx:75`, `:113`). Both styled
  as tiny accent-filled squares.
- Initial-state indicator: an SVG arrow rendered `absolute -left-7`
  pointing at the node (`StateNode.tsx:56`).
- Border colour encodes type: `border-warn dashed` for dummy states,
  `border-ok` for initial, `border-ink` otherwise. Selection adds an
  inset accent shadow ring.

`memo(StateNode)` (`StateNode.tsx:122`) — critical: without memoization
React Flow re-renders every node on any position change, which is
observable as jank on 40+ node graphs.

### Edge types

`transitionEdge` maps to `TransitionEdge`
(`frontend/src/components/fsm/TransitionEdge.tsx:26`). Custom bezier
edge:

- `getBezierPath` from React Flow computes the SVG path.
- `<BaseEdge>` draws the stroke, colour driven by the `--ink-soft`
  CSS variable (`--accent` when selected).
- `<EdgeLabelRenderer>` puts an absolute-positioned `<div>` at the
  midpoint carrying the label. For Mealy edges (`fsmType === 'mealy'`
  and both `input` and `output` are strings) it renders `input / output`
  with the output in accent (`TransitionEdge.tsx:84`). For Moore edges
  it renders just `input`. Falls back to `data.label` when structured
  fields aren't set.
- `markerEnd` on the base edge draws the arrowhead.

### Layout — where do positions live

State positions live on each `State` object as
`draftStates[i].position: { x: number, y: number }` (see
`frontend/src/types/fsm.ts:6`). React Flow computes screen coordinates
from these on every render. On a drag, React Flow emits `NodeChange`
events; `FSMCanvas.handleNodesChange` (`FSMCanvas.tsx:102`) forwards
each `type === 'position'` change back to
`useFSMStore.updateState(id, { position })`, keeping the store as the
source of truth.

New-state placement lives in `useFSMStore.addState`
(`fsmStore.ts:174`):

```
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
```

A tight 4-column grid. This replaced an earlier circular-layout
placement that computed positions like `radius * cos(angle)` with
`radius = max(120, 80 * min(total, 8))` — for `total >= 8` that pushed
the node to `x ≈ 640` and `y ≈ 300`, sitting well outside React Flow's
default fit-view rectangle. The user would click "Add State" and see
nothing happen; only "Fit View" revealed the exiled node. (The old
formula still lives at `EditorPage.tsx:133` as `handleAddState` — that
function is the caller's *hint* to `addState`; the store now overrides
the position with its grid unless the state's id/name were already
unique. See §3 on dedup for the interaction.)

### Touch and pan configuration

```
// FSMCanvas.tsx:189
panOnDrag={true}
panOnScroll={false}
zoomOnPinch={true}
zoomOnDoubleClick={false}
zoomOnScroll={true}
selectionOnDrag={false}
minZoom={0.2}
maxZoom={2}
```

The `panOnDrag={true}` (boolean, not array) is deliberate. React
Flow's `panOnDrag` accepts either a `boolean` or a `number[]` of
mouse-button indices. The array form is mouse-specific — passing
`[0, 1]` gives you left+middle drag-to-pan, but breaks single-touch
panning on mobile. The boolean form treats "any pointer drag" as pan,
which is what a touch event actually is. Comment at `FSMCanvas.tsx:186`
documents this — it's the kind of subtle configuration detail that's
easy to regress.

`zoomOnDoubleClick={false}` is because double-tap on mobile is
naturally close to double-click on desktop, and the default behaviour
(zoom-in on double-click) fires accidentally when a user is trying to
select an edge.

### MiniMap and Background

`Background` uses `BackgroundVariant.Dots` at `gap={20} size={1}` —
the datasheet-graph-paper look. `MiniMap` is coloured by node type
(blue for initial, warn for dummy, gray for regular).

The MiniMap is wrapped in `<div className="hidden md:block">`
(`FSMCanvas.tsx:202`). Note: the div is *mounted* on mobile too — only
CSS-hidden. That's deliberate. React Flow tracks internal state
(pane transform, selection extents) that is invalidated when a child
node unmounts. CSS-hiding avoids re-mount thrash on viewport transitions
like an iPad rotation crossing the `md` breakpoint.

## 2. Undo / redo

Implementation lives in `frontend/src/store/fsmHistory.ts:32`. It's a
pure `FSMHistory<T>` class with a stack, a cursor, and `MAX_HISTORY = 50`.

### The stack

- `stack: T[]` — snapshots in chronological order.
- `cursor: number` — index of the "current" snapshot; `-1` when empty.

`record(snapshot)` (`fsmHistory.ts:37`) truncates any redo branch
before appending — if the user was two undos back and then makes a new
edit, the two "future" snapshots are dropped. `slice(-MAX_HISTORY)`
caps at 50 entries; oldest are silently dropped.

### Snapshot format

Defined in `fsmStore.ts:5`:

```
interface Snapshot extends FSMSnapshot {
  draftStates: State[];        // deep-cloned with new position objects
  draftTransitions: Transition[];
  draftName: string;
  draftInitialState: string;
}
```

`makeSnapshot` (`fsmStore.ts:79`) deep-clones state objects and
position objects (`{ ...st, position: st.position ? { ...st.position } : undefined }`).
Transitions get a shallow clone (`{ ...t }`) — enough because
transitions are flat records of strings.

### What pushes vs what doesn't

Push (via `pushSnapshot()`):
- `addState` (fsmStore.ts:188)
- `updateState` (fsmStore.ts:228)
- `removeState` (fsmStore.ts:239)
- `addTransition` (fsmStore.ts:244)
- `updateTransition` (fsmStore.ts:253)
- `removeTransition` (fsmStore.ts:260)
- `pasteClipboard` (fsmStore.ts:360)
- `loadFSMIntoDraft` at the end, so an immediate undo returns to
  "as loaded" (fsmStore.ts:307)

Do NOT push:
- `setDraftName` — called on every keystroke; a keystroke-per-snapshot
  would fill the 50-entry cap in ~2 seconds of typing.
- `setDraftDescription`, `setDraftFsmType`, `setDraftInitialState` —
  metadata edits, deliberately outside the undo scope.
- `setSelectedNode` / `setSelectedEdge` — selection isn't
  history-worthy.

Consequence: undoing does *not* revert name/description edits. This
matches user intuition — Ctrl-Z on a text field should be handled by
the browser's own field undo, not the graph undo.

### Cursor semantics and the mirror

`canUndo` returns `cursor > 0` (`fsmHistory.ts:60`); `canRedo` returns
`cursor < stack.length - 1`. Because React components need to
subscribe to these to disable the toolbar buttons, the store mirrors
them into its own state:

```
// fsmStore.ts:126, 137, 148
set({ canUndo: history.canUndo, canRedo: history.canRedo });
```

Any mutator that calls `pushSnapshot()` therefore also writes
`canUndo`/`canRedo` into the store, which triggers React re-renders of
the toolbar. This mirror is what lets `EditorPage.tsx:44` do
`useFSMStore((s) => s.canUndo)` and get a subscribed value.

### Why the history lives outside the store tree

Comment at `fsmStore.ts:96`:

> History stack lives outside the zustand state tree because it's a
> pure data-structure concern, not part of the rendered UI state.
> Components only need to read `canUndo` / `canRedo` (which we do
> mirror into the store), and call `undo()` / `redo()` (which delegate
> to this instance).

Encapsulating the stack outside zustand also means (a) it's testable
without a store, (b) future stores can reuse the class, (c) React
re-renders are driven only by the mirrored booleans, not by every
snapshot append.

## 3. Clipboard — copy / paste of a state

Copy (`fsmStore.ts:310`):

```
copySelected: () => {
  if (!s.selectedNode) return;
  const state = s.draftStates.find(...);
  const connectedTransitions = s.draftTransitions.filter(
    (t) => t.from_state === s.selectedNode || t.to_state === s.selectedNode,
  );
  set({ clipboard: { states: [state], transitions: connectedTransitions } });
}
```

The clipboard captures the selected state plus every transition whose
`from` OR `to` matches — the "star" around the state.

Paste (`fsmStore.ts:321`):

```
1. Generate an id map: oldId → `${oldId}_copy_${timestamp}_${i}`
2. Emit renamed clones: name = `${name}_copy`, position offset by +20 px
3. INCLUDE only transitions where BOTH endpoints are in the copied set
   — this is important; the copy captured "outgoing to arbitrary
   states" transitions too, but the paste can't fabricate targets, so
   it drops them.
4. Select the first pasted state so the user can immediately drag it
```

No OS clipboard integration. Copy/paste only lives inside a single
editor session — refresh the page and the clipboard is gone. Paste
across two FSMs would require serializing to `navigator.clipboard`
which is not currently wired up.

Corollary: a "star" copied out of one FSM into another *would* need
the frontend to detect missing target states and either fabricate
them or reject. Neither is implemented.

## 4. PropertyPanel

`frontend/src/components/fsm/PropertyPanel.tsx` renders the property
editor for the currently selected node or edge. Three render branches
(empty, state, transition) driven by `selectedNode` / `selectedEdge`
in the store.

### The `embedded` prop

```
// PropertyPanel.tsx:11
interface PropertyPanelProps {
  embedded?: boolean;
}
```

When rendered inside the desktop inline sidebar it uses the full card
chrome (`bg-paper rounded-lg shadow p-4 border border-rule`). When
rendered inside the mobile bottom-sheet Modal it drops the outer chrome
(bg, shadow, border, rounded corners) but keeps `p-4` padding
(`PropertyPanel.tsx:12`). This avoids the double-card look — a card
inside a modal already has the modal's own paper background and border.

### The rename cascade

`updateState` in the store (`fsmStore.ts:191`) is where the cascade
lives. Reproduced here for reference:

```
const isRename = !!updates.name && target && updates.name !== target.name;
if (isRename) {
  const newName = updates.name!;
  const collision = s.draftStates.some(
    (st) => st.id !== id && (st.id === newName || st.name === newName),
  );
  if (collision) return s;  // no-op — UI shows the unchanged name
  const oldName = target!.name;
  return {
    draftStates: s.draftStates.map((st) =>
      st.id === id ? { ...st, ...updates, id: newName, name: newName } : st,
    ),
    draftTransitions: s.draftTransitions.map((t) => ({
      ...t,
      from_state: t.from_state === oldName ? newName : t.from_state,
      to_state:   t.to_state   === oldName ? newName : t.to_state,
    })),
    draftInitialState:
      s.draftInitialState === oldName ? newName : s.draftInitialState,
    selectedNode:
      s.selectedNode === oldName ? newName : s.selectedNode,
  };
}
```

Rationale: `id === name` throughout the app. Transitions key by name;
`draftInitialState` stores the name; `selectedNode` stores the id
(which is the name). On rename all four must move in lockstep or the
next render will show orphaned edges pointing at a non-existent state.

Client-side validation lives in the property panel
(`PropertyPanel.tsx:32`):

```
validateStateName(name, currentId):
  if !name.trim()                                → 'Name cannot be empty'
  if /[^a-zA-Z0-9_]/.test(name)                  → 'Only letters, numbers, and underscores allowed'
  if any other state already has that name       → 'Name already exists'
  else null
```

The `updateState(id, { name: ... })` call is only made when the
validator returns null (`PropertyPanel.tsx:84`), so the store rename
cascade only fires on valid names. The store *also* re-checks
collision as a defense-in-depth measure. Two-layer check.

### Delete

State delete: two-click confirm pattern
(`PropertyPanel.tsx:128`). First click sets `pendingDeleteState`
locally. Second click on Confirm calls `removeState(id)`. The store
cascades the delete to any transition whose `from_state` or `to_state`
matched, and clears `selectedNode` if it was the deleted state
(`fsmStore.ts:232`).

## 5. Toolbar

Reading `EditorPage.tsx:358` from left to right:

| Button                       | Behaviour                                    | Mobile treatment       |
| ---------------------------- | -------------------------------------------- | ---------------------- |
| Sidebar toggle               | Toggles `useUIStore.sidebarOpen`             | always visible         |
| Breadcrumb + name + counts   | `Home / <name>`, N states / M transitions    | counts hidden below sm |
| Shortcuts help (?)           | Opens `KeyboardShortcutsModal`               | always icon-only       |
| Undo                         | `useFSMStore.undo()`, disabled on `!canUndo` | always icon-only       |
| Redo                         | `useFSMStore.redo()`, disabled on `!canRedo` | always icon-only       |
| Import                       | Opens `ImportForm` modal                     | icon-only below sm     |
| + Add State                  | Calls `addState({...})`                      | `+ State` below sm     |
| Save / Create                | Update if `:id` present, else opens Create   | full-width label       |
| Optimize                     | Route to `/optimize/:id`                     | full-width label       |
| Lab Report (purple)          | Route to `/optimize/:sourceId`               | icon-only below sm     |
| Export                       | Route to `/export/:id`                       | icon-only below sm     |

### The "already optimized" Optimize state

`EditorPage.tsx:461`:

```
{id && labReportTargetId ? (
  // The loaded FSM is already an optimization result.
  <button disabled title="Already optimized — open Lab Report ...">
    Optimize
  </button>
) : id ? (
  <button onClick={handleOptimize}>Optimize</button>
) : draftStates.length > 0 ? (
  <button disabled title="Save first to enable optimization">Optimize</button>
) : null}
```

Three states:

1. **Loaded FSM has `is_optimized === true`** (and the source id can
   be found in `definition.original_fsm_id`) — Optimize is disabled.
   Comment at `EditorPage.tsx:466` explains why: "Re-running the
   optimizer would just treat the existing `DUMMY_` nodes as ordinary
   states and bridge them with MORE dummies (4→6→10→12 observed in
   the wild)." The Lab Report button (see below) surfaces alongside.

2. **Saved FSM that hasn't been optimized** — Optimize enabled,
   routes to `/optimize/:id`.

3. **Unsaved draft with at least one state** — Optimize disabled;
   tooltip "Save first to enable optimization".

### Lab Report button

`EditorPage.tsx:497`. Only shown when
`currentFSM.is_optimized === true` AND `definition.original_fsm_id`
is a non-empty string. Links to
`/optimize/:original_fsm_id`. Comment at `EditorPage.tsx:59` explains:

> The source id lives in the JSONB `definition` as `original_fsm_id`;
> falling back to undefined hides the button gracefully if a derived
> FSM was saved before that field was added.

This is a defensive read for backwards compat with older rows.

### Save

`EditorPage.tsx:152`. On an existing FSM (`id` present):

```
const stateNames = draftStates.map((s) => s.name);
const states = stateNames.length > 0 ? stateNames : ['S0'];
const initial_state =
  draftInitialState && states.includes(draftInitialState)
    ? draftInitialState
    : states[0];
await updateMutation.mutateAsync({ id, data: {
  name: draftName, states, initial_state,
  transitions: draftTransitions.map(...),
}});
```

The `initial_state` fallback matters — the backend rejects an initial
state that isn't in the states list (422). Sending `states: ['S0']`
when the user has deleted every state prevents a different 422.

If there's no `id` (new FSM) `handleSave` opens the create-form modal
instead (`EditorPage.tsx:181`), since a create needs the extra
metadata (fsm_type, visibility, description) that isn't held in the
draft store.

### Mobile responsive shrink pattern

`hidden sm:inline` on span labels + a mobile-only SVG icon:

```
<button ...>
  <svg className="w-4 h-4 sm:hidden" .../>
  <span className="hidden sm:inline">Import</span>
</button>
```

At `sm+` the SVG is hidden and the text appears; below `sm` the text
is hidden and the SVG appears. The button padding uses `px-2 sm:px-3`
so the icon-only variant is a tight square.

## 6. Mobile responsive behaviour

`EditorPage.tsx:585` renders one `sidebarContent(embedded)` function
twice — once as a desktop inline `<aside>` and once inside a mobile
`Modal` with `position="bottom-sheet"`:

```
<aside className="hidden lg:flex ...">
  {sidebarContent(false)}
</aside>

<div className="lg:hidden">
  <Modal isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
         position="bottom-sheet" title="Properties">
    <div className="flex flex-col gap-4">
      {sidebarContent(true)}
    </div>
  </Modal>
</div>
```

Both variants call the same `sidebarContent` closure but differ in
`embedded`. Result: identical content, different chrome — the desktop
version has the card shadow/borders; the mobile version uses the
Modal's own bottom-sheet chrome.

### Auto-open on selection

`EditorPage.tsx:83`:

```
useEffect(() => {
  if (typeof window === 'undefined') return;
  if (
    !window.matchMedia('(min-width: 1024px)').matches &&
    (selectedNode || selectedEdge)
  ) {
    setSidebarOpen(true);
  }
}, [selectedNode, selectedEdge, setSidebarOpen]);
```

Only fires below `lg` (< 1024 px). Selecting a node on mobile pops the
bottom sheet automatically. Reselecting a different node re-triggers
(the effect dep is the id, not just the "any selection" boolean).

Importantly, the effect only *opens* the drawer — it doesn't force it
open. If the user closes the drawer with the *same* node still selected,
`selectedNode` doesn't change, the effect doesn't refire, the drawer
stays closed. The user has to select a different node to re-trigger.
That behaviour is what the comment at `EditorPage.tsx:80` calls out
("does not snap back open if the user explicitly dismissed the drawer
for the SAME selection").

## 7. Keyboard shortcuts

`frontend/src/hooks/useKeyboardShortcuts.ts:65` is a small
declarative hook. Each shortcut is a `ShortcutDefinition`:

```
{ key: 's', ctrlOrCmd: true, handler: () => handleSave(), description: '...' }
```

The `ctrlOrCmd: true` shorthand matches Ctrl on Windows/Linux and Cmd
on macOS — one definition, two platforms.

`matchesShortcut` (`useKeyboardShortcuts.ts:30`) also **rejects** when
neither `ctrl` nor `cmd` nor `ctrlOrCmd` is declared but one is held.
That means `key: 'delete'` won't fire on `Ctrl+Delete` — avoids
hijacking browser shortcuts.

`isTypingTarget` (`useKeyboardShortcuts.ts:22`) suppresses handling
when the focused element is `INPUT`, `TEXTAREA`, `SELECT`, or
`contenteditable`. Otherwise typing "S" into the state-name input
would trigger the save shortcut.

### Registered shortcuts on `EditorPage`

Definitions at `EditorPage.tsx:247`:

| Combo               | Action                          |
| ------------------- | ------------------------------- |
| `Ctrl/Cmd + S`      | Save (or Create modal if new)   |
| `Ctrl/Cmd + Z`      | Undo                            |
| `Ctrl/Cmd + Shift+Z`| Redo                            |
| `Ctrl/Cmd + Y`      | Redo (alternate)                |
| `Ctrl/Cmd + C`      | Copy selected state             |
| `Ctrl/Cmd + V`      | Paste copied state              |
| `Delete`            | Remove selected element         |
| `Backspace`         | Remove selected element         |
| `Escape`            | Deselect all                    |
| `?`                 | Show keyboard shortcuts modal   |

These are documented for the user in `KeyboardShortcutsModal`
(`frontend/src/components/forms/KeyboardShortcutsModal.tsx:6`). The
modal is a plain `<div role="dialog" aria-modal="true">` overlay, not
routed through the `Modal` primitive — likely because it predates the
current `Modal` component; parity-migrating it would be a small
clean-up.

## 8. Import path

`frontend/src/components/forms/ImportForm.tsx` implements the JSON
import flow. Two entry surfaces: a click-to-browse zone and a
drop zone (both target the same hidden `<input type="file">`).

### Parse and validate

`parseAndValidate` (`ImportForm.tsx:19`) tolerates two shapes:

- Bare `FSMCreate` payload
- Enveloped `{ data: FSMCreate }` — matches what `GET /fsms/:id` returns
  when a user exports and then re-imports.

Validation is intentionally minimal:

- `states` must be a non-empty array
- `transitions` must be an array
- `fsm_type` is coerced to `'moore'` unless explicitly `'mealy'`
- `initial_state` falls back to `states[0]` if missing/invalid
- `visibility` is coerced to `'private'` unless explicitly
  `'public'|'unlisted'`

No Zod schema — the validation is inline. This is deliberately looser
than the create form (`FSMCreateForm.tsx:10` uses Zod) so that
imperfect files (missing metadata, quirky visibility) still parse and
the backend can be the final authority on rejection.

### Preview

On successful parse the form shows a preview card
(`ImportForm.tsx:249`): name, type, state count, transition count.
The user has to click Import to actually POST. Two-step: parse-first
gives the user a look before committing.

### Error surface

Both parse errors and backend errors surface in an alert
(`ImportForm.tsx:226`). Backend errors specifically pull
`AxiosError.response.data.detail` (Pydantic validation detail) so the
user sees "Initial state 'foo' not in states list" instead of a
generic 422 — see the comment at `ImportForm.tsx:155`.

### Post-import navigation

`EditorPage.handleImportSuccess` (`EditorPage.tsx:202`) closes the
modal, toasts "FSM imported successfully", and navigates to
`/editor/<new-id>`.

## 9. Component tree — editor page

```
EditorPage
├── Toolbar
│   ├── Sidebar toggle
│   ├── Breadcrumb + counts
│   ├── Shortcuts (?) button
│   ├── Undo / Redo (grouped)
│   ├── Import
│   ├── + Add State
│   ├── Save / Create
│   ├── Optimize | disabled (already optimized) | disabled (unsaved)
│   ├── Lab Report (conditional)
│   └── Export (conditional)
├── Main area
│   ├── Canvas
│   │   └── FSMCanvas (ErrorBoundary-wrapped)
│   │       ├── StateNode ×N     (memoized)
│   │       ├── TransitionEdge ×M (memoized)
│   │       ├── Controls
│   │       ├── MiniMap (CSS-hidden < md)
│   │       └── Background
│   └── Sidebar (renders sidebarContent(embedded))
│       ├── Desktop:  <aside class="hidden lg:flex">
│       │             └── sidebarContent(false)
│       └── Mobile:   <Modal position="bottom-sheet">
│                     └── sidebarContent(true)
│       (sidebarContent contains: PropertyPanel, State list, Transition list)
├── Create-FSM Modal   (FSMCreateForm)
├── KeyboardShortcuts Modal
└── Import Modal        (ImportForm)
```

## 10. Data flow — one edit round-trip

```
[User drags a state]
    │
    ▼
React Flow emits NodeChange { type: 'position', id, position }
    │
    ▼
FSMCanvas.handleNodesChange (FSMCanvas.tsx:102)
    │
    │  1. onNodesChange(changes)   — updates React Flow's own state
    │  2. change.forEach → useFSMStore.updateState(id, { position })
    │
    ▼
Store updates draftStates; pushSnapshot() records history entry
    │
    ▼
Subscribers with matching selectors re-render:
    • FSMCanvas.initialNodes (useMemo on draftStates) → new nodes array
    • PropertyPanel if selected node is the moved one
    • State list (sidebar)
```

`updateState` cascades to transitions when the update is a rename;
position-only updates are cheap (single-entry replace).

## 11. Common cross-questions

**Q: How do you prevent two rapid clicks on Add State from creating duplicate IDs?**
The dedup lives inside `useFSMStore.addState`'s `set` callback
(`fsmStore.ts:157`). Two rapid clicks batched against the same
`draftStates` snapshot would each try to add "S3" if the caller
computed "next id from length" ahead of the set. Because the id is
computed *inside* the callback from `used = new Set(s.draftStates.map(...))`,
the second click sees the first's state and gets "S4" instead. The
caller's `id`/`name`/`position` hints are honoured only if they don't
collide.

**Q: What if the user drags a state off-screen? How do they find it?**
Two answers. First, the new-state grid placement now keeps
newly-added nodes inside the initial React Flow viewport
(`fsmStore.ts:174`) — the old circular-layout bug that pushed states
to ±640 px is fixed. Second, for existing states that a user drags
away, the React Flow `<Controls>` widget includes a "Fit View" button
(`FSMCanvas.tsx:199`) that re-frames the entire graph. On mobile the
MiniMap is CSS-hidden but still mounted — pinch-zoom out to see all
nodes.

**Q: How is the initial-state pointer maintained on rename?**
It's cascaded inside `updateState` (`fsmStore.ts:217`):
`draftInitialState: s.draftInitialState === oldName ? newName : s.draftInitialState`.
So renaming the initial state renames both the state and the pointer
in a single atomic zustand `set` call. If the rename is a collision
(`fsmStore.ts:204`), the whole update is a no-op and the pointer
stays valid because nothing moved.

**Q: Can I paste across different FSMs?**
No. The clipboard lives in `useFSMStore.clipboard`, which resets on
`resetDraft()` (`fsmStore.ts:263`). Navigating between two editor
pages triggers a `useEffect` that resets the draft
(`EditorPage.tsx:105`) unless the destination is a load-into-draft
flow. Even if the clipboard *survived* the navigation, the paste
would drop transitions whose endpoints don't exist in the target
draft — the paste code at `fsmStore.ts:343` explicitly filters
transitions to those whose endpoints are in the copied set. Adding
cross-FSM paste would need `navigator.clipboard.writeText`
serialization and endpoint reconciliation.

**Q: How is the mobile bottom-sheet composed with modals opened on top?**
The Modal primitive uses a module-level ref-counted body scroll lock
(`Modal.tsx:38`). When the property drawer opens, `lockCount → 1`,
body overflow becomes `hidden`. If the user then opens the Create
modal on top, `lockCount → 2`. Closing the Create modal decrements to
1; body stays locked. Closing the property drawer decrements to 0;
body overflow restores to its pre-lock value. This composition means
the outer sheet doesn't need to know about the inner modal.

**Q: What's the maximum FSM size the editor can handle? What breaks first?**
Empirically: React Flow renders 200-node graphs smoothly at 60fps
because both `StateNode` and `TransitionEdge` are `memo`-wrapped.
Around 500 states you start seeing pan jank on mid-range laptops —
the `useMemo`s in `FSMCanvas.tsx:86` re-derive the full nodes array
on any store write; even a memoized subtree costs O(N) reconciliation
diff. Beyond 1000, the deep-clone in `makeSnapshot`
(`fsmStore.ts:79`) starts showing in the profiler — each edit
allocates a fresh copy of every state and its position object. The
first structural fix would be moving to a shallow-clone snapshot with
copy-on-write positions; the second would be virtualizing React Flow
(there's no built-in virtualization). In practice the backend
optimizer's ceiling (Gray-code encoding is exponential in bits) is
lower than any of these frontend limits.
