function addItem(overrides) {
  const it = Object.assign({
    id: genId(), workstreamId: workstreams[0].id,
    name: 'Item', owner: '', notes: '', status: 'green',
    startDate: todayStr(), dueDate: todayStr(), milestones: [],
    itemType: 'scope', journeyId: null
  }, overrides || {});
  items.push(it);
  return it;
}

// ---------- Planning's own scope-item search box ----------
// An explicit user request ("suggest UI improvements" -> "search/filter for
// scope items"): a plain, case-insensitive substring match against the
// item's own name, narrowing renderStatusView()'s output live.

test('render toggles the planning search toolbar only for Planning mode', function () {
  mode = 'planning';
  render();
  assertEqual(document.getElementById('planningSearchToolbar').style.display, '');
  mode = 'review'; filterWorkstreamId = workstreams[0].id;
  render();
  assertEqual(document.getElementById('planningSearchToolbar').style.display, 'none');
});

test('setPlanningSearch narrows renderMain\'s output to items whose name matches, case-insensitively', function () {
  addItem({ name: 'Migrate billing database' });
  addItem({ name: 'Update onboarding flow' });
  setPlanningSearch('BILLING');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Migrate billing database');
  assertNotIncludes(html, 'Update onboarding flow');
});

test('setPlanningSearch shows the clear button, clearPlanningSearch hides it again and restores the full list', function () {
  addItem({ name: 'Migrate billing database' });
  addItem({ name: 'Update onboarding flow' });
  setPlanningSearch('billing');
  assertEqual(document.getElementById('planningSearchClearBtn').style.display, '');
  clearPlanningSearch();
  assertEqual(document.getElementById('planningSearchClearBtn').style.display, 'none');
  assertEqual(document.getElementById('planningSearchInput').value, '');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Migrate billing database');
  assertIncludes(html, 'Update onboarding flow');
});

test('a workstream with zero matches is omitted entirely while searching — no header, no "No items yet." placeholder', function () {
  addItem({ name: 'Migrate billing database' });
  setPlanningSearch('nonexistent search term');
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, workstreams[0].name);
  assertNotIncludes(html, 'No items yet.');
});

test('RAG pill counts stay computed from the workstream\'s full, unfiltered item list while searching', function () {
  addItem({ name: 'Migrate billing database', status: 'red' });
  addItem({ name: 'Update onboarding flow', status: 'green' });
  setPlanningSearch('billing');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '1 Off Track');
  assertIncludes(html, '1 On Track');
});

test('the External Delivery split still applies within the filtered results', function () {
  addItem({ name: 'Vendor billing task', externalDelivery: true, externalDeliverySpoc: 'Jane Doe' });
  addItem({ name: 'Internal billing task' });
  setPlanningSearch('billing');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'External Deliveries');
  assertIncludes(html, 'Vendor billing task');
  assertIncludes(html, 'Internal billing task');
});

test('the Unassigned section is filtered too, and omitted entirely (even at Editor+) when searching finds nothing there', function () {
  const it = addItem({ name: 'Orphaned billing task', workstreamId: null });
  addItem({ name: 'Normal task' }); // has a real workstream
  setPlanningSearch('billing');
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Orphaned billing task');
  setPlanningSearch('something else entirely');
  html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'Unassigned');
  assertNotIncludes(html, it.name);
});

test('planningSearchQuery does not affect Review/Dashboard/Journeys — only Planning\'s own status board', function () {
  addItem({ name: 'Migrate billing database' });
  planningSearchQuery = 'nonexistent';
  mode = 'review'; filterWorkstreamId = workstreams[0].id; reviewTab = 'scope';
  startReviewCycle(workstreams[0].id);
  render();
  assertIncludes(document.getElementById('main').innerHTML, 'Migrate billing database');
});

// ---------- Quick-filter status chips ----------
// A lighter alternative to a full saved-filter-presets feature: one toggle
// chip per STATUSES entry, sitting in the same static toolbar as the search
// box, single-select (click the active one again to clear), composing with
// the search box as a plain AND.

test('renderPlanningStatusChips renders one chip per STATUSES entry, none active by default', function () {
  render();
  const html = document.getElementById('planningStatusFilterChips').innerHTML;
  STATUSES.forEach(s => assertIncludes(html, `>${esc(s.label)}<`));
  assertNotIncludes(html, 'active');
});

test('setPlanningStatusFilter narrows the board to items with that status, and marks the chip active', function () {
  addItem({ name: 'Red item', status: 'red' });
  addItem({ name: 'Green item', status: 'green' });
  setPlanningStatusFilter('red');
  const mainHtml = document.getElementById('main').innerHTML;
  assertIncludes(mainHtml, 'Red item');
  assertNotIncludes(mainHtml, 'Green item');
  assertIncludes(document.getElementById('planningStatusFilterChips').innerHTML, 'status-filter-chip active');
});

// An explicit user request ("the search filter should also filter
// Milestones with the respective status"): an item whose own rolled-up
// status doesn't match the selected chip should still show if any of its
// individual milestones does — the item's own status is only ever the
// weakest link across its milestones, so a plain item-status check alone
// would rarely surface anything for a chip like "Completed".

test('setPlanningStatusFilter also matches an item via one of its milestones, even when the item\'s own rolled-up status differs', function () {
  const it = addItem({
    name: 'Item with a completed milestone', status: 'red',
    milestones: [
      { id: 'm1', name: 'Done step', dueDate: todayStr(), status: 'complete', actualDate: null },
      { id: 'm2', name: 'Open step', dueDate: todayStr(), status: 'red', actualDate: null }
    ]
  });
  addItem({ name: 'Unrelated item', status: 'green' });
  setPlanningStatusFilter('complete');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, it.name, 'the item has a completed milestone, even though its own rolled-up status is red');
  assertNotIncludes(html, 'Unrelated item');
});

test('setPlanningStatusFilter ignores a notApplicable milestone\'s status when matching', function () {
  addItem({
    name: 'Item with an N/A milestone',
    status: 'green',
    milestones: [{ id: 'm1', name: 'Skipped step', dueDate: todayStr(), status: 'red', actualDate: null, notApplicable: true }]
  });
  setPlanningStatusFilter('red');
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'Item with an N/A milestone', 'a notApplicable milestone\'s status must never count toward a match');
});

test('setPlanningStatusFilter on the already-active chip clears the filter back to everything', function () {
  addItem({ name: 'Red item', status: 'red' });
  addItem({ name: 'Green item', status: 'green' });
  setPlanningStatusFilter('red');
  setPlanningStatusFilter('red'); // click the same chip again
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Red item');
  assertIncludes(html, 'Green item');
  assertNotIncludes(document.getElementById('planningStatusFilterChips').innerHTML, 'active');
});

test('the status filter composes with the search box (both must match)', function () {
  addItem({ name: 'Migrate billing database', status: 'red' });
  addItem({ name: 'Migrate onboarding flow', status: 'green' });
  addItem({ name: 'Update something else', status: 'red' });
  setPlanningSearch('migrate');
  setPlanningStatusFilter('red');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Migrate billing database');
  assertNotIncludes(html, 'Migrate onboarding flow', 'wrong status');
  assertNotIncludes(html, 'Update something else', 'wrong name');
});

test('a workstream with zero matches is omitted entirely while status-filtering, same as while searching', function () {
  addItem({ name: 'Green item', status: 'green' });
  setPlanningStatusFilter('red');
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, workstreams[0].name);
  assertNotIncludes(html, 'No items yet.');
});

test('RAG pill counts stay computed from the full, unfiltered item list while status-filtering', function () {
  addItem({ name: 'Red item', status: 'red' });
  addItem({ name: 'Green item', status: 'green' });
  setPlanningStatusFilter('red');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '1 Off Track');
  assertIncludes(html, '1 On Track');
});

test('the Unassigned section is filtered by status too, and omitted entirely when the filter finds nothing there', function () {
  addItem({ name: 'Orphaned red item', workstreamId: null, status: 'red' });
  addItem({ name: 'Normal green item', status: 'green' }); // has a real workstream
  setPlanningStatusFilter('red');
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Orphaned red item');
  setPlanningStatusFilter('red'); // clear
  setPlanningStatusFilter('amber'); // nothing is amber
  html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'Unassigned');
});

test('planningStatusFilter does not affect Review/Dashboard/Journeys — only Planning\'s own status board', function () {
  addItem({ name: 'Migrate billing database', status: 'red' });
  planningStatusFilter = 'amber'; // nothing matches this
  mode = 'review'; filterWorkstreamId = workstreams[0].id; reviewTab = 'scope';
  startReviewCycle(workstreams[0].id);
  render();
  assertIncludes(document.getElementById('main').innerHTML, 'Migrate billing database');
});

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

// ---------- External Delivery items get their own sub-section (renderStatusView()) ----------
// An explicit user request: "show scope items which are flagged as
// external separate from the scope item list ... similar like unassigned
// scope items ... under the scope items list. Show also the External SPOC
// in the view."

test('an externally-delivered item is pulled out of the main list into its own "External Deliveries" sub-section, still inside the same workstream', function () {
  addItem({ name: 'Normal item' });
  addItem({ name: 'Vendor-delivered item', externalDelivery: true, externalDeliverySpoc: 'Jane Doe' });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'External Deliveries');
  const subHeaderIdx = html.indexOf('External Deliveries');
  const normalIdx = html.indexOf('Normal item');
  const externalIdx = html.indexOf('Vendor-delivered item');
  assertTrue(normalIdx < subHeaderIdx, 'the normal item should render before the sub-section header');
  assertTrue(subHeaderIdx < externalIdx, 'the external item should render after the sub-section header, not in the main list');
});

// The row-level SPOC display above was later removed by an explicit user
// request ("remove the External Delivery SPOC from the list view") — the
// field itself is untouched (still stored, still editable in the item
// modal), only the row's own rendering of it is gone.

test('the External Deliveries sub-section no longer shows that item\'s own SPOC on the row', function () {
  addItem({ name: 'Vendor-delivered item', externalDelivery: true, externalDeliverySpoc: 'Jane Doe (Acme Corp)' });
  renderMain();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Jane Doe (Acme Corp)');
});

test('an external item\'s row never shows the item-external-spoc span, with or without a SPOC entered', function () {
  const withSpoc = addItem({ name: 'External, with SPOC', externalDelivery: true, externalDeliverySpoc: 'Jane Doe' });
  const withoutSpoc = addItem({ name: 'External, no SPOC yet', externalDelivery: true, externalDeliverySpoc: null });
  assertNotIncludes(itemRowHtml(withSpoc), 'item-external-spoc');
  assertNotIncludes(itemRowHtml(withoutSpoc), 'item-external-spoc');
});

test('a normal (non-external) item\'s row never shows the item-external-spoc span either', function () {
  const it = addItem({ name: 'Normal item' });
  assertNotIncludes(itemRowHtml(it), 'item-external-spoc');
});

test('RAG counts in the workstream header still include externally-delivered items, even though they render in the separate sub-section', function () {
  addItem({ status: 'red', name: 'External blocker', externalDelivery: true, externalDeliverySpoc: 'Jane Doe' });
  addItem({ status: 'green', name: 'Normal item' });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '1 Off Track');
  assertIncludes(html, '1 On Track');
});

test('a workstream with only externally-delivered items shows no "No items yet." placeholder in the main list', function () {
  addItem({ name: 'Only item, external', externalDelivery: true, externalDeliverySpoc: 'Jane Doe' });
  renderMain();
  assertNotIncludes(document.getElementById('main').innerHTML, 'No items yet.');
});

test('a workstream with genuinely zero items still shows the "No items yet." placeholder', function () {
  renderMain();
  assertIncludes(document.getElementById('main').innerHTML, 'No items yet.');
});

test('a workstream with no externally-delivered items shows no "External Deliveries" sub-section at all', function () {
  addItem({ name: 'Normal item' });
  renderMain();
  assertNotIncludes(document.getElementById('main').innerHTML, 'External Deliveries');
});

// ---------- External Deliveries quick-filter chip ----------
// An explicit user request ("add External Delivery to the left navigation
// pane, under 'All Workstreams'") originally added this as a new mode with
// its own sidebar row (mirroring Journeys' own entry point). A later,
// separate explicit user request moved it to its own #tabExternal topbar
// button instead, and made it genuinely respect filterWorkstreamId. A
// third, separate explicit user request removed the standalone mode
// entirely — the topbar button, MODES entry, and renderExternalDelivery()
// are all gone — folding it into a single boolean quick-filter chip
// (setPlanningExternalFilter()) sitting in Planning's own toolbar, right
// alongside the status chips (separated by a small .chip-divider), rather
// than being a separate page at all.

test('renderPlanningStatusChips appends an External Deliveries toggle after a divider, inactive by default', function () {
  render();
  const html = document.getElementById('planningStatusFilterChips').innerHTML;
  assertIncludes(html, 'chip-divider');
  assertIncludes(html, 'External Deliveries');
  const dividerIdx = html.indexOf('chip-divider');
  const extIdx = html.indexOf('External Deliveries');
  assertTrue(dividerIdx < extIdx, 'the divider must sit before the External Deliveries chip, after the status chips');
  assertNotIncludes(html, 'status-filter-chip active');
});

test('setPlanningExternalFilter toggles the board down to only externally-delivered items, and back', function () {
  addItem({ name: 'Vendor task', externalDelivery: true, externalDeliverySpoc: 'Jane' });
  addItem({ name: 'Internal task' });
  setPlanningExternalFilter();
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Vendor task');
  assertNotIncludes(html, 'Internal task');
  assertIncludes(document.getElementById('planningStatusFilterChips').innerHTML, 'status-filter-chip active');

  setPlanningExternalFilter(); // toggle back off
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Vendor task');
  assertIncludes(html, 'Internal task');
  assertNotIncludes(document.getElementById('planningStatusFilterChips').innerHTML, 'status-filter-chip active');
});

test('the External Deliveries filter composes with both the search box and the status chips', function () {
  addItem({ name: 'Vendor billing task', status: 'red', externalDelivery: true, externalDeliverySpoc: 'Jane' });
  addItem({ name: 'Vendor onboarding task', status: 'green', externalDelivery: true, externalDeliverySpoc: 'Bob' });
  addItem({ name: 'Internal billing task', status: 'red' });
  setPlanningSearch('billing');
  setPlanningStatusFilter('red');
  setPlanningExternalFilter();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Vendor billing task');
  assertNotIncludes(html, 'Vendor onboarding task', 'wrong status');
  assertNotIncludes(html, 'Internal billing task', 'not external');
});

test('External Deliveries mode/topbar button/renderExternalDelivery() no longer exist', function () {
  assertFalse(MODES.includes('external'));
  assertEqual(typeof renderExternalDelivery, 'undefined');
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

// ---------- "Expand all"/"Collapse all" for a whole section ----------
// An explicit user request: once a section holds more than a handful of
// multi-milestone items, expanding each one individually via its own
// chevron gets tedious.

test('a workstream section with no expandable items shows no "Expand all" button', function () {
  addItem({ name: 'No milestones here', milestones: [] });
  renderMain();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Expand all');
});

test('toggleExpandAllForItems expands every item in the list, and the button flips to "Collapse all"', function () {
  const a = addItem({ name: 'Item A', milestones: [{ id: 'm1', name: 'M1', dueDate: todayStr(), status: 'not-started' }] });
  const b = addItem({ name: 'Item B', milestones: [{ id: 'm2', name: 'M2', dueDate: todayStr(), status: 'not-started' }] });
  renderMain();
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Expand all');
  assertNotIncludes(html, 'M1');
  assertNotIncludes(html, 'M2');

  toggleExpandAllForItems([a.id, b.id]);
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'M1');
  assertIncludes(html, 'M2');
  assertIncludes(html, 'Collapse all');
  assertNotIncludes(html, 'Expand all');
});

test('toggleExpandAllForItems collapses every item back once all are already expanded', function () {
  const a = addItem({ name: 'Item A', milestones: [{ id: 'm1', name: 'M1', dueDate: todayStr(), status: 'not-started' }] });
  const b = addItem({ name: 'Item B', milestones: [{ id: 'm2', name: 'M2', dueDate: todayStr(), status: 'not-started' }] });
  toggleExpandAllForItems([a.id, b.id]);
  toggleExpandAllForItems([a.id, b.id]); // click "Collapse all"
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'M1');
  assertNotIncludes(html, 'M2');
  assertIncludes(html, 'Expand all');
});

test('the button reads "Expand all" (not "Collapse all") as soon as any one item in the group is still collapsed', function () {
  const a = addItem({ name: 'Item A', milestones: [{ id: 'm1', name: 'M1', dueDate: todayStr(), status: 'not-started' }] });
  addItem({ name: 'Item B', milestones: [{ id: 'm2', name: 'M2', dueDate: todayStr(), status: 'not-started' }] });
  toggleItemExpanded(a.id); // expand only one of the two
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Expand all', 'not every item in the group is expanded yet');
  assertNotIncludes(html, 'Collapse all');
});

test('a zero-milestone item is excluded from the "Expand all" group entirely', function () {
  const a = addItem({ name: 'Has milestones', milestones: [{ id: 'm1', name: 'M1', dueDate: todayStr(), status: 'not-started' }] });
  addItem({ name: 'No milestones', milestones: [] });
  renderMain();
  assertIncludes(document.getElementById('main').innerHTML, 'Expand all');
  toggleExpandAllForItems([a.id]); // simulates clicking the button — only the real, multi-milestone item's id is ever passed in
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Collapse all', 'the one expandable item is now expanded, so the whole group reads as fully expanded');
});

test('the Unassigned section gets its own independent "Expand all" toggle', function () {
  const it = addItem({ name: 'Unassigned with milestones', workstreamId: null, milestones: [{ id: 'm1', name: 'M1', dueDate: todayStr(), status: 'not-started' }] });
  renderMain();
  assertIncludes(document.getElementById('main').innerHTML, 'Expand all');
  toggleExpandAllForItems([it.id]);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'M1');
  assertIncludes(html, 'Collapse all');
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

// ---------- The Actual ghost is disabled until a due date exists ----------
// An explicit user request: recording when something actually finished
// doesn't make sense before it's even been given a planned date — the
// common case now that a fresh 'pending' milestone starts with
// dueDate:null (see "Pending status" in CLAUDE.md).

test('the Actual ghost renders disabled (not clickable) when the milestone has no due date yet', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'actual-date-ghost');
  assertIncludes(html, 'disabled');
  assertNotIncludes(html, `revealActualDate('${it.milestones[0].id}')`, 'no click handler should be wired up while disabled');
});

test('revealActualDate is not reachable while the Actual ghost is disabled — a due date must be set first', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  updateMilestoneDateField(it.id, it.milestones[0].id, 'dueDate', '2026-09-01');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `revealActualDate('${it.milestones[0].id}')`, 'once a due date exists, the ghost becomes clickable');
  assertNotIncludes(html, 'actual-date-ghost" disabled');
});

test('an already-set Actual date still renders as a normal editable pill even with no due date', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: '2026-08-01' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'actual-date-ghost', 'an already-set Actual date is never a ghost, regardless of Due');
  assertIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','actualDate'`);
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

// ---------- Due-date ghost — revealDueDate()/cancelRevealDueDate()'s
// counterpart to revealActualDate()/cancelRevealActualDate() above, added
// alongside the new 'pending' status (see STATUSES' own comment in
// pulse.html) — a fresh 'pending' milestone starts with no due date at all,
// so it needs the exact same "+" reveal treatment Actual already had. ----------

test('a milestone with no due date shows a "+" ghost instead of an empty editable input', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'due-date-ghost');
  assertIncludes(html, `revealDueDate('${it.milestones[0].id}')`);
  assertNotIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','dueDate'`, 'no editable Due input should render until the ghost is clicked');
});

test('revealDueDate swaps a milestone\'s "+" ghost for a real editable input', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  revealDueDate(it.milestones[0].id);
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'due-date-ghost');
  assertIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','dueDate'`);
});

test('the revealed, still-empty Due input wires up an Escape handler back to cancelRevealDueDate', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  revealDueDate(it.milestones[0].id);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `cancelRevealDueDate('${it.milestones[0].id}')`);
});

test('cancelRevealDueDate reverts a revealed-but-still-empty Due field back to the "+" ghost', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  revealDueDate(it.milestones[0].id);
  cancelRevealDueDate(it.milestones[0].id);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'due-date-ghost');
  assertNotIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','dueDate'`);
});

test('the Due ghost never renders for a milestone that already has a real due date, regardless of status', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Dated milestone', dueDate: todayStr(), status: 'pending', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'due-date-ghost', 'the ghost keys off a genuinely missing due date, not the status value');
  assertIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','dueDate'`);
});

test('a Due ghost is not clickable (renders as nothing) below Editor', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  userRole = 'reviewer';
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'due-date-ghost');
  assertNotIncludes(html, `revealDueDate('${it.milestones[0].id}')`);
});

test('Due is locked to a plain read-only "—" (not a crash) during a review when the milestone has no due date yet', function () {
  const it = addItem({
    workstreamId: workstreams[0].id,
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Undated milestone', dueDate: null, status: 'pending', actualDate: null }]
  });
  const cycle = { id: 'c1', workstreamId: workstreams[0].id, startedAt: Date.now(), completedAt: null, cancelledAt: null, confirmations: [], milestoneConfirmations: [] };
  toggleItemExpanded(it.id);
  const html = itemRowHtml(it, cycle);
  assertIncludes(html, '>—<');
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

// ---------- Incomplete date input snaps back on blur (not a silent no-op) ----------
// A native <input type="date"> reports '' for this.value until every
// segment (day/month/year) is filled in. onblur only commits when a value
// is present; a user-reported bug found that leaving an incomplete edit
// there just did nothing, with no feedback, so the input kept showing
// whatever partial text was typed — reading as "saved" until some later,
// unrelated render (a mode switch, a status cycle) quietly snapped it back
// to the real stored date. The else-branch fix snaps it back immediately.

test('an item with no milestones — its inline Due input snaps back to the stored date on an incomplete edit, instead of silently doing nothing', function () {
  const it = addItem({ name: 'No milestones', milestones: [], dueDate: '2026-08-01' });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onblur="if(this.value) updateItemDateField('${it.id}','dueDate',this.value); else this.value='2026-08-01'"`);
});

test('an item with no milestones — its inline Start input snaps back to the stored date on an incomplete edit', function () {
  const it = addItem({ name: 'No milestones', milestones: [], startDate: '2026-07-01' });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onblur="if(this.value) updateItemDateField('${it.id}','startDate',this.value); else this.value='2026-07-01'"`);
});

test('a milestone sub-row\'s Due input snaps back to the stored date on an incomplete edit', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'A', dueDate: '2026-08-15', status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onblur="if(this.value) updateMilestoneDateField('${it.id}','m1','dueDate',this.value); else this.value='2026-08-15'"`);
});

// ---------- Date inputs also commit on 'change', not just blur ----------
// A screen recording of the reported bug showed that picking a date from
// the native calendar popup (showPicker()) updates the input's displayed
// value immediately, but doesn't reliably fire blur afterward — so onblur,
// the only thing wired to actually write the value into `items`/`milestones`,
// never ran. The edit looked saved (right value on screen) until some later,
// unrelated render (switching modes) rebuilt the row from the real,
// never-updated stored date. `onchange` fires the moment the popup commits
// a value, regardless of that focus/blur quirk, so every date input now
// wires it up alongside onblur.

test('an item with no milestones — its inline Due input also commits on change, not just blur', function () {
  const it = addItem({ name: 'No milestones', milestones: [] });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onchange="if(this.value) updateItemDateField('${it.id}','dueDate',this.value)"`);
});

test('an item with no milestones — its inline Start input also commits on change', function () {
  const it = addItem({ name: 'No milestones', milestones: [] });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onchange="if(this.value) updateItemDateField('${it.id}','startDate',this.value)"`);
});

test('a milestone sub-row\'s Due input also commits on change', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onchange="if(this.value) updateMilestoneDateField('${it.id}','m1','dueDate',this.value)"`);
});

test('a milestone sub-row\'s Actual input also commits on change', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: '2026-06-01' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onchange="if(this.value) updateMilestoneDateField('${it.id}','m1','actualDate',this.value)"`);
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

// ---------- Delayed-milestone color coding (Due/Actual pills) ----------

test('a milestone still open past its own Due date gets its Due pill flagged overdue', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Late one', dueDate: '2020-01-01', status: 'amber', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'pill-overdue');
});

test('a Complete milestone never gets its Due pill flagged, even if its Due date is in the past', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Done on time', dueDate: '2020-01-01', status: 'complete', actualDate: '2020-01-01' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'pill-overdue', 'Due itself should not read as still-open once the milestone is Complete');
});

test('a milestone due in the future is never flagged overdue', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Not due yet', dueDate: '2099-01-01', status: 'green', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'pill-overdue');
});

test('an Actual date recorded after its own Due date gets flagged, whether or not the milestone is marked Complete', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Finished late', dueDate: '2020-01-01', status: 'complete', actualDate: '2020-03-01' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'pill-overdue');
  assertIncludes(html, 'Finished after its Due date');
});

test('an Actual date recorded on or before its own Due date is never flagged', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Finished on time', dueDate: '2020-06-01', status: 'complete', actualDate: '2020-05-01' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'pill-overdue');
});

// ---------- "Completed Late" — a computed display label, not a real status ----------
// An explicit user request: the 'complete' status value itself is unchanged
// (STATUS_SEVERITY, the click-to-cycle, RAG counts, item roll-up), but a
// Complete milestone/item whose actualDate landed after its own dueDate
// renders "Completed Late" instead of "Completed" wherever its badge shows.

test('the "complete" status label was renamed from "Complete" to "Completed"', function () {
  assertEqual(statusLabel('complete'), 'Completed');
});

test('isCompletedLate is true only for a Complete, dated, past-due-and-already-happened finish', function () {
  assertTrue(isCompletedLate('complete', '2020-01-01', '2020-03-01', false), 'late finish, already happened');
  assertFalse(isCompletedLate('green', '2020-01-01', '2020-03-01', false), 'not Complete');
  assertFalse(isCompletedLate('complete', '2020-06-01', '2020-05-01', false), 'finished on/before Due');
  assertFalse(isCompletedLate('complete', '2020-01-01', '2020-03-01', true), 'notApplicable is excluded');
  assertFalse(isCompletedLate('complete', null, '2020-03-01', false), 'no dueDate to compare against');
  assertFalse(isCompletedLate('complete', '2020-01-01', null, false), 'no actualDate at all — nothing to flag');
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  assertFalse(isCompletedLate('complete', '2020-01-01', future, false), 'a logged-ahead completion date in the future is a plan, not a late finish yet');
});

test('a milestone that finished after its Due date shows "Completed Late" instead of "Completed"', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Finished late', dueDate: '2020-01-01', status: 'complete', actualDate: '2020-03-01' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Completed Late');
  assertNotIncludes(html, '>Completed<', 'the plain label should not also render for the same milestone');
});

test('a milestone that finished on time still shows the plain "Completed" label, not "Completed Late"', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Finished on time', dueDate: '2020-06-01', status: 'complete', actualDate: '2020-05-01' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>Completed<');
  assertNotIncludes(html, 'Completed Late');
});

test('itemIsCompletedLate rolls up from any one applicable milestone finishing late, even if the item itself has no dates of its own', function () {
  const it = addItem({
    name: 'Parent', status: 'complete',
    milestones: [
      { id: 'm1', name: 'On time', dueDate: '2020-01-01', status: 'complete', actualDate: '2020-01-01' },
      { id: 'm2', name: 'Late', dueDate: '2020-01-01', status: 'complete', actualDate: '2020-03-01' }
    ]
  });
  assertTrue(itemIsCompletedLate(it));
});

test('itemRowHtml shows "Completed Late" on the item\'s own row when any of its milestones finished late', function () {
  const it = addItem({
    name: 'Parent', status: 'complete',
    milestones: [
      { id: 'm1', name: 'On time', dueDate: '2020-01-01', status: 'complete', actualDate: '2020-01-01' },
      { id: 'm2', name: 'Late', dueDate: '2020-01-01', status: 'complete', actualDate: '2020-03-01' }
    ]
  });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Completed Late');
});

test('a zero-milestone item that is Complete with a late actualDate shows "Completed Late" on its own row', function () {
  const it = addItem({
    name: 'Parent', status: 'complete', dueDate: '2020-01-01', actualDate: '2020-03-01', milestones: []
  });
  assertTrue(itemIsCompletedLate(it));
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Completed Late');
});

test('a zero-milestone item that is Complete with an on-time actualDate stays plain "Completed"', function () {
  const it = addItem({
    name: 'Parent', status: 'complete', dueDate: '2020-06-01', actualDate: '2020-05-01', milestones: []
  });
  assertFalse(itemIsCompletedLate(it));
});

test('an Actual date later than Due but still in the future is not flagged — it\'s a plan, not a late finish yet', function () {
  const it = addItem({
    name: 'Parent',
    // status: 'complete' keeps dueOverdue from also tripping pill-overdue on
    // the Due pill itself — this test is isolating the Actual-side flag only.
    milestones: [{ id: 'm1', name: 'Planned ahead', dueDate: '2020-01-01', status: 'complete', actualDate: '2099-01-01' }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'pill-overdue', 'a future Actual date is a plan, not yet a late finish, even if later than Due');
});

test('an Actual date of today, later than Due, is flagged — today already counts as having happened', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Finished today, late', dueDate: '2020-01-01', status: 'complete', actualDate: todayStr() }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'pill-overdue');
});

test('a notApplicable milestone is never flagged overdue on Due, even with a past Due date', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'Skipped', dueDate: '2020-01-01', status: 'red', actualDate: null, notApplicable: true }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'pill-overdue');
});

test('the milestone header shows Status immediately before MS Req. (the Not Applicable toggle\'s column), matching the data rows\' own column order', function () {
  const it = addItem({
    name: 'Parent',
    milestones: [{ id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  const headerIdx = html.indexOf('milestone-header');
  const header = html.slice(headerIdx, headerIdx + 400);
  assertIncludes(header, '<span>Status</span><span>MS Req.</span>', 'Status must be the column immediately before the Not Applicable toggle\'s header label');
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
