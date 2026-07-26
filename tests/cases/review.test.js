function addReviewItem(overrides) {
  const it = Object.assign({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id,
    name: 'Item', owner: '', notes: '', status: 'green',
    startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now()
  }, overrides || {});
  items.push(it);
  return it;
}

test('a workstream with no completed review cycle is overdue for review', function () {
  assertTrue(isReviewOverdue(workstreams[0].id));
});

test('starting a review cycle creates one active cycle for that workstream', function () {
  startReviewCycle(workstreams[0].id);
  assertEqual(reviewCycles.length, 1);
  assertEqual(reviewCycles[0].workstreamId, workstreams[0].id);
  assertTrue(!!activeReviewCycle(workstreams[0].id));
});

test('starting a review cycle twice for the same workstream is a no-op while one is active', function () {
  startReviewCycle(workstreams[0].id);
  startReviewCycle(workstreams[0].id);
  assertEqual(reviewCycles.length, 1);
});

test('a workstream with no items can complete its review cycle immediately (vacuously confirmed)', function () {
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertTrue(canCompleteReviewCycle(cycle));
});

test('a review cycle cannot complete until every current item is confirmed', function () {
  const it = addReviewItem({});
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertFalse(canCompleteReviewCycle(cycle));
  toggleReviewConfirm(cycle.id, it.id);
  assertTrue(canCompleteReviewCycle(cycle));
});

test('toggleReviewConfirm toggles a single item confirmation on and off', function () {
  const it = addReviewItem({});
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, it.id);
  assertEqual(reviewCycles[0].confirmations.length, 1);
  toggleReviewConfirm(cycle.id, it.id);
  assertEqual(reviewCycles[0].confirmations.length, 0);
});

test('an item added mid-cycle is automatically an unconfirmed blocker, with no extra bookkeeping', function () {
  const first = addReviewItem({ name: 'First' });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, first.id);
  assertTrue(canCompleteReviewCycle(cycle));
  addReviewItem({ name: 'Added mid-cycle' });
  assertFalse(canCompleteReviewCycle(cycle), 'the newly added item has no confirmation yet');
});

test('completeReviewCycle refuses to complete while items remain unconfirmed', function () {
  addReviewItem({});
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  completeReviewCycle(cycle.id);
  assertEqual(reviewCycles[0].completedAt, null);
});

test('completeReviewCycle marks the cycle completed once every item is confirmed', function () {
  const it = addReviewItem({});
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  assertTrue(!!reviewCycles[0].completedAt);
  assertEqual(activeReviewCycle(workstreams[0].id), undefined, 'a completed cycle is no longer active');
});

test('completing a review cycle updates lastCompletedReview / isReviewOverdue for that workstream', function () {
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  completeReviewCycle(cycle.id);
  assertFalse(isReviewOverdue(workstreams[0].id));
  assertTrue(lastCompletedReview(workstreams[0].id) > 0);
});

test('cancelReviewCycle marks the cycle cancelled and frees the workstream for a new cycle', function () {
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  cancelReviewCycle(cycle.id);
  assertEqual(document.getElementById('confirmModalActionBtn').textContent, 'Cancel Review', 'the button must not say "Delete" for a non-delete action');
  confirmModalAction();
  assertTrue(!!reviewCycles[0].cancelledAt);
  assertEqual(activeReviewCycle(workstreams[0].id), undefined);
  startReviewCycle(workstreams[0].id);
  assertEqual(reviewCycles.length, 2, 'a new cycle can start once the old one is cancelled');
});

test('reviewCyclesForWs returns every cycle (active, completed, cancelled) for that workstream only', function () {
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  const secondWs = workstreams[1].id;
  startReviewCycle(workstreams[0].id);
  startReviewCycle(secondWs);
  assertEqual(reviewCyclesForWs(workstreams[0].id).length, 1);
  assertEqual(reviewCyclesForWs(secondWs).length, 1);
});

// ---------- Shared workstream selector: Review mode's own gating ----------

test('setMode("review") is blocked while "All workstreams" is selected', function () {
  assertEqual(filterWorkstreamId, null);
  setMode('review');
  assertEqual(mode, 'planning', 'Review needs a specific workstream selected first');
});

test('setFilterWorkstream selects a workstream, which setMode("review") then accepts', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  assertEqual(mode, 'review');
});

test('picking "All workstreams" while already in Review mode falls back to Planning', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setFilterWorkstream(null);
  assertEqual(mode, 'planning', 'Review has nothing sensible to show once the selection is cleared');
});

test('normalizeData falls back to planning if mode is "review" with no workstream selected', function () {
  mode = 'review';
  filterWorkstreamId = null;
  normalizeData();
  assertEqual(mode, 'planning');
});

test('renderReview shows a start button when no cycle is active, and the checklist once one starts', function () {
  addReviewItem({ name: 'Checklist item' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Start review cycle');
  startReviewCycle(workstreams[0].id);
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Checklist item');
  assertIncludes(html, 'Complete review');
});

test('renderReview lists completed and cancelled cycles in history', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  completeReviewCycle(cycle.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Completed');
});

// ---------- Milestone-level confirmation ----------

function addReviewItemWithMilestones(names) {
  return addReviewItem({
    milestones: names.map(name => ({ id: genId(), name, dueDate: todayStr(), status: 'not-started', actualDate: null }))
  });
}

test('an item with milestones is not confirmed until every one of its milestones is confirmed individually', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertFalse(isItemConfirmedInCycle(cycle, it));
  toggleMilestoneConfirm(cycle.id, it.milestones[0].id);
  assertFalse(isItemConfirmedInCycle(cycle, it), 'one of two milestones confirmed should not be enough');
  toggleMilestoneConfirm(cycle.id, it.milestones[1].id);
  assertTrue(isItemConfirmedInCycle(cycle, it));
  toggleMilestoneConfirm(cycle.id, it.milestones[0].id);
  assertFalse(isItemConfirmedInCycle(cycle, it), 'unconfirming one milestone again should un-confirm the item');
});

test('toggleMilestoneConfirm toggles a single milestone confirmation on and off', function () {
  const it = addReviewItemWithMilestones(['A']);
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleMilestoneConfirm(cycle.id, it.milestones[0].id);
  assertEqual(reviewCycles[0].milestoneConfirmations.length, 1);
  toggleMilestoneConfirm(cycle.id, it.milestones[0].id);
  assertEqual(reviewCycles[0].milestoneConfirmations.length, 0);
});

test('toggleConfirmAllMilestones confirms every milestone on an item at once, and unconfirms all if already all confirmed', function () {
  const it = addReviewItemWithMilestones(['A', 'B', 'C']);
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleConfirmAllMilestones(cycle.id, it.id);
  assertTrue(isItemConfirmedInCycle(cycle, it));
  assertEqual(reviewCycles[0].milestoneConfirmations.length, 3);
  toggleConfirmAllMilestones(cycle.id, it.id);
  assertFalse(isItemConfirmedInCycle(cycle, it));
  assertEqual(reviewCycles[0].milestoneConfirmations.length, 0);
});

test('toggleConfirmAllMilestones only adds the still-unconfirmed milestones, leaving already-confirmed ones alone', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleMilestoneConfirm(cycle.id, it.milestones[0].id);
  const firstConfirmedAt = reviewCycles[0].milestoneConfirmations[0].confirmedAt;
  toggleConfirmAllMilestones(cycle.id, it.id);
  assertTrue(isItemConfirmedInCycle(cycle, it));
  assertEqual(reviewCycles[0].milestoneConfirmations.length, 2);
  assertEqual(reviewCycles[0].milestoneConfirmations.find(x => x.milestoneId === it.milestones[0].id).confirmedAt, firstConfirmedAt, 'the already-confirmed milestone should not be re-touched');
});

test('canCompleteReviewCycle requires every milestone confirmed, not just the item', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleMilestoneConfirm(cycle.id, it.milestones[0].id);
  assertFalse(canCompleteReviewCycle(cycle));
  toggleMilestoneConfirm(cycle.id, it.milestones[1].id);
  assertTrue(canCompleteReviewCycle(cycle));
});

test('a milestone added mid-cycle to an already-confirmed item un-confirms it, with no extra bookkeeping', function () {
  const it = addReviewItemWithMilestones(['A']);
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleConfirmAllMilestones(cycle.id, it.id);
  assertTrue(isItemConfirmedInCycle(cycle, it));
  it.milestones.push({ id: genId(), name: 'B', dueDate: todayStr(), status: 'not-started', actualDate: null });
  assertFalse(isItemConfirmedInCycle(cycle, it), 'the newly added milestone has no confirmation yet');
});

test('renderReview locks Plan dates as read-only, even for an item with zero milestones', function () {
  addReviewItem({ name: 'No milestones yet' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'item-dates-computed', 'plan dates should render as read-only text during review');
  assertNotIncludes(html, 'item-dates-inline', 'plan dates must not be editable inline during a review, unlike Planning');
});

test('renderReview shows individual and confirm-all milestone controls once an item is expanded', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleItemExpanded(it.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Confirm all');
  assertIncludes(html, `toggleConfirmAllMilestones('${cycle.id}','${it.id}')`);
  assertIncludes(html, `toggleMilestoneConfirm('${cycle.id}','${it.milestones[0].id}')`);
  assertIncludes(html, `toggleMilestoneConfirm('${cycle.id}','${it.milestones[1].id}')`);
});
