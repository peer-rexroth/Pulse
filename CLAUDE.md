# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Pulse is a single-file, zero-dependency HTML application — the entire app (HTML, CSS, JavaScript) lives in `pulse.html`. There is no build step and no package manager. It's a local-first programme dashboard: workstreams, scope items and milestones tracked with RAG status, shown as either a status board or a date-scaled timeline. It's also an installable PWA (manifest, service worker, icons), following the same shape as this author's other single-file apps (PromptLab, mytasks) but deliberately smaller in scope — see "What's deliberately not here" below.

## Running it

A plain `file://` open of `pulse.html` works fine for quick checks, but PWA install/offline support requires serving it over http — browsers refuse to register a service worker for `file://` pages. `./start-pulse.command` serves the directory on `http://127.0.0.1:8936` and opens it in Chrome/Edge (Safari can't install this kind of PWA on macOS). `./stop-pulse.command` kills the server.

## Tests

There's no lint config, but there is a test suite at `tests/`: extract the inline `<script>` block, mock just enough of the DOM (`document.getElementById` returning cached fake elements with a settable `innerHTML`/`value`, plus `localStorage`, `navigator`, `window`, `confirm`, `location`) and `eval()` the real code in a headless JS engine (`osascript -l JavaScript` — JavaScriptCore, no Node install needed).

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
  "filterWorkstreamId": null | "wsId"
}
```

A **workstream**:
```js
{ id: String, name: String, color: String, order: Number }  // color is a name key from WS_COLORS
```

An **item** (scope item or milestone — one shape, discriminated by `type`):
```js
{
  id: String,
  workstreamId: String,
  type: 'scope' | 'milestone',
  name: String,
  owner: String,
  notes: String,
  status: 'not-started' | 'green' | 'amber' | 'red' | 'complete',
  startDate: String,  // 'YYYY-MM-DD', scope items only — absent/undefined on milestones
  dueDate: String      // 'YYYY-MM-DD' — the single date a milestone renders at
}
```

There is deliberately no separate `Milestone` type/array — a milestone is just an item with `type: 'milestone'` and no `startDate`. This keeps one CRUD path (`openItemModal`/`saveItem`/`deleteItem`) for both, with the type toggle in the modal only changing which date field is shown and how the item renders (bar vs. diamond).

### RAG status

`STATUSES` (top of the `<script>` block) is the single source of truth for the five status values and their labels: Not Started, On Track (green), At Risk (amber), Off Track (red), Complete (blue). Status drives an item's color everywhere it appears — the status badge in the status board, and the bar/diamond fill in the timeline. Workstream color (`WS_COLORS`, a separate 8-hue palette) is used only for the sidebar dot, the status-board section header tint, and the timeline lane label dot — it never colors an item, since status is the signal a programme dashboard is meant to surface at a glance.

### Rendering pattern

Direct DOM re-renders (no virtual DOM or framework). `render()` does a full re-render (topbar bits + sidebar + main); `renderSidebar()` and `renderMain()` handle their halves independently. Every state mutation calls `save()` then one of these. `renderMain()` dispatches to `renderStatusView()` or `renderTimelineView()` based on the `view` flag — if you add a mutation that should be reflected live, make sure it calls `render()` (or at least the render function covering whatever it changed), not a narrower one that happens to work for today's call site.

### Status board (`renderStatusView`)

One `.ws-section` per visible workstream (filtered by `filterWorkstreamId` via `visibleWorkstreams()`), each showing a RAG count summary (`STATUSES` filtered to non-zero counts) and its items sorted by `dueDate` ascending, scope items and milestones interleaved in the same list (distinguished only by the row's icon and whether it shows a date range or single date).

### Timeline (`renderTimelineView`)

One swimlane (`.lane`) per visible workstream. The date axis is computed from the actual data: `minD`/`maxD` span the earliest `startDate`/`dueDate` and latest `dueDate` among *currently visible* items (10 days of padding each side), or the current-plus-next month if there are no items yet — so the timeline always fits what's on screen rather than a fixed window. `PX_PER_DAY` (26) is the single scale constant; `dayOffset(iso)` converts a date to a left-position in pixels relative to `minD`. Scope items render as `.tl-bar` (positioned `left`/`width` from `startDate`→`dueDate`, with a minimum 18px width so a very short or same-day item stays clickable); milestones render as `.tl-milestone` (a 45°-rotated square making a diamond, positioned at `dueDate` only). Each item gets its own `.lane-track` row rather than being packed into shared rows — simpler and always correct, at the cost of a taller lane when a workstream has many overlapping items. A `.today-line` marks the current date across every lane for orientation. Month header segments (`months` array) are computed by walking `minD`→`maxD` one calendar month at a time and clipping the first/last segment to the actual data range.

Because the visible date range depends on `visibleWorkstreams()`, switching the sidebar filter to one workstream re-scales the whole timeline to that workstream's own items — this is intentional (a workstream with a tight 2-week range shouldn't be squeezed into a full programme's multi-month span), not a bug.

### Modals

Two modals share the `.modal-bg` pattern (add `.open` class to show, remove to hide): `wsModalBg` (create/edit a workstream, with a delete button that cascades to that workstream's items) and `itemModalBg` (create/edit a scope item or milestone, with a type toggle that shows/hides the start-date field and relabels "Due date" → "Date" for milestones). Both close on Escape and on a background click (listeners at the bottom of the `<script>` block check `e.target.id`).

### Data integrity

`normalizeData()` (called from `load()` and, for tests, from the `resetState()` glue) is the single source of truth for schema defaults: workstream `id`/`color`/`order` backfilled and the array re-sorted by `order`; an item's `id`/`type`/`name`/`owner`/`notes`/`status` backfilled, an orphaned `workstreamId` (pointing at a deleted workstream) reassigned to the first remaining workstream, a scope item missing `startDate` defaulted from `dueDate`, and a stale `filterWorkstreamId` cleared if it no longer resolves. Any future data-loading path (an import feature, a linked-file sync — see below) should route through `normalizeData()` too, same as `load()` does, or it'll reintroduce the class of bug this exists to prevent: a render function assuming a field exists that an older/hand-edited save doesn't have.

## What's deliberately not here (v1 scope)

Unlike PromptLab/mytasks, Pulse v1 has no import/export, no linked-file sync (File System Access API), no undo-delete toast, no deletion tombstones, and no multi-scheme theming (just a single light/dark toggle). Deletes use a plain `confirm()` dialog instead of an undo toast. These were deliberately left out to keep the initial build proportionate to "start with the basics" — add them the same way PromptLab/mytasks did (see those apps' CLAUDE.md) if/when cross-device sync or richer theming is actually needed, routing any new external-data path through `normalizeData()` as noted above.

## Conventions from this project's history

- Font Awesome 6.5 (`fa-solid`) via CDN, matching PromptLab/mytasks.
- `button:focus:not(:focus-visible) { outline: none; }` is global — focus rings only show for real keyboard navigation, not post-click.
- IDs are generated by `genId()` (timestamp + random suffix) and never come from an external/untrusted source in v1, so unlike mytasks there's no `isSafeId()`-style guard yet — if an import/sync feature is added later, revisit this the same way mytasks' CLAUDE.md documents.
