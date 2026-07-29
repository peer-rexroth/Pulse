function addItem(overrides) {
  const it = Object.assign({
    id: genId(), workstreamId: workstreams[0].id,
    name: 'Item', owner: '', notes: '', status: 'green',
    startDate: todayStr(), dueDate: todayStr(), milestones: []
  }, overrides || {});
  items.push(it);
  return it;
}

test('setFilterWorkstream narrows visibleWorkstreams to one', function () {
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  assertEqual(visibleWorkstreams().length, 2);
  setFilterWorkstream(workstreams[1].id);
  const vis = visibleWorkstreams();
  assertEqual(vis.length, 1);
  assertEqual(vis[0].id, workstreams[1].id);
});

test('renderStatusView groups items under the correct workstream and shows RAG counts', function () {
  addItem({ status: 'red', name: 'Blocked task' });
  addItem({ status: 'red', name: 'Another blocked task' });
  addItem({ status: 'green', name: 'On track task' });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Blocked task');
  assertIncludes(html, '2 Off Track');
  assertIncludes(html, '1 On Track');
});

test('an item with milestones shows a count badge, and its milestones are hidden until expanded', function () {
  const it = addItem({
    name: 'With milestones',
    milestones: [
      { id: 'm1', name: 'Requirements defined', dueDate: todayStr(), status: 'complete' },
      { id: 'm2', name: 'Design defined', dueDate: todayStr(), status: 'not-started' }
    ]
  });
  renderMain();
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, '1/2 milestones');
  assertNotIncludes(html, 'Requirements defined', 'milestones should stay collapsed by default');

  toggleItemExpanded(it.id);
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Requirements defined');
  assertIncludes(html, 'Design defined');

  toggleItemExpanded(it.id);
  html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'Requirements defined', 'toggling again should collapse it back');
});

test('an item with no milestones shows no count badge and no chevron toggle', function () {
  addItem({ name: 'No milestones here', milestones: [] });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'milestones</span>');
});

test('renderMain shows an empty state with no workstreams', function () {
  workstreams = [];
  items = [];
  renderMain();
  assertIncludes(document.getElementById('main').innerHTML, 'No workstreams yet');
});

test('an item\'s own actual date is not shown or editable inline on its row (still a real, editable field via the item modal)', function () {
  addItem({ name: 'Done item', actualDate: '2026-08-20' });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'item-actual-inline', 'the item-level inline actual-date input was intentionally removed from the row');
  assertNotIncludes(html, '2026-08-20');
});

test('a milestone with no actual date shows a "+" ghost instead of an empty editable input', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Open milestone', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'actual-date-ghost');
  assertIncludes(html, `revealActualDate('${it.milestones[0].id}')`);
  assertNotIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','actualDate'`, 'no editable Actual input should render until the ghost is clicked');
});

test('revealActualDate swaps a milestone\'s "+" ghost for a real editable input', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Open milestone', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  revealActualDate(it.milestones[0].id);
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'actual-date-ghost');
  assertIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','actualDate'`);
});

test('the revealed, still-empty Actual input wires up an Escape handler back to cancelRevealActualDate', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Open milestone', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  revealActualDate(it.milestones[0].id);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `cancelRevealActualDate('${it.milestones[0].id}')`);
});

test('cancelRevealActualDate reverts a revealed-but-still-empty Actual field back to the "+" ghost', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Open milestone', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  revealActualDate(it.milestones[0].id);
  cancelRevealActualDate(it.milestones[0].id);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'actual-date-ghost');
  assertNotIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','actualDate'`);
});

test('the Escape handler is not wired up on a milestone that already has a real actual date', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Done milestone', dueDate: todayStr(), status: 'complete', actualDate: '2026-08-05' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, `cancelRevealActualDate('${it.milestones[0].id}')`, 'a real, saved actual date is not a "reveal" state to cancel out of');
});

test('a milestone shows an inline actual-date input once its item is expanded', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Done milestone', dueDate: todayStr(), status: 'complete', actualDate: '2026-08-05' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'milestone-sub-actual-inline');
  assertIncludes(html, 'value="2026-08-05"');
});

test('milestones render in plain array order, not sorted by due date', function () {
  const it = addItem({
    name: 'Out of date order',
    milestones: [
      { id: 'm1', name: 'First in array, latest due', dueDate: '2027-01-01', status: 'not-started', actualDate: null },
      { id: 'm2', name: 'Second in array, earliest due', dueDate: '2026-01-01', status: 'not-started', actualDate: null }
    ]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  const idxFirst = html.indexOf('First in array, latest due');
  const idxSecond = html.indexOf('Second in array, earliest due');
  assertTrue(idxFirst >= 0 && idxSecond >= 0, 'both milestones should render');
  assertTrue(idxFirst < idxSecond, 'array order should win over due-date order — reordering the category template would otherwise have no visible effect on an already-planned item');
});

test('updateItemDateField updates a single date field on the item and saves it', function () {
  const it = addItem({ name: 'X' });
  updateItemDateField(it.id, 'actualDate', '2026-09-01');
  assertEqual(items[0].actualDate, '2026-09-01');
  updateItemDateField(it.id, 'dueDate', '2026-09-15');
  assertEqual(items[0].dueDate, '2026-09-15');
  assertEqual(items[0].startDate, todayStr(), 'other date fields should be untouched');
});

test('updateMilestoneDateField updates a single date field on one milestone only', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [
      { id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null },
      { id: 'm2', name: 'B', dueDate: todayStr(), status: 'not-started', actualDate: null }
    ]
  });
  updateMilestoneDateField(it.id, 'm1', 'actualDate', '2026-09-01');
  assertEqual(items[0].milestones[0].actualDate, '2026-09-01');
  assertEqual(items[0].milestones[1].actualDate, null, 'the other milestone should be untouched');
});

test('an item row shows IT/Business/Budget tag badges colored by their current value', function () {
  const it = addItem({ name: 'Tagged', itStatus: 'red', businessStatus: 'amber', budgetStatus: 'green' });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'item-tags');
  assertIncludes(html, `cycleItemAttr('${it.id}','itStatus')`);
  assertIncludes(html, `cycleItemAttr('${it.id}','businessStatus')`);
  assertIncludes(html, `cycleItemAttr('${it.id}','budgetStatus')`);
  assertIncludes(html, 'var(--stat-red)', 'itStatus red should color its badge');
});

test('a milestone sub-row never renders a tag badge — tags are item-level only', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  const count = (html.match(/class="item-tags"/g) || []).length;
  assertEqual(count, 1, 'exactly one item-tags block should appear — the item row\'s own, not one per milestone');
});

// ---------- Status board column alignment (grid) ----------

test('the milestone column header only appears once an item with milestones is expanded, not page-wide', function () {
  const it = addItem({
    name: 'X',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  renderMain();
  let html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'milestone-header', 'collapsed by default — no header should show yet');
  toggleItemExpanded(it.id);
  renderMain();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'milestone-header');
  ['Milestone', 'Due', 'Actual', 'Status'].forEach(label => assertIncludes(html, label));
});

test('an item with no milestones never shows a milestone header, even if toggled', function () {
  const it = addItem({ name: 'No milestones', milestones: [] });
  toggleItemExpanded(it.id); // has no effect — itemRowHtml only expands items that actually have milestones
  renderMain();
  assertNotIncludes(document.getElementById('main').innerHTML, 'milestone-header');
});

test('an item with no milestones still renders the milestone-count-badge element (empty), so its column never collapses', function () {
  addItem({ name: 'No milestones here', milestones: [] });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'class="milestone-count-badge"></span>', 'the badge cell must exist even when blank, or every later column shifts left');
});

test('an item with milestones shows its plan dates as read-only text, not editable inputs', function () {
  addItem({
    name: 'Has milestones',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'item-dates-computed');
  assertNotIncludes(html, 'item-dates-inline', 'an item with milestones should not offer editable Start/Due inputs on the row');
});

test('an item with no milestones still shows editable Start/Due inputs on the row', function () {
  addItem({ name: 'No milestones', milestones: [] });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'item-dates-inline');
  assertNotIncludes(html, 'item-dates-computed');
});

test('an item with milestones still renders exactly one milestone-count-badge with the count inside it', function () {
  addItem({
    name: 'Has milestones',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'complete', actualDate: null }]
  });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '1/1 milestones');
});

test('a milestone sub-row reuses the item-chevron column slot (in place of the chevron) so it lines up under the parent\'s first column', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Child milestone', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  // itemRowHtml's own chevron plus the milestone row's diamond-in-chevron-slot
  // means "item-chevron" should appear (at least) twice once expanded.
  const count = (html.match(/class="item-chevron"/g) || []).length;
  assertTrue(count >= 2, 'both the item\'s chevron and the milestone\'s diamond should use the shared column class');
});

// ---------- Not Applicable milestone toggle (status board) ----------

test('milestoneRowsHtml renders the Not Applicable toggle wired to toggleMilestoneNotApplicable, outline when off and filled when on', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [
      { id: 'm1', name: 'Regular', dueDate: todayStr(), status: 'not-started', actualDate: null, notApplicable: false },
      { id: 'm2', name: 'Skipped', dueDate: todayStr(), status: 'red', actualDate: null, notApplicable: true }
    ]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `toggleMilestoneNotApplicable('${it.id}','m1')`);
  assertIncludes(html, `toggleMilestoneNotApplicable('${it.id}','m2')`);
  assertIncludes(html, 'fa-regular fa-ban', 'the not-yet-marked milestone should show the outline icon');
  assertIncludes(html, 'fa-solid fa-ban', 'the marked milestone should show the filled icon');
});

test('the milestone header shows Status immediately before N/A, matching the data rows\' own column order', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  const headerIdx = html.indexOf('milestone-header');
  const header = html.slice(headerIdx, headerIdx + 400);
  assertIncludes(header, '<span>Status</span><span>N/A</span>', 'Status must be the column immediately before N/A in the header');
});

test('a milestone row\'s Status badge sits immediately before its Not Applicable toggle, matching the header\'s own column order', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'green', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  const naIdx = html.indexOf(`toggleMilestoneNotApplicable('${it.id}','m1')`);
  const statusIdx = html.indexOf(`cycleMilestoneStatus('${it.id}','m1')`);
  assertTrue(naIdx !== -1 && statusIdx !== -1 && statusIdx < naIdx, 'the Status badge must render before the Not Applicable toggle in DOM order');
});

test('the Not Applicable toggle and Status badge share one flex cell spanning both trailing columns, rather than the toggle claiming a whole 90px track on its own', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'green', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  const cellIdx = html.indexOf('milestone-status-cell', html.indexOf('milestone-sub-row'));
  assertTrue(cellIdx !== -1, 'a .milestone-status-cell wrapper should exist on the data row');
  const cellSlice = html.slice(cellIdx, cellIdx + 600);
  assertIncludes(cellSlice, `toggleMilestoneNotApplicable('${it.id}','m1')`, 'the toggle must live inside the spanning cell');
  assertIncludes(cellSlice, `cycleMilestoneStatus('${it.id}','m1')`, 'the status badge must live inside the same spanning cell');
});

test('a notApplicable milestone row freezes its status badge to a plain "N/A" label instead of its own RAG color, and is no longer cycleable', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Skipped', dueDate: todayStr(), status: 'red', actualDate: null, notApplicable: true }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>N/A<');
  assertNotIncludes(html, '>Off Track<', 'the underlying red status must not show while notApplicable');
  assertNotIncludes(html, `cycleMilestoneStatus('${it.id}','m1')`, 'the frozen badge must not still be clickable to cycle status');
});

test('a notApplicable milestone\'s Due cell renders as genuinely empty — no date pill at all, not just a disabled one', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Skipped', dueDate: null, status: 'not-started', actualDate: null, notApplicable: true }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  const rowIdx = html.indexOf('milestone-sub-row', html.indexOf('milestone-sub-row') + 1); // the data row, not the header
  const row = html.slice(rowIdx, rowIdx + 800);
  assertNotIncludes(row, 'item-dates-inline', 'no date-pill wrapper should render for Due while notApplicable');
  assertNotIncludes(row, '<input type="date"', 'no date input at all — matching how Actual already collapses to nothing when empty');
});

test('a notApplicable milestone\'s leftover Actual date (set before it was marked notApplicable) still renders as a disabled — not hidden — pill, unlike Due which always hides', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Skipped', dueDate: todayStr(), status: 'not-started', actualDate: '2026-01-01', notApplicable: true }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  const dateInputCount = (html.match(/<input type="date"[^>]*disabled/g) || []).length;
  assertEqual(dateInputCount, 1, 'only Actual should still render a (disabled) date input here — Due always hides regardless of its own value');
});

test('the Not Applicable toggle renders as an inert (non-clickable) icon below Editor, still showing the correct on/off state', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Skipped', dueDate: todayStr(), status: 'not-started', actualDate: null, notApplicable: true }]
  });
  toggleItemExpanded(it.id);
  userRole = 'reviewer';
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, `onclick="toggleMilestoneNotApplicable`, 'below Editor, the toggle must not be clickable');
  assertIncludes(html, 'fa-solid fa-ban', 'the on state should still be visibly shown, just inert');
});

test('the "X/Y milestones" badge excludes notApplicable milestones from both sides of the fraction', function () {
  addItem({
    name: 'Mixed',
    milestones: [
      { id: 'm1', name: 'Done', dueDate: todayStr(), status: 'complete', actualDate: null, notApplicable: false },
      { id: 'm2', name: 'Open', dueDate: todayStr(), status: 'not-started', actualDate: null, notApplicable: false },
      { id: 'm3', name: 'Skipped', dueDate: todayStr(), status: 'red', actualDate: null, notApplicable: true }
    ]
  });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '1/2 milestones', 'the notApplicable milestone should count toward neither the numerator nor the denominator');
});

test('an item whose milestones are all notApplicable shows an empty milestone badge but is still expandable', function () {
  const it = addItem({
    name: 'All skipped',
    milestones: [{ id: 'm1', name: 'Skipped', dueDate: todayStr(), status: 'red', actualDate: null, notApplicable: true }]
  });
  renderMain();
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'class="milestone-count-badge"></span>', 'no applicable milestones — the badge should render empty, not "0/0 milestones"');
  toggleItemExpanded(it.id);
  renderMain();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Skipped', 'the milestone should still be reachable when expanded, so it can be un-marked');
});
