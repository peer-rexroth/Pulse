function addDashItem(overrides) {
  const it = Object.assign({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id,
    name: 'Item', owner: '', notes: '', status: 'green',
    startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now()
  }, overrides || {});
  items.push(it);
  return it;
}
function isoDaysFromNow(n) { return new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10); }

test('renderDashboard shows an empty state with no workstreams', function () {
  workstreams = []; items = [];
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'No workstreams yet');
});

test('allMilestonesFlat flattens every item\'s milestones with their parent item name attached', function () {
  addDashItem({ milestones: [{ id: 'm1', name: 'M1', dueDate: todayStr(), status: 'not-started' }] });
  const flat = allMilestonesFlat();
  assertEqual(flat.length, 1);
  assertEqual(flat[0].itemName, 'Item');
});

test('renderDashboard reports the RAG breakdown across items', function () {
  addDashItem({ status: 'red', name: 'Red one' });
  addDashItem({ status: 'red', name: 'Red two' });
  addDashItem({ status: 'green', name: 'Green one' });
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '2 Off Track');
  assertIncludes(html, '1 On Track');
});

test('renderDashboard reports milestone completion percentage', function () {
  addDashItem({ milestones: [
    { id: 'm1', name: 'A', dueDate: todayStr(), status: 'complete' },
    { id: 'm2', name: 'B', dueDate: todayStr(), status: 'not-started' }
  ] });
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '50%');
  assertIncludes(html, '1 of 2 milestones complete');
});

test('an overdue item (past due, not complete) appears in the Overdue feed', function () {
  addDashItem({ name: 'Late task', status: 'red', dueDate: isoDaysFromNow(-3) });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Late task');
});

test('a completed item past its due date does not appear as overdue', function () {
  addDashItem({ name: 'Done already', status: 'complete', dueDate: isoDaysFromNow(-3) });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Done already');
});

test('an item due within the next 7 days appears in the Upcoming feed', function () {
  addDashItem({ name: 'Due soon', status: 'amber', dueDate: isoDaysFromNow(3) });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Due soon');
});

test('an item due more than 7 days out does not appear in the Upcoming feed', function () {
  addDashItem({ name: 'Far off', status: 'amber', dueDate: isoDaysFromNow(20) });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Far off');
});

test('an overdue milestone shows as "item name — milestone name"', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Late milestone', dueDate: isoDaysFromNow(-1), status: 'not-started' }] });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Parent item — Late milestone');
});

test('a workstream overdue for review is counted and named in the Overdue for Review card', function () {
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, workstreams[0].name);
  assertIncludes(document.getElementById('main').innerHTML, '>1<');
});

test('completing a review cycle removes the workstream from the overdue-for-review count', function () {
  startReviewCycle(workstreams[0].id);
  completeReviewCycle(activeReviewCycle(workstreams[0].id).id);
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, '>1<');
});

// ---------- Workstream scoping (shared filterWorkstreamId) ----------

test('selecting "All workstreams" (filterWorkstreamId null) rolls up every workstream', function () {
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  addDashItem({ name: 'In first', workstreamId: workstreams[0].id });
  addDashItem({ name: 'In second', workstreamId: workstreams[1].id });
  setFilterWorkstream(null);
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>2<'); // total item count across both workstreams
});

test('selecting a specific workstream scopes the item count, RAG breakdown, and attention feeds to it alone', function () {
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  const secondWsId = workstreams[1].id;
  addDashItem({ name: 'First stream item', workstreamId: workstreams[0].id, status: 'red', dueDate: isoDaysFromNow(-2) });
  addDashItem({ name: 'Second stream item', workstreamId: secondWsId, status: 'red', dueDate: isoDaysFromNow(-2) });
  setFilterWorkstream(secondWsId);
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>1<'); // only the second workstream's item counted
  assertIncludes(html, 'Second stream item');
  assertNotIncludes(html, 'First stream item');
});

test('selecting a specific workstream narrows the per-workstream summary and overdue-for-review count to it', function () {
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  const secondWsId = workstreams[1].id;
  startReviewCycle(secondWsId);
  completeReviewCycle(activeReviewCycle(secondWsId).id); // second workstream is now up to date, first is still overdue
  setFilterWorkstream(secondWsId);
  renderDashboard();
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>0<'); // scoped to the up-to-date workstream only
  setFilterWorkstream(workstreams[0].id);
  renderDashboard();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>1<'); // scoped to the still-overdue workstream only
});
