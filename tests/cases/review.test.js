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

test('cancelReviewCycle removes the cycle entirely (not tracked) and frees the workstream for a new cycle', function () {
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  cancelReviewCycle(cycle.id);
  assertEqual(document.getElementById('confirmModalActionBtn').textContent, 'Cancel Review', 'the button must not say "Delete" for a non-delete action');
  confirmModalAction();
  assertEqual(reviewCycles.length, 0, 'a cancelled cycle is not kept around at all');
  assertEqual(activeReviewCycle(workstreams[0].id), undefined);
  startReviewCycle(workstreams[0].id);
  assertEqual(reviewCycles.length, 1, 'a new cycle can start once the old one is cancelled');
});

test('reviewCyclesForWs returns every cycle (active and completed) for that workstream only', function () {
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

test('renderReview lists completed cycles in history', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  completeReviewCycle(cycle.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Completed');
});

test('renderReview only shows the 5 most recent history entries by default, with a Show more button for the rest', function () {
  const wsId = workstreams[0].id;
  setFilterWorkstream(wsId);
  setMode('review');
  for (let i = 0; i < 7; i++) {
    startReviewCycle(wsId);
    completeReviewCycle(activeReviewCycle(wsId).id);
  }
  renderReview();
  let html = document.getElementById('main').innerHTML;
  const rowCount = (html.match(/class="review-history-row"/g) || []).length;
  assertEqual(rowCount, 5, 'only the 5 most recent completed cycles should show by default');
  assertIncludes(html, 'Show 2 more', 'the button should say how many older entries are hidden');

  toggleHistoryShowAll(wsId);
  renderReview();
  html = document.getElementById('main').innerHTML;
  const expandedRowCount = (html.match(/class="review-history-row"/g) || []).length;
  assertEqual(expandedRowCount, 7, 'clicking Show more should reveal every entry, including the oldest');
  assertIncludes(html, 'Show less');
});

test('renderReview shows no Show-more button when there are 5 or fewer history entries', function () {
  const wsId = workstreams[0].id;
  setFilterWorkstream(wsId);
  setMode('review');
  for (let i = 0; i < 3; i++) {
    startReviewCycle(wsId);
    completeReviewCycle(activeReviewCycle(wsId).id);
  }
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'Show', 'no pagination control is needed when everything already fits');
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

test('a cancelled review cycle is not tracked — it never appears in history at all', function () {
  addReviewItem({ name: 'A' });
  addReviewItem({ name: 'B' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, items[0].id);
  cancelReviewCycle(cycle.id);
  confirmModalAction();
  assertEqual(reviewCycles.length, 0, 'the cancelled cycle should not be kept at all');
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'No past review cycles yet.');
});

test('a completed cycle\'s confirmed-count snapshot stays accurate even if a milestone is later added to a confirmed item', function () {
  const it = addReviewItem({ name: 'A' });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  assertEqual(reviewCycles[0].confirmedCountAtClose, 1, 'the snapshot should reflect confirmation state at close time');
  it.milestones.push({ id: genId(), name: 'New milestone', dueDate: todayStr(), status: 'not-started', actualDate: null });
  assertFalse(isItemConfirmedInCycle(cycle, it), 'the item is no longer confirmed by live re-derivation now that it has an unconfirmed milestone');
  assertEqual(reviewCycles[0].confirmedCountAtClose, 1, 'but the frozen history snapshot must not retroactively change');
});

// ---------- Change log: what actually changed during a review ----------

test('updateMilestoneDateField logs a before-→after change, falling back to the plan (due) date when there was no prior actual date', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'Development completed', dueDate: '2026-06-01', status: 'not-started', actualDate: null }]
  });
  startReviewCycle(workstreams[0].id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', '2026-07-26');
  assertEqual(reviewCycles[0].changeLog.length, 1);
  const entry = reviewCycles[0].changeLog[0];
  assertEqual(entry.milestoneName, 'Development completed');
  assertEqual(entry.change, `Actual: ${fmtDate('2026-06-01')} → ${fmtDate('2026-07-26')}`, 'with no prior actual date, the former side should fall back to the milestone\'s plan (due) date');
});

test('a second actual-date change uses the previous actual date as the former value, not the plan date', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'M', dueDate: '2026-06-01', status: 'not-started', actualDate: '2026-07-01' }]
  });
  startReviewCycle(workstreams[0].id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', '2026-07-15');
  const entry = activeReviewCycle(workstreams[0].id).changeLog[0];
  assertEqual(entry.change, `Actual: ${fmtDate('2026-07-01')} → ${fmtDate('2026-07-15')}`);
});

test('updateMilestoneDateField logs "Cleared actual date" when the value is unset', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started', actualDate: '2026-07-01' }]
  });
  startReviewCycle(workstreams[0].id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', null);
  assertEqual(activeReviewCycle(workstreams[0].id).changeLog[0].change, 'Cleared actual date');
});

test('updateMilestoneDateField is a no-op (no log entry) when the value hasn\'t actually changed', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  startReviewCycle(workstreams[0].id);
  // Simulates focusing the empty Actual ghost input then blurring without typing anything.
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', null);
  assertEqual(activeReviewCycle(workstreams[0].id).changeLog.length, 0, 'a bare focus+blur with no real edit should not be recorded as a change');
});

test('updateItemDateField is a no-op (no log entry) when the value hasn\'t actually changed', function () {
  const it = addReviewItem({ startDate: '2026-06-01', dueDate: '2026-07-01' });
  startReviewCycle(workstreams[0].id);
  updateItemDateField(it.id, 'dueDate', '2026-07-01');
  assertEqual(activeReviewCycle(workstreams[0].id).changeLog.length, 0);
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

test('cycleItemAttr logs an item-level change (no milestoneName) with tagChange for the old-icon/new-icon badges', function () {
  const it = addReviewItem({ name: 'Call Money', itStatus: 'green' });
  startReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus');
  const entry = activeReviewCycle(workstreams[0].id).changeLog[0];
  assertEqual(entry.itemName, 'Call Money');
  assertEqual(entry.milestoneName, null);
  assertEqual(entry.tagChange.field, 'itStatus');
  assertEqual(entry.tagChange.oldValue, 'green');
  assertEqual(entry.tagChange.newValue, 'amber');
  assertEqual(entry.change, 'IT changed to At Risk', 'kept as a plain-text fallback for the row\'s tooltip');
});

test('renderReview shows a tag change in history as old icon -> new icon, not plain text', function () {
  const it = addReviewItem({ name: 'Call Money', itStatus: 'green' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus');
  toggleReviewConfirm(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  toggleHistoryExpanded(cycle.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  const iconCount = (html.match(/fa-laptop-code/g) || []).length;
  assertEqual(iconCount, 2, 'the IT icon should render twice — old value, then new value');
  assertIncludes(html, 'var(--stat-green)', 'the old (green) value should still render');
  assertIncludes(html, 'var(--stat-amber)', 'colored by the new value');
  assertIncludes(html, 'review-change-arrow');
  assertIncludes(html, `<span class="review-change-label">Call Money</span>`, 'an item-level change has no milestone, so the label is just the item name, no dash');
  assertNotIncludes(html, 'IT changed to At Risk</span>', 'the plain-text form should only be in the title tooltip, not visible text');
});

test('renderReview shows a milestone date change in history as two disabled date fields, not text', function () {
  const it = addReviewItem({
    milestones: [{ id: genId(), name: 'Development completed', dueDate: '2026-06-01', status: 'not-started', actualDate: null }]
  });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  updateMilestoneDateField(it.id, it.milestones[0].id, 'actualDate', '2026-07-26');
  toggleConfirmAllMilestones(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  toggleHistoryExpanded(cycle.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `value="2026-06-01" disabled`, 'the former date should render as a disabled date field, not text');
  assertIncludes(html, `value="2026-07-26" disabled`, 'the new date should render as a disabled date field, not text');
  assertIncludes(html, 'review-change-arrow');
});

test('cycleMilestoneStatus logs a statusChange {oldValue, newValue}, rendered as old badge -> new badge', function () {
  const it = addReviewItem({
    name: 'Call Money',
    milestones: [{ id: genId(), name: 'Design defined', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  cycleMilestoneStatus(it.id, it.milestones[0].id);
  const entry = cycle.changeLog[0];
  assertEqual(entry.statusChange.oldValue, 'not-started');
  assertEqual(entry.statusChange.newValue, 'green');
  toggleConfirmAllMilestones(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  toggleHistoryExpanded(cycle.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'var(--stat-not-started)', 'the old status should render as a colored badge');
  assertIncludes(html, 'var(--stat-green)', 'the new status should render as a colored badge');
  assertIncludes(html, 'Not Started');
  assertIncludes(html, '>On Track<');
  assertIncludes(html, 'Call Money — Design defined');
});

test('history reorders changes to match the scope item\'s own milestone order, not the order they were logged in', function () {
  const mA = { id: genId(), name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null };
  const mB = { id: genId(), name: 'B', dueDate: todayStr(), status: 'not-started', actualDate: null };
  const mC = { id: genId(), name: 'C', dueDate: todayStr(), status: 'not-started', actualDate: null };
  const it = addReviewItem({ name: 'Call Money', milestones: [mA, mB, mC] });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  // Logged out of order: C, then A, then B.
  cycleMilestoneStatus(it.id, mC.id);
  cycleMilestoneStatus(it.id, mA.id);
  cycleMilestoneStatus(it.id, mB.id);
  assertDeepEqual(cycle.changeLog.map(e => e.milestoneName), ['C', 'A', 'B'], 'sanity check — logged in the order the calls were made');
  toggleConfirmAllMilestones(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  toggleHistoryExpanded(cycle.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  const idxA = html.indexOf('Call Money — A');
  const idxB = html.indexOf('Call Money — B');
  const idxC = html.indexOf('Call Money — C');
  assertTrue(idxA >= 0 && idxB >= 0 && idxC >= 0, 'all three change rows should render');
  assertTrue(idxA < idxB && idxB < idxC, 'displayed order should follow the item\'s own milestone array order (A, B, C), not log order (C, A, B)');
});

test('an item-level change (no milestone) sorts to the front of its item\'s group in history', function () {
  const m = { id: genId(), name: 'Only milestone', dueDate: todayStr(), status: 'not-started', actualDate: null };
  const it = addReviewItem({ name: 'Call Money', itStatus: 'green', milestones: [m] });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  // Logged milestone-first, then the item-level tag change.
  cycleMilestoneStatus(it.id, m.id);
  cycleItemAttr(it.id, 'itStatus');
  toggleConfirmAllMilestones(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  toggleHistoryExpanded(cycle.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  const idxTag = html.indexOf('fa-laptop-code');
  const idxMilestone = html.indexOf('Call Money — Only milestone');
  assertTrue(idxTag >= 0 && idxTag < idxMilestone, 'the item-level change should display before the milestone-level one, even though it was logged second');
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
    name: 'Call Money',
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
  assertNotIncludes(html, 'review-change-row', 'collapsed by default');
  assertIncludes(html, 'review-history-row');
  toggleHistoryExpanded(cycle.id);
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'review-change-row');
  assertIncludes(html, 'Call Money — Development completed', 'a milestone-level change should be labeled with its scope item name first');
  assertIncludes(html, 'Actual:');
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
  assertIncludes(html, 'review-confirm-toggle item-level', 'the icon-only confirm-all control');
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
  revealedActualIds.add(it.milestones[0].id); // reveal the empty Actual field's ghost placeholder
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
  assertIncludes(html, 'review-confirm-toggle item-level', 'the review-only confirm control should still be there');
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
