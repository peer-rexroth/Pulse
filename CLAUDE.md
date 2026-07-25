# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Pulse is a single-file, zero-dependency HTML application — the entire app (HTML, CSS, JavaScript) lives in `pulse.html`. There is no build step and no package manager. It's a local-first programme dashboard: workstreams, scope items and milestones tracked with RAG status, shown as either a status board or a date-scaled timeline. It's also an installable PWA (manifest, service worker, icons), and now has the same data-durability feature set as this author's other single-file apps (PromptLab, mytasks): JSON export/import, rolling local backups, deletion tombstones with undo, and optional File System Access API file sync — see "Data durability" below.

## Running it

A plain `file://` open of `pulse.html` works fine for quick checks, but PWA install/offline support requires serving it over http — browsers refuse to register a service worker for `file://` pages. `./start-pulse.command` serves the directory on `http://127.0.0.1:8936` and opens it in Chrome/Edge (Safari can't install this kind of PWA on macOS). `./stop-pulse.command` kills the server.

## Tests

There's no lint config, but there is a test suite at `tests/`: extract the inline `<script>` block, mock just enough of the DOM (`document.getElementById` returning cached fake elements with a settable `innerHTML`/`value`, plus `localStorage`, `navigator`, `window`, `location`, `Blob`/`URL` for the export/download path) and `eval()` the real code in a headless JS engine (`osascript -l JavaScript` — JavaScriptCore, no Node install needed). `indexedDB` is deliberately *not* mocked — see "File System Access API sync" below for which functions that rules out testing directly.

Run it with `./tests/run.sh` (optionally `./tests/run.sh someSubstring` to run only tests whose name contains that substring). No install step.

Add a test by dropping a `tests/cases/*.test.js` file with `test('description', function(){ ... })` calls. All app code plus every `tests/cases/*.test.js` file get concatenated and `eval()`'d *together* in one call, which is why a test can read/reassign `workstreams`, `items`, `view`, `filterWorkstreamId` and the other top-level `let` state directly by bare name, and call any of the app's real functions — they're all sharing the same eval'd lexical scope. `tests/harness.js` calls `resetState()` (glue-defined: `seedDefaults()` + resets the UI-transient module vars + `normalizeData()`) and clears the fake DOM before every test, so tests never see state left over from another test — write fixtures at the top of each test rather than relying on run order.

One mock limitation worth knowing: the fake `<select>`/`<input>` elements don't parse `innerHTML` into `.value` the way a real browser does, so a test that wants to assert "this option got preselected" must check the rendered `innerHTML` string for `selected`/`value="..."` rather than reading `.value` after a `populate*Select()` call — see `tests/cases/items.test.js`'s "preselects the given workstream" test for the pattern. Tests that set form values *before* calling `save*()` set `.value` directly instead, which the mock does support.

## Architecture

The file has three logical sections in order: CSS styles, HTML structure, and a `<script>` block containing all application logic.

### Data model

All state is stored in `localStorage` under the key `"pulse-v1"` and serialised as JSON with this shape:

```json
{
  "programme": { "name": "..." },
  "workstreams": [...],
  "items": [...],
  "view": "status" | "timeline",
  "theme": "light" | "dark",
  "filterWorkstreamId": null | "wsId",
  "deletedWorkstreamIds": [{"id": "...", "deletedAt": 0}],
  "deletedItemIds": [{"id": "...", "deletedAt": 0}]
}
```

A **workstream**:
```js
{ id: String, name: String, color: String, order: Number }  // color is a name key from WS_COLORS
```

An **item** (a scope item — the only top-level item type; see "Milestones" below):
```js
{
  id: String,
  workstreamId: String,
  name: String,
  owner: String,
  notes: String,
  status: 'not-started' | 'green' | 'amber' | 'red' | 'complete',
  startDate: String,   // 'YYYY-MM-DD'
  dueDate: String,     // 'YYYY-MM-DD'
  updatedAt: Number,   // Date.now() — last-write-wins timestamp for merge (see "Data durability")
  milestones: [Milestone]
}
```

Workstreams have no `updatedAt` (mirroring mytasks' projects) — see "Merge and last-write-wins" below for what that means for a deleted workstream.

A **milestone** — nested inside its parent item, not a top-level array:
```js
{ id: String, name: String, dueDate: String, status: 'not-started' | 'green' | 'amber' | 'red' | 'complete' }
```

Milestones don't have their own `owner`/`notes`/`startDate` — they're a lightweight checklist against a single date, deliberately kept smaller than the item shape rather than reusing it. There's no independent roll-up: an item's own `status` is set manually, same as before, and is *not* computed from its milestones' statuses — see "Milestone checklist" below for why.

### RAG status

`STATUSES` (top of the `<script>` block) is the single source of truth for the five status values and their labels: Not Started, On Track (green), At Risk (amber), Off Track (red), Complete (blue). Status drives an item's color everywhere it appears — the status badge in the status board, and the bar/diamond fill in the timeline. Workstream color (`WS_COLORS`, a separate 8-hue palette) is used only for the sidebar dot, the status-board section header tint, and the timeline lane label dot — it never colors an item, since status is the signal a programme dashboard is meant to surface at a glance.

### Rendering pattern

Direct DOM re-renders (no virtual DOM or framework). `render()` does a full re-render (topbar bits + sidebar + main); `renderSidebar()` and `renderMain()` handle their halves independently. Every state mutation calls `save()` then one of these. `renderMain()` dispatches to `renderStatusView()` or `renderTimelineView()` based on the `view` flag — if you add a mutation that should be reflected live, make sure it calls `render()` (or at least the render function covering whatever it changed), not a narrower one that happens to work for today's call site.

### Status board (`renderStatusView`)

One `.ws-section` per visible workstream (filtered by `filterWorkstreamId` via `visibleWorkstreams()`), each showing a RAG count summary (`STATUSES` filtered to non-zero counts) and its items sorted by `dueDate` ascending. `itemRowHtml(it)` renders the item's own row plus, if `expandedItemIds` (a module-level `Set`, UI-only — not persisted, resets on reload) has that item's id, its nested milestone rows (`milestoneRowsHtml`, sorted by `dueDate`) immediately after. An item with `milestones.length === 0` gets no chevron and no count badge — see `tests/cases/views.test.js`'s "no milestones" test. Clicking a milestone's own status badge calls `cycleMilestoneStatus(itemId, milestoneId)`, which steps through `STATUSES` in array order and wraps — a quicker way to update a milestone's RAG than opening the item modal.

### Timeline (`renderTimelineView`)

One swimlane (`.lane`) per visible workstream, one `.lane-track` per item (not one per item+milestone — a milestone renders inside its parent item's track, not its own). The date axis is computed from the actual data: `minD`/`maxD` span the earliest `startDate`/`dueDate` and latest `dueDate` — including every nested milestone's `dueDate` — among *currently visible* items (10 days of padding each side), or the current-plus-next month if there are no items yet. `PX_PER_DAY` (26) is the single scale constant; `dayOffset(iso)` converts a date to a left-position in pixels relative to `minD`. An item renders as `.tl-bar` (positioned `left`/`width` from `startDate`→`dueDate`, minimum 18px width); each of its milestones renders as a `.tl-milestone` diamond (a 45°-rotated square, positioned at its own `dueDate`) painted into the *same* track, after the bar in markup so it stacks visually on top with no explicit `z-index` needed beyond what's already on `.tl-milestone`. Since the standard milestone set defaults every date to the item's due date, a freshly-created item's six diamonds start stacked at the same x position on the bar's right edge until dates are spread out in the item modal. A `.today-line` marks the current date across every lane. Month header segments (`months` array) are computed by walking `minD`→`maxD` one calendar month at a time and clipping the first/last segment to the actual data range.

Because the visible date range depends on `visibleWorkstreams()`, switching the sidebar filter to one workstream re-scales the whole timeline to that workstream's own items — this is intentional (a workstream with a tight 2-week range shouldn't be squeezed into a full programme's multi-month span), not a bug.

### Milestone checklist

`STANDARD_MILESTONES` (top of the `<script>` block, near `STATUSES`) is the ordered list of six milestone names auto-added to every *new* item: Requirements defined, Design defined, Development completed, Ready for SIT, Ready for UAT, Deployment completed. `openItemModal(id)` seeds `editingMilestones` — a module-level working copy, not committed to `items` until Save — from this list (each dated to whatever the Due date field shows at the moment the modal opens, per-milestone `id` freshly generated) when creating a new item, or from a deep-ish copy of the existing item's `milestones` when editing one already saved. This is why editing never resets an item back to the standard six: `saveItem()` only ever writes whatever is currently in `editingMilestones`, regardless of how it originally got there.

`renderMilestonesEditor()` redraws the modal's milestone rows from `editingMilestones`; each row's `name`/`dueDate`/`status` field writes straight back into `editingMilestones[idx]` via inline `oninput`/`onchange` (no re-render on keystroke, so inputs never lose focus mid-edit) — `saveItem()` reads the array directly rather than re-scraping the DOM. `addMilestoneRow()`/`removeMilestoneRow(idx)` are the only two mutations that re-render the editor, since those are structural (row count changes, so every subsequent row's index shifts). None of this touches `items` until Save is clicked — Cancel (or closing the modal) just discards `editingMilestones`, which `closeItemModal()` also resets to `[]` for hygiene.

There's deliberately no computed roll-up from milestone statuses to the parent item's own status (e.g. "auto-mark the item red if any milestone is red") — the item's status stays a manual field, same as always, so a checklist update never silently overrides a PM's own RAG judgment call on the item.

### Modals

Six modals share the `.modal-bg` pattern (add `.open` class to show, remove to hide): `wsModalBg` (create/edit a workstream, with a delete button that cascades to that workstream's items — and, since milestones live nested inside items, to their milestones too), `itemModalBg` (create/edit a scope item, `.modal-wide` at 520px to fit the milestones editor — see "Milestone checklist" above), `confirmModalBg` (generic confirm-then-run-a-callback, used by every delete and by restore-from-backup — see "Deletion tombstones and undo" below), `importModalBg` (merge vs. replace choice after picking a file), `backupsModalBg` (list + restore local daily snapshots), and `fileSyncModalBg` (onboarding/reconnect for the linked-file feature). All six close on Escape and on a background click (listeners near the end of the `<script>` block check `e.target.id`).

### Data integrity

`normalizeData()` (called from `load()`, from every merge/import/file-sync entry point, and, for tests, from the `resetState()` glue) is the single source of truth for schema defaults: workstream `id`/`color`/`order` backfilled and the array re-sorted by `order`; an item's `id`/`name`/`owner`/`notes`/`status`/`updatedAt` backfilled, an orphaned `workstreamId` (pointing at a deleted workstream) reassigned to the first remaining workstream, a missing `startDate` defaulted from `dueDate`, a missing `milestones` defaulted to `[]`, and each milestone's own `id`/`name`/`status` backfilled and a missing `dueDate` defaulted from its *parent item's* `dueDate`. A stale `filterWorkstreamId` is cleared if it no longer resolves. `deletedWorkstreamIds`/`deletedItemIds` are coerced to arrays and filtered to well-formed `{id, ...}` entries.

It also runs a one-time schema migration: a pre-nested-milestones save could have a top-level item with `type: 'milestone'` (milestones used to be their own top-level item, siblings of scope items, before this became a nested checklist). Rather than silently dropping these on first load under the new schema, `normalizeData()` folds each one into its own new single-milestone item (`startDate`/`dueDate` both set to the old milestone's `dueDate`, `milestones: [{ ...that one milestone }]`) and strips the legacy rows out of `items`. `type` itself is `delete`d off every item as part of this pass, since it no longer means anything under the new schema.

**Every place that assigns `workstreams`/`items` from an external source calls `normalizeData()`, not just `load()`** — the current call sites are `load()`, both branches of `applyImport()`, `restoreBackup()`, `linkFile()`'s merge-on-first-link branch, `reconnectFile()`, and `initFileSync()`. If you add another data-loading path (e.g. a new sync mechanism), route it through `normalizeData()` too, or you'll reintroduce the exact bug class this fixed — a render function assuming a field exists that an older/hand-edited/externally-sourced save doesn't have.

`normalizeData()` is also the security boundary for ids: every workstream/item/milestone id is interpolated unescaped into `onclick` HTML attributes at render time (`esc()` only covers *content* fields — name, owner, notes — never `id`). That's fine for locally-created data since `genId()` only ever produces plain alphanumeric strings, but `mergeData()` and `applyImport('replace')` trust ids from an external `.json` file as-is. `isSafeId(id)` (`/^[a-zA-Z0-9_-]+$/`) plus the per-entity checks in `normalizeData()`'s three loops (workstreams, items, milestones) regenerate anything that couldn't have come from `genId()`, closing that off at the one place every external-data path already routes through — see `tests/cases/sync.test.js`'s "regenerates a workstream/item/milestone id" tests.

## Data durability

Pulse now matches PromptLab/mytasks' full data-durability feature set: JSON export/import, rolling local backups, deletion tombstones with toast undo, and optional File System Access API file sync. The "Data" dropdown in the topbar (`toggleDataMenu()`/`closeDataMenu()`, closed by the document-level click listener when a click lands outside `#dataDropdown`) is the entry point for Export, Import, and Backups. File sync deliberately has no entry there — see "File System Access API sync" below for why it lives entirely in the topbar's `#fileSyncIndicator` instead.

### Toast with undo

`showToast(msg, isError, undoAction)` — the third argument is new. When present, the toast shows an "Undo" button (`#toastUndoBtn`) and stays up 6s instead of 2s; `triggerToastUndo()` (wired to the button's `onclick`) invokes it and dismisses the toast immediately. Only one undo action is live at a time (`toastUndoAction`, a single module-level slot) — showing any other toast overwrites it, matching the single visible toast.

### Confirm modal — replaces native `confirm()`

`openConfirmModal({title, body, action})` / `confirmModalAction()` / `closeConfirmModal()` replace the plain `window.confirm()` dialogs earlier versions used for delete. `modalTarget = {action}` holds the pending callback; clicking the modal's "Delete" button runs it and closes the modal. This exists specifically so delete confirmations can describe *what* will happen (e.g. cascade counts) and hand off into the undo-toast flow below, which a same-tick `confirm()` return value can't do.

### Deletion tombstones and undo

`deletedWorkstreamIds`/`deletedItemIds` (each `{id, deletedAt}[]`) record "this id used to exist and was intentionally removed" — without them, an id absent from `workstreams`/`items` is indistinguishable from an id a merge has simply never seen, and a stale copy from an old linked file or import could silently resurrect something the user deleted on purpose. `tombstone(list, id)`/`untombstone(list, id)` add/remove an entry.

`deleteItem(id)` opens the confirm modal; its `action` splices the item out, tombstones it, then calls `showToast('Item deleted', false, undoFn)` where `undoFn` untombstones it and splices it back to its original index. `deleteWorkstreamFromModal()` does the equivalent at cascade scale: it snapshots the *entire* `items` array (`items.slice()`) before filtering out the workstream's items, tombstones the workstream id plus every removed item id, and its undo callback restores both the workstream (spliced back to its original index) and the whole pre-delete `items` array in one assignment — simpler and equally correct compared to tracking each removed item's individual original index. The undo callback must clear the tombstone(s) it set, or a delete-then-undo would leave the workstream/item permanently un-mergeable from any linked file/import that still has it.

### Merge and last-write-wins

`mergeData(data, opts)` is the additive merge used by every "read data from outside `localStorage`" path (`linkFile()`, `reconnectFile()`, `initFileSync()`, `fileSyncWrite()`'s cross-tab-conflict branch, and `applyImport('merge')`). It merges incoming tombstones first (union by id, keeping the later `deletedAt`), then workstreams (additive, deduped by id *or* case-insensitive name, merged silently — not counted in the return value, mirroring how mytasks' projects merge), then items (additive by id; an existing item is `Object.assign`-updated only if the incoming copy's `updatedAt` is newer, and both counts are returned as `{added, updated}`).

Inside the items pass, a tombstoned incoming id is skipped *unless* the incoming `updatedAt` is newer than the tombstone's `deletedAt` — that case is treated as a genuine edit made elsewhere after the local delete, and the stale tombstone is cleared to let it back in. Workstreams have no `updatedAt` (see "Data model" above), so a deleted workstream has no such escape hatch inside `mergeData()` itself — the only way one comes back is through `opts.respectTombstones: false` (below).

**The one exception: `applyImport('merge')`.** `mergeData()` defaults `opts.respectTombstones` to `true`; `applyImport('merge')` is the only caller that passes `false`. Picking a specific file and clicking Import → Merge is a deliberate, one-off action — unlike `linkFile()`/`reconnectFile()`/`initFileSync()`/`fileSyncWrite()`, which merge automatically in the background, where silently resurrecting a deletion via a stale copy would be surprising. With the flag off, a matching tombstone is cleared and the incoming item (or workstream) is added regardless of relative timestamps.

### Export / Import

`downloadData(data, filename)` is the shared primitive (Blob → object URL → synthetic `<a download>` click). `exportProgramme()` calls it with `currentExportPayload()` (`{version, exported, programme, workstreams, items}` — deliberately no tombstones, same reasoning as PromptLab/mytasks' export format). `triggerImport()` clicks the hidden `#fileInput`; `handleFileImport(event)` reads the picked file, validates it has both `workstreams` and `items` before staging it in `pendingImportData` and opening `importModalBg`. `applyImport(mode)`: `'replace'` downloads a `pulse-backup-before-replace-<date>.json` safety copy first, then overwrites `programme`/`workstreams`/`items` outright; `'merge'` calls `mergeData(pendingImportData, {respectTombstones: false})`. Both branches call `normalizeData()` before `save(); render()`.

### Local backups

`save()` calls `maybeSnapshotBackup()` on every save, which takes at most one rolling snapshot per calendar day (keyed by `todayStr()`) into `localStorage["pulse-backups"]`, keeping the last `MAX_BACKUPS` (7) days — a local safety net distinct from file sync, which mirrors live state rather than preserving history. A backup taken earlier in the day isn't refreshed by later saves that same day. The "Data → Backups" modal (`openBackupsModal()`/`renderBackupsModal()`) lists snapshots newest-first; `restoreBackup(date)` opens the confirm modal, and on confirm downloads a safety backup of the *current* data first (same `downloadData()` primitive), then overwrites from the snapshot and calls `normalizeData()`. Backups don't carry tombstones (same reasoning as export/import — a restore is an explicit full replace, not a merge).

### File System Access API sync

`fileHandle` (module-level, `null` until linked) plus a tiny hand-rolled IndexedDB wrapper (`_fsIdb`/`_fsGet`/`_fsPut`/`_fsDel`, db `pulse-fs`) persist the linked file handle across reloads — Chrome/Edge only (`window.showOpenFilePicker`/`showSaveFilePicker` feature-detected; Safari has neither). `save()` calls `fileSyncWrite(data)` whenever `fileHandle` is set. `fileSyncWrite()` does a light conflict check first: if the file on disk has changed since Pulse's own `lastSyncedSnapshot` (another tab or device wrote to it), it merges that external copy in via `mergeData()` before writing, and toasts what changed.

`linkFile()`/`createNewLinkedFile()` (via `window.showOpenFilePicker`/`showSaveFilePicker`) pick or create the linked file; `linkFile()` merges any existing content in the picked file on first link. `reconnectFile()` re-requests write permission (browsers can silently revoke it, e.g. after a restart) and merges. `initFileSync()` runs at page load: if a handle was persisted in IndexedDB, it tries to reuse it (merging the file's content in if permission is still granted, or prompting to reconnect if not); if there's no persisted handle at all, it opens the onboarding modal (`openFileSyncModal()`) so a first-time user is prompted to link or explicitly dismiss with "Not now". `updateFileSyncUI()` swaps the topbar's `#fileSyncIndicator` between four states (no picker support → hidden entirely, unlinked → "Link file" button, linked-and-granted → filename + unlink button, linked-but-permission-lapsed → amber "Reconnect" button) via `fadeSwapHTML()` (a short opacity crossfade, skipped if the HTML is already identical). This indicator is the *only* entry point into `openFileSyncModal()` — there's deliberately no static "File sync" item in the Data dropdown, because a dropdown item can't reflect which of those four states is current the way the indicator does; a fixed menu entry would keep opening the "nothing's linked yet" onboarding copy (including the "will be lost if you clear browsing data" warning) even once a file *is* linked and auto-saving, which is exactly the bug this avoids.

**Testing caveat**: the JXA test harness doesn't mock `indexedDB` (its no-op `setTimeout` would leave any real async IndexedDB request forever unresolved, hanging a test). Every file-sync function that would touch it is gated on a `window.showOpenFilePicker`/`showSaveFilePicker`/`fileHandle` check first, and the harness's fake `window` has neither — so `linkFile()`, `createNewLinkedFile()`, `initFileSync()`, and `reconnectFile()` all safely no-op in tests. `unlinkFile()` is the one exception (it unconditionally calls into IndexedDB) and is deliberately not exercised by the test suite for that reason.

## Conventions from this project's history

- Font Awesome 6.5 (`fa-solid`) via CDN, matching PromptLab/mytasks.
- `button:focus:not(:focus-visible) { outline: none; }` is global — focus rings only show for real keyboard navigation, not post-click.
- IDs are generated by `genId()` (timestamp + random suffix); `isSafeId()` plus `normalizeData()`'s regeneration passes are the guard against a crafted id from an external `.json` file (import, linked file) breaking out of an `onclick` attribute — see "Data integrity" above.
