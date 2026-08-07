test('seedDefaults starts with zero workstreams — a fresh programme has none until the user adds their own', function () {
  // resetState() (the test harness's own glue, not seedDefaults() itself)
  // pushes a "Workstream 1" back in purely for every other test's baseline
  // convenience — calling seedDefaults() directly here checks the real
  // product behavior underneath that shim.
  seedDefaults();
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 0);
  // DEFAULT_CATEGORIES (the out-of-the-box, real/selectable categories)
  // plus the reserved Pending category (see pendingCategory()) — always
  // present, even in a brand-new programme, since the quick-add flow
  // depends on it existing.
  assertEqual(categories.length, DEFAULT_CATEGORIES.length + 1);
  DEFAULT_CATEGORIES.forEach((c, i) => assertEqual(categories[i].name, c.name));
  const pendingCat = categories.find(c => c.pending);
  assertEqual(pendingCat.name, 'Pending');
  assertTrue(pendingCat.pending);
});

test('saveWorkstream adds a new workstream with chosen name and color', function () {
  document.getElementById('wsNameInput').value = 'Data Migration';
  wsColorChoice = 'teal';
  saveWorkstream();
  assertEqual(workstreams.length, 2);
  const w = workstreams[1];
  assertEqual(w.name, 'Data Migration');
  assertEqual(w.color, 'teal');
});

test('saveWorkstream rejects an empty name', function () {
  const before = workstreams.length;
  document.getElementById('wsNameInput').value = '   ';
  saveWorkstream();
  assertEqual(workstreams.length, before);
});

test('editing an existing workstream updates it in place, not a new entry', function () {
  const id = workstreams[0].id;
  openWorkstreamModal(id);
  document.getElementById('wsNameInput').value = 'Renamed';
  wsColorChoice = 'purple';
  saveWorkstream();
  assertEqual(workstreams.length, 1);
  assertEqual(workstreams[0].id, id);
  assertEqual(workstreams[0].name, 'Renamed');
  assertEqual(workstreams[0].color, 'purple');
});

// resyncWorkstreamOrder() — a permanent, in-app alternative to manually
// re-dragging every item, offered specifically for a reorder made *before*
// reorderItem()'s own updatedAt-stamping fix shipped (see "Manual item
// order and drag-and-drop reordering" in CLAUDE.md): it bumps every item's
// own updatedAt (order itself untouched) so this device's already-correct
// local order reliably wins the next merge on another, stale device.

test('resyncWorkstreamOrder bumps updatedAt on every item in the workstream without touching order', function () {
  const wsId = workstreams[0].id;
  const a = { id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'A', order: 1, status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 0 };
  const b = { id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'B', order: 0, status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 0 };
  const other = { id: genId(), workstreamId: null, categoryId: categories[0].id, name: 'Unassigned item', order: 0, status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 0 };
  items.push(a, b, other);
  editingWsId = wsId;
  resyncWorkstreamOrder();
  assertTrue(a.updatedAt > 0, "the workstream's own items must get a fresh updatedAt");
  assertTrue(b.updatedAt > 0, "the workstream's own items must get a fresh updatedAt");
  assertEqual(other.updatedAt, 0, "an item in a different workstream (or Unassigned) must not be touched");
  assertEqual(a.order, 1, 'order itself is left exactly as it was — only the timestamp changes');
  assertEqual(b.order, 0, 'order itself is left exactly as it was — only the timestamp changes');
});

test('resyncWorkstreamOrder is blocked below Editor', function () {
  const wsId = workstreams[0].id;
  const a = { id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'A', order: 0, status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 0 };
  items.push(a);
  editingWsId = wsId;
  userRole = 'reviewer';
  resyncWorkstreamOrder();
  assertEqual(a.updatedAt, 0, 'below Editor, nothing should be touched');
});

test('resyncWorkstreamOrder toggles visibility in the workstream modal — shown for an existing workstream at Editor+, hidden for a new one or below Editor', function () {
  openWorkstreamModal(workstreams[0].id);
  assertEqual(document.getElementById('wsResyncOrderBtn').style.display, 'inline-flex', 'an existing workstream at Editor+ shows the button');
  openWorkstreamModal(null);
  assertEqual(document.getElementById('wsResyncOrderBtn').style.display, 'none', 'a brand-new workstream has nothing to resync yet');
  userRole = 'reviewer';
  openWorkstreamModal(workstreams[0].id);
  assertEqual(document.getElementById('wsResyncOrderBtn').style.display, 'none', 'below Editor the button is hidden entirely');
});

// A user-reported request reversed the earlier cascade-delete behavior:
// deleting a workstream now moves its items to Unassigned instead of
// deleting them along with it — real work (milestones, tags, dates, review
// history) shouldn't disappear just because the workstream containing it
// was removed.

test('deleting a workstream moves its items to Unassigned rather than deleting them', function () {
  const wsId = workstreams[0].id;
  const a = { id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 0 };
  const b = { id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'B', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 0 };
  items.push(a, b);
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction(); // simulate clicking "Delete" in the confirm modal
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 2, 'the items themselves must survive');
  assertEqual(a.workstreamId, null);
  assertEqual(b.workstreamId, null);
  assertTrue(a.updatedAt > 0, 'a moved item is a real change for merge purposes, so updatedAt must bump');
  // Neither the category nor anything else about the item should be
  // touched — only workstreamId moves.
  assertEqual(a.categoryId, categories[0].id);
});

test('undoing a workstream delete restores both the workstream and its items\' original workstreamId', function () {
  const wsId = workstreams[0].id;
  const a = { id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 0 };
  items.push(a);
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction();
  assertEqual(a.workstreamId, null);
  triggerToastUndo();
  assertEqual(workstreams.length, 1);
  assertEqual(workstreams[0].id, wsId);
  assertEqual(a.workstreamId, wsId, 'the moved item should be reassigned back to the restored workstream');
});

test('undoing a workstream delete does not clobber an item that was independently reassigned to a different real workstream in the meantime', function () {
  const wsId = workstreams[0].id;
  const other = { id: genId(), name: 'Other', color: 'teal', order: 1 };
  workstreams.push(other);
  const a = { id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 0 };
  items.push(a);
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction();
  assertEqual(a.workstreamId, null);
  a.workstreamId = other.id; // simulates the user re-assigning it before clicking Undo
  triggerToastUndo();
  assertEqual(a.workstreamId, other.id, 'undo must not override a later, unrelated reassignment');
});

test('deleting the currently-filtered workstream clears the filter', function () {
  const wsId = workstreams[0].id;
  filterWorkstreamId = wsId;
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction();
  assertEqual(filterWorkstreamId, null);
});

// ---------- Drag-and-drop reordering of workstreams (shared sidebar) ----------

function addWorkstream(name, color) {
  document.getElementById('wsNameInput').value = name;
  wsColorChoice = color || 'teal';
  saveWorkstream();
  return workstreams[workstreams.length - 1];
}

test('reorderWorkstream moves a workstream to a new position and reassigns contiguous order values', function () {
  const a = workstreams[0]; // 'Workstream 1', seeded by resetState()
  const b = addWorkstream('B');
  const c = addWorkstream('C');
  reorderWorkstream(a.id, c.id); // move A to where C is
  const byOrder = workstreams.slice().sort((x, y) => x.order - y.order).map(w => w.name);
  assertDeepEqual(byOrder, ['B', 'C', 'Workstream 1'], 'A should now sit where C was, pushing B and C up');
});

test('reorderWorkstream stamps updatedAt only on workstreams whose order value actually changed — needed so the reorder itself reaches another already-synced device via mergeWorkstreamFields()\'s newer-updatedAt-wins merge', function () {
  const a = workstreams[0]; // 'Workstream 1', seeded by resetState()
  const b = addWorkstream('B');
  const c = addWorkstream('C');
  a.updatedAt = 0; b.updatedAt = 0; c.updatedAt = 0;
  reorderWorkstream(b.id, c.id); // move B to where C was: A stays at index 0, C moves to 1, B moves to 2
  assertEqual(a.order, 0, 'A stays at the front');
  assertEqual(a.updatedAt, 0, "A's order never changed — updatedAt must stay untouched");
  assertTrue(c.updatedAt > 0, "C moved from index 2 to 1 — its order changed, so updatedAt must bump");
  assertTrue(b.updatedAt > 0, "B moved from index 1 to 2 — its order changed, so updatedAt must bump");
});

test('mergeWorkstreamFields merges order alongside name/color, so a reorder made elsewhere is actually applied, not just the tombstone/actionLog machinery', function () {
  const existing = { id: 'ws1', name: 'Alpha', color: 'blue', order: 0, updatedAt: 100, actionLog: [], decisionLog: [] };
  const incoming = { id: 'ws1', name: 'Alpha', color: 'blue', order: 2, updatedAt: 200, actionLog: [], decisionLog: [] };
  const changed = mergeWorkstreamFields(existing, incoming, true);
  assertTrue(changed);
  assertEqual(existing.order, 2, 'a newer incoming order must be applied, the same as name/color already are');
});

test('mergeWorkstreamFields does not apply an incoming order that is not actually newer', function () {
  const existing = { id: 'ws1', name: 'Alpha', color: 'blue', order: 0, updatedAt: 200, actionLog: [], decisionLog: [] };
  const incoming = { id: 'ws1', name: 'Alpha', color: 'blue', order: 2, updatedAt: 100, actionLog: [], decisionLog: [] };
  mergeWorkstreamFields(existing, incoming, true);
  assertEqual(existing.order, 0, 'a stale incoming order must not overwrite the newer local one');
});

test('reorderWorkstream is blocked below Editor', function () {
  const a = workstreams[0];
  const b = addWorkstream('B');
  const before = workstreams.map(w => w.order);
  userRole = 'reviewer';
  reorderWorkstream(a.id, b.id);
  assertDeepEqual(workstreams.map(w => w.order), before, 'reordering must have been blocked below Editor');
});

test('dragStartWs/dropOnWs wires the sidebar\'s row drag-and-drop to reorderWorkstream', function () {
  const a = workstreams[0];
  const b = addWorkstream('B');
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  dragStartWs(fakeEvent, b.id);
  dropOnWs(fakeEvent, a.id);
  assertEqual(workstreams.find(w => w.id === b.id).order, 0, 'B should have moved to where A was');
  assertEqual(draggedWsId, null, 'the drag state should be cleared after a drop');
});

test('dropOnWs is a no-op when dropped back on the same workstream it was dragged from', function () {
  const a = workstreams[0];
  const before = workstreams.map(w => w.order);
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  dragStartWs(fakeEvent, a.id);
  dropOnWs(fakeEvent, a.id);
  assertDeepEqual(workstreams.map(w => w.order), before);
});

test('renderSidebar renders a drag handle wired to dragStartWs for each real workstream at Editor+, and omits it below Editor', function () {
  addWorkstream('B');
  renderSidebar();
  let html = document.getElementById('wsList').innerHTML;
  workstreams.forEach(w => assertIncludes(html, `dragStartWs(event,'${w.id}')`));
  const handleCount = (html.match(/dragStartWs\(event,/g) || []).length;
  assertEqual(handleCount, workstreams.length, 'exactly one drag handle per real workstream — none for the "All Workstreams" pseudo-row');

  userRole = 'reviewer';
  renderSidebar();
  html = document.getElementById('wsList').innerHTML;
  assertNotIncludes(html, 'dragStartWs', 'no drag handle should render below Editor');
});

test('renderSidebar sets a title tooltip on the whole workstream row (not just the name span), so a truncated name is still readable on hover', function () {
  const w = addWorkstream('A Rather Long Workstream Name That Would Get Truncated');
  renderSidebar();
  const html = document.getElementById('wsList').innerHTML;
  assertIncludes(html, `onclick="selectWorkstreamFromSidebar('${w.id}')" title="${w.name}"`, 'the title must sit on the row div itself, not buried on an inner span the hover-reveal reflow can shift the cursor off of');
});

// ---------- Sidebar workstream rows always land on Planning ----------

test('selectWorkstreamFromSidebar sets the filter and switches to Planning, regardless of the current mode', function () {
  const w = workstreams[0];
  setMode('review');
  selectWorkstreamFromSidebar(w.id);
  assertEqual(mode, 'planning');
  assertEqual(filterWorkstreamId, w.id);
});

test('selectWorkstreamFromSidebar(null) ("All Workstreams") switches to Planning too, clearing the filter', function () {
  setMode('review'); filterWorkstreamId = workstreams[0].id;
  selectWorkstreamFromSidebar(null);
  assertEqual(mode, 'planning');
  assertEqual(filterWorkstreamId, null);
});

test('selectWorkstreamFromSidebar also forces planningTab back to "scope" — picking a workstream from the sidebar is a request to see that workstream\'s own scope items, so it should land there even if the Journeys sub-tab happened to be showing', function () {
  setPlanningTab('journeys');
  selectWorkstreamFromSidebar(workstreams[0].id);
  assertEqual(planningTab, 'scope');
});

test('plain setFilterWorkstream (used by reviewDatesOverviewHtml and tests) never changes mode — only the sidebar\'s own rows do', function () {
  setMode('review');
  setFilterWorkstream(workstreams[0].id);
  assertEqual(mode, 'review', 'setFilterWorkstream must stay mode-agnostic so non-sidebar callers are unaffected');
  assertEqual(filterWorkstreamId, workstreams[0].id);
});

test('a workstream row stays active in the sidebar across both Planning sub-tabs, since the Journeys sub-tab is now workstream-aware too', function () {
  const w = workstreams[0];
  filterWorkstreamId = w.id;
  setPlanningTab('scope');
  renderSidebar();
  let html = document.getElementById('wsList').innerHTML;
  assertIncludes(html, `ws-row active" onclick="selectWorkstreamFromSidebar('${w.id}')"`, 'the workstream row is active while Planning\'s Scope Items sub-tab is scoped to it');

  setPlanningTab('journeys');
  renderSidebar();
  html = document.getElementById('wsList').innerHTML;
  assertIncludes(html, `ws-row active" onclick="selectWorkstreamFromSidebar('${w.id}')"`, 'the same row stays active on the Journeys sub-tab too, since it genuinely narrows what\'s shown there now (see journeysForCurrentFilter())');
  assertEqual(filterWorkstreamId, w.id);
});

test('"All Workstreams" stays active in the sidebar across both Planning sub-tabs', function () {
  filterWorkstreamId = null;
  setPlanningTab('scope');
  renderSidebar();
  assertIncludes(document.getElementById('topNavList').innerHTML, 'ws-row-all active', '"All Workstreams" is active while Planning\'s Scope Items sub-tab is scoped to it');

  setPlanningTab('journeys');
  renderSidebar();
  assertIncludes(document.getElementById('topNavList').innerHTML, 'ws-row-all active', '"All Workstreams" stays active on the Journeys sub-tab too — it shows every Journey unfiltered there, the same "no narrowing" meaning it already has everywhere else');
});
