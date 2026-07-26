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

test('the Complete review button is disabled with an explanatory tooltip until every item is confirmed', function () {
  addReviewItem({ name: 'Unconfirmed item' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  renderReview();
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'disabled', 'the button should be visibly disabled while items remain unconfirmed');
  assertIncludes(html, 'Confirm every item', 'a tooltip should explain why it can\'t be completed yet');
  const it = items[0];
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, it.id);
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, '<button class="btn btn-primary" disabled', 'the button should become enabled once everything is confirmed');
  assertIncludes(html, 'Mark this review cycle as completed');
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

test('a completed cycle\'s history entry shows how many items were confirmed', function () {
  addReviewItem({ name: 'A' });
  addReviewItem({ name: 'B' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  items.forEach(it => toggleReviewConfirm(cycle.id, it.id));
  completeReviewCycle(cycle.id);
  assertEqual(reviewCycles[0].itemCountAtClose, 2);
  assertEqual(reviewCycles[0].confirmedCountAtClose, 2);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '2 of 2 confirmed');
});

test('a cancelled cycle\'s history entry shows partial confirmation progress at the moment it was cancelled', function () {
  addReviewItem({ name: 'A' });
  addReviewItem({ name: 'B' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, items[0].id);
  cancelReviewCycle(cycle.id);
  confirmModalAction();
  assertEqual(reviewCycles[0].itemCountAtClose, 2);
  assertEqual(reviewCycles[0].confirmedCountAtClose, 1);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '1 of 2 confirmed');
});

test('a cancelled cycle\'s confirmed-count snapshot stays accurate even if a milestone is later added to a confirmed item', function () {
  const it = addReviewItem({ name: 'A' });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, it.id);
  cancelReviewCycle(cycle.id);
  confirmModalAction();
  assertEqual(reviewCycles[0].confirmedCountAtClose, 1, 'the snapshot should reflect confirmation state at close time');
  it.milestones.push({ id: genId(), name: 'New milestone', dueDate: todayStr(), status: 'not-started', actualDate: null });
  assertFalse(isItemConfirmedInCycle(cycle, it), 'the item is no longer confirmed by live re-derivation now that it has an unconfirmed milestone');
  assertEqual(reviewCycles[0].confirmedCountAtClose, 1, 'but the frozen history snapshot must not retroactively change');
});

// ---------- Change log: what actually changed during a review ----------

test('updateMilestoneDateField logs a change against the active cycle when setting an actual date', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'Development completed', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', '2026-07-26');
  assertEqual(reviewCycles[0].changeLog.length, 1);
  const entry = reviewCycles[0].changeLog[0];
  assertEqual(entry.milestoneName, 'Development completed');
  assertIncludes(entry.change, 'Changed actual date to');
});

test('updateMilestoneDateField logs "Cleared actual date" when the value is unset', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started', actualDate: '2026-07-01' }]
  });
  startReviewCycle(workstreams[0].id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', null);
  assertEqual(activeReviewCycle(workstreams[0].id).changeLog[0].change, 'Cleared actual date');
});

test('cycleMilestoneStatus logs the new status against the active cycle', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'Design defined', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  startReviewCycle(workstreams[0].id);
  cycleMilestoneStatus(it.id, it.milestones[0].id);
  const entry = activeReviewCycle(workstreams[0].id).changeLog[0];
  assertEqual(entry.milestoneName, 'Design defined');
  assertEqual(entry.change, 'Status changed to On Track');
});

test('cycleItemAttr logs an item-level change (no milestoneName) against the active cycle', function () {
  const it = addReviewItem({ name: 'Call Money', itStatus: 'green' });
  startReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus');
  const entry = activeReviewCycle(workstreams[0].id).changeLog[0];
  assertEqual(entry.itemName, 'Call Money');
  assertEqual(entry.milestoneName, null);
  assertEqual(entry.change, 'IT changed to At Risk');
});

test('nothing is logged when no review cycle is active for the item\'s workstream', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  cycleMilestoneStatus(it.id, it.milestones[0].id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', '2026-07-26');
  cycleItemAttr(it.id, 'itStatus');
  assertEqual(reviewCycles.length, 0, 'sanity check — no cycle exists at all yet');
});

test('nothing is logged against a cycle once it has closed', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleConfirmAllMilestones(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  cycleMilestoneStatus(it.id, it.milestones[0].id);
  assertEqual(reviewCycles[0].changeLog.length, 0, 'edits after the cycle closed must not append to its change log');
});

test('renderReview shows a collapsed history entry with a chevron, expanding to reveal the actual changes', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'Development completed', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', '2026-07-26');
  toggleConfirmAllMilestones(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  renderReview();
  let html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'Development completed: Changed actual date', 'collapsed by default');
  assertIncludes(html, 'review-history-row');
  toggleHistoryExpanded(cycle.id);
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'review-change-row');
  assertIncludes(html, 'Development completed');
  assertIncludes(html, 'Changed actual date to');
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

test('renderReview hides the Edit/Delete actions on the item row', function () {
  const it = addReviewItem({ name: 'No editing here' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'item-actions', 'the column should still be a real (empty) element');
  assertNotIncludes(html, `onclick="deleteItem('${it.id}')"`, 'Delete must not be reachable from the row during a review');
  assertNotIncludes(html, `onclick="openItemModal('${it.id}')" title="Edit"`, 'Edit must not be reachable from the row during a review');
});

test('renderReview locks each milestone\'s own Due date too, leaving only Actual editable', function () {
  const it = addReviewItemWithMilestones(['A']);
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  toggleItemExpanded(it.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'milestone-sub-actual-inline', 'Actual should still be a real, editable input');
  assertNotIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','dueDate'`, 'Due must not be editable inline during a review');
  assertIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','actualDate'`, 'Actual must still be editable inline during a review');
});

test('the same item still shows its Edit/Delete actions and editable milestone Due dates back in Planning', function () {
  const it = addReviewItemWithMilestones(['A']);
  toggleItemExpanded(it.id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onclick="deleteItem('${it.id}')"`);
  assertIncludes(html, `updateMilestoneDateField('${it.id}','${it.milestones[0].id}','dueDate'`);
});

// ---------- Row mutations re-render whichever mode is actually showing ----------
// Regression coverage for a real bug: these row-level mutation handlers are
// now reachable from both Planning and Review (Review reuses Planning's own
// row markup — see itemRowHtml()'s reviewCycle param), but several of them
// used to call the Planning-only renderMain() directly. That silently
// replaced Review's checklist with Planning's status view the moment one
// fired while reviewing — e.g. clicking the chevron to expand an item's
// milestones. Deliberately does NOT call renderReview() again after the
// mutation in any of these — that would mask the bug by re-rendering over
// whatever the mutation itself produced.

test('expanding an item mid-review keeps showing the Review checklist, not Planning\'s status view', function () {
  const it = addReviewItemWithMilestones(['A']);
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  toggleItemExpanded(it.id);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'review-checklist', 'toggling expand mid-review must not swap in Planning\'s rendering');
  assertIncludes(html, 'Confirm all', 'the review-only confirm control should still be there');
});

test('cycling a milestone\'s status mid-review keeps showing the Review checklist', function () {
  const it = addReviewItemWithMilestones(['A']);
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  toggleItemExpanded(it.id);
  cycleMilestoneStatus(it.id, it.milestones[0].id);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'review-checklist');
});

test('cycling an IT/Business/Budget tag mid-review keeps showing the Review checklist', function () {
  const it = addReviewItem({});
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'review-checklist');
});

test('editing a milestone\'s Actual date mid-review keeps showing the Review checklist', function () {
  const it = addReviewItemWithMilestones(['A']);
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  toggleItemExpanded(it.id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', '2026-09-01');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'review-checklist');
});
