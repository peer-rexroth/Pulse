test('seedDefaults starts with zero workstreams — a fresh programme has none until the user adds their own', function () {
  // resetState() (the test harness's own glue, not seedDefaults() itself)
  // pushes a "Workstream 1" back in purely for every other test's baseline
  // convenience — calling seedDefaults() directly here checks the real
  // product behavior underneath that shim.
  seedDefaults();
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 0);
  // Development (the one real, selectable category) plus the reserved
  // Pending category (see pendingCategory()) — always present, even in a
  // brand-new programme, since the quick-add flow depends on it existing.
  assertEqual(categories.length, 2);
  assertEqual(categories[0].name, 'Development');
  assertEqual(categories[1].name, 'Pending');
  assertTrue(categories[1].pending);
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

test('deleting a workstream also removes its items (cascade)', function () {
  const wsId = workstreams[0].id;
  items.push({ id: genId(), workstreamId: wsId, name: 'A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [] });
  items.push({ id: genId(), workstreamId: wsId, name: 'B', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [] });
  assertEqual(items.length, 2);
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction(); // simulate clicking "Delete" in the confirm modal
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 0);
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
  assertEqual(handleCount, workstreams.length, 'exactly one drag handle per real workstream — none for the "All workstreams" pseudo-row');

  userRole = 'reviewer';
  renderSidebar();
  html = document.getElementById('wsList').innerHTML;
  assertNotIncludes(html, 'dragStartWs', 'no drag handle should render below Editor');
});

test('renderSidebar sets a title tooltip on the whole workstream row (not just the name span), so a truncated name is still readable on hover', function () {
  const w = addWorkstream('A Rather Long Workstream Name That Would Get Truncated');
  renderSidebar();
  const html = document.getElementById('wsList').innerHTML;
  assertIncludes(html, `onclick="setFilterWorkstream('${w.id}')" title="${w.name}"`, 'the title must sit on the row div itself, not buried on an inner span the hover-reveal reflow can shift the cursor off of');
});
