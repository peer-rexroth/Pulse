function addItem(overrides) {
  const it = Object.assign({
    id: genId(), workstreamId: workstreams[0].id,
    name: 'Item', owner: '', notes: '', status: 'green',
    startDate: todayStr(), dueDate: todayStr(), milestones: []
  }, overrides || {});
  items.push(it);
  return it;
}

test('setView switches the active view flag', function () {
  assertEqual(view, 'status');
  setView('timeline');
  assertEqual(view, 'timeline');
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

test('renderTimelineView renders one bar per item and one diamond per milestone', function () {
  addItem({
    name: 'Bar item',
    milestones: [{ id: 'm1', name: 'Diamond milestone', dueDate: todayStr(), status: 'green' }]
  });
  view = 'timeline';
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'tl-bar');
  assertIncludes(html, 'tl-milestone');
  assertIncludes(html, 'Bar item');
  assertIncludes(html, 'Diamond milestone');
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
