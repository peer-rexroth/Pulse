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

test('renderDashboard excludes notApplicable milestones from the completion percentage entirely, on both sides of the fraction', function () {
  addDashItem({ milestones: [
    { id: 'm1', name: 'A', dueDate: todayStr(), status: 'complete' },
    { id: 'm2', name: 'B', dueDate: todayStr(), status: 'not-started' },
    { id: 'm3', name: 'C', dueDate: todayStr(), status: 'red', notApplicable: true }
  ] });
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '50%', 'still 1 of 2 applicable milestones — the notApplicable one must not count toward the denominator');
  assertIncludes(html, '1 of 2 milestones complete');
});

test('an overdue notApplicable milestone does not appear in the Overdue feed', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Skipped milestone', dueDate: isoDaysFromNow(-1), status: 'not-started', notApplicable: true }] });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Skipped milestone');
});

test('a notApplicable milestone due within the next 7 days does not appear in the Upcoming feed', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Skipped soon', dueDate: isoDaysFromNow(3), status: 'not-started', notApplicable: true }] });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Skipped soon');
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
  addDashItem({});
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, workstreams[0].name);
  assertIncludes(document.getElementById('main').innerHTML, '>1<');
});

test('completing a review cycle removes the workstream from the overdue-for-review count', function () {
  const it = addDashItem({});
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, it.id); // completeReviewCycle requires every item confirmed first
  completeReviewCycle(cycle.id);
  renderDashboard();
  // Scoped to the "Overdue for Review" card's own sub-stat text (its zero-count
  // branch reads "of N workstream(s)") rather than a blind '>1<' search — the
  // dashboard's unrelated "Item Status" card also legitimately shows "1" here
  // (one scope item exists), which a bare '>1<' substring check can't tell apart.
  assertIncludes(document.getElementById('main').innerHTML, 'of 1 workstream');
});

test('a workstream with no scope items yet is not counted in the Overdue for Review card — nothing to review yet', function () {
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, '>1<');
});

// ---------- Workstream scoping (shared filterWorkstreamId) ----------

test('selecting "All Workstreams" (filterWorkstreamId null) rolls up every workstream', function () {
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
  addDashItem({}); // gives workstreams[0] a scope item so it still counts as overdue for review below
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
