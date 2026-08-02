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
  addReviewItem({});
  assertTrue(isReviewOverdue(workstreams[0].id));
});

test('a workstream with no scope items yet is never overdue for review — there is nothing to review', function () {
  assertEqual(items.filter(it => it.workstreamId === workstreams[0].id).length, 0, 'sanity check — a fresh workstream starts with no items');
  assertFalse(isReviewOverdue(workstreams[0].id));
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

// All three of Review's sub-tabs have something sensible to show with no
// workstream selected — Scope Item Review shows reviewDatesOverviewHtml(),
// Action Log/Decision Log show their own "all workstreams" rollups — so
// entering Review mode (or clearing the workstream filter while already in
// it) never needs to bail out to Planning or hop reviewTab to a different
// sub-tab any more; whatever tab was showing just keeps showing.

test('setMode("review") stays on the Scope tab (its default) while "All Workstreams" is selected', function () {
  assertEqual(filterWorkstreamId, null);
  setMode('review');
  assertEqual(mode, 'review');
  assertEqual(reviewTab, 'scope', 'Scope Item Review now has the all-workstreams review-dates overview to show, so there is nothing left to hop away from');
});

test('setFilterWorkstream selects a workstream, which setMode("review") then shows on the Scope tab', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  assertEqual(mode, 'review');
});

test('picking "All Workstreams" while on Review\'s Scope tab stays right there, showing the review-dates overview', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  assertEqual(reviewTab, 'scope');
  setFilterWorkstream(null);
  assertEqual(mode, 'review');
  assertEqual(reviewTab, 'scope');
});

test('picking "All Workstreams" while already on Review\'s Action Log tab stays right there', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  setFilterWorkstream(null);
  assertEqual(mode, 'review');
  assertEqual(reviewTab, 'actionLog');
});

test('normalizeData leaves mode as "review" if reviewTab is "scope" with no workstream selected — the all-workstreams overview covers it', function () {
  mode = 'review';
  filterWorkstreamId = null;
  reviewTab = 'scope';
  normalizeData();
  assertEqual(mode, 'review');
});

test('normalizeData leaves mode as "review" if reviewTab is "actionLog", even with no workstream selected', function () {
  mode = 'review';
  filterWorkstreamId = null;
  reviewTab = 'actionLog';
  normalizeData();
  assertEqual(mode, 'review');
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

// ---------- Meeting minutes ----------

test('parseMeetingMinutes splits recognized section headers into their own buckets', function () {
  const text = `Summary\nWe discussed the migration timeline.\n\nAction Items\nAlice to update the runbook.\nBob to schedule the cutover.\n\nDecisions\nGo live on the 15th.\n\nNext Steps\nConfirm go-live date.`;
  const parsed = parseMeetingMinutes(text);
  assertEqual(parsed.summary, 'We discussed the migration timeline.');
  assertEqual(parsed.actionItems, 'Alice to update the runbook.\nBob to schedule the cutover.');
  assertEqual(parsed.decisions, 'Go live on the 15th.');
  assertEqual(parsed.nextSteps, 'Confirm go-live date.');
});

test('parseMeetingMinutes recognizes "Meeting Summary" as well as bare "Summary"', function () {
  const parsed = parseMeetingMinutes('Meeting Summary\nKickoff went well.');
  assertEqual(parsed.summary, 'Kickoff went well.');
});

// User-reported: their source minutes templates head the summary section
// "Meeting Summary" or "Executive Summary" — the latter wasn't recognized
// at all (only a bare "meeting" prefix was), so an "Executive Summary"
// document fell through to the same "no headers recognized" trap as the
// Attendees/Discussion Points case above.
test('parseMeetingMinutes recognizes "Executive Summary" as well', function () {
  const parsed = parseMeetingMinutes('Executive Summary\nKickoff went well.');
  assertEqual(parsed.summary, 'Kickoff went well.');
});

test('parseMeetingMinutes does not treat "Meeting Executive Summary" as a valid header — the two prefixes are alternatives, not stackable', function () {
  const parsed = parseMeetingMinutes('Meeting Executive Summary\nKickoff went well.\nDecisions\nApproved budget.');
  assertEqual(parsed.summary, '', 'not a real heading, so no header should match and this text is unlabeled lead-in — dropped, not folded into Summary');
  assertEqual(parsed.decisions, 'Approved budget.');
});

test('parseMeetingMinutes excludes an Open Points section entirely, rather than leaking it into whichever section precedes it', function () {
  const text = 'Action Items\nAlice to update the runbook.\nOpen Points\nStill need sign-off from Legal.\nAnother open point.\nDecisions\nGo live on the 15th.';
  const parsed = parseMeetingMinutes(text);
  assertEqual(parsed.actionItems, 'Alice to update the runbook.', 'Open Points content must not be appended to the section before it');
  assertEqual(parsed.decisions, 'Go live on the 15th.', 'parsing should resume normally once a real header follows Open Points');
  assertFalse(parsed.actionItems.includes('Legal'));
  assertFalse(parsed.decisions.includes('Legal'));
});

test('parseMeetingMinutes excludes inline content on the "Open Points:" header line itself', function () {
  const parsed = parseMeetingMinutes('Action Items\nAlice to update the runbook.\nOpen Points: none\nDecisions\nGo live on the 15th.');
  assertEqual(parsed.actionItems, 'Alice to update the runbook.');
  assertFalse(parsed.actionItems.includes('none'));
});

test('parseMeetingMinutes recognizes a header with inline content after a colon', function () {
  const parsed = parseMeetingMinutes('Summary: Kickoff went well.\nAction Items: Nothing yet.');
  assertEqual(parsed.summary, 'Kickoff went well.');
  assertEqual(parsed.actionItems, 'Nothing yet.');
});

test('parseMeetingMinutes ignores markdown bold/heading decoration around a header line', function () {
  const parsed = parseMeetingMinutes('## Summary\nAll good.\n**Decisions**\nShip it.');
  assertEqual(parsed.summary, 'All good.');
  assertEqual(parsed.decisions, 'Ship it.');
});

test('parseMeetingMinutes falls back to putting everything in Summary when no headers are recognized', function () {
  const parsed = parseMeetingMinutes('Just a plain note with no structure at all.');
  assertEqual(parsed.summary, 'Just a plain note with no structure at all.');
  assertEqual(parsed.actionItems, '');
  assertEqual(parsed.nextSteps, '');
  assertEqual(parsed.decisions, '');
});

// Regression test for a user-reported bug: text pasted from Word/Outlook
// (which use CRLF line endings) left a literal \r embedded at the end of
// every stored line except the last one — join(lines).trim() only trims
// the outer edges of the whole joined string, not each individual line, so
// an interior \r survived straight into the saved text.
test('parseMeetingMinutes normalizes CRLF line endings, leaving no stray \\r embedded in multi-line sections', function () {
  const parsed = parseMeetingMinutes('Summary:\r\nLine one.\r\nLine two.\r\n\r\nDecisions:\r\nA decision.\r\n');
  assertEqual(parsed.summary, 'Line one.\nLine two.');
  assertNotIncludes(parsed.summary, '\r');
  assertEqual(parsed.decisions, 'A decision.');
  assertNotIncludes(parsed.decisions, '\r');
});

test('parseMeetingMinutes drops unlabeled text before the first header rather than folding it into Summary', function () {
  const parsed = parseMeetingMinutes('Quick context up top.\nDecisions\nApproved budget.');
  assertEqual(parsed.summary, '', 'lead-in text with no Summary header of its own should not end up in Summary');
  assertEqual(parsed.decisions, 'Approved budget.');
});

test('parseMeetingMinutes still uses an explicit Summary header even when it isn\'t first', function () {
  const parsed = parseMeetingMinutes('Decisions\nApproved budget.\nSummary\nKickoff went well.');
  assertEqual(parsed.summary, 'Kickoff went well.');
  assertEqual(parsed.decisions, 'Approved budget.');
});

// Regression test: a narrative-style minutes doc with an "Attendees" list
// and a "Discussion Points" section, but no literal "Summary"/"Decisions"/
// "Action Items"/"Next Steps" header anywhere, used to match neither of
// those two words at all — so anyHeaderFound stayed false and the "no
// headers recognized" fallback kicked in, dumping the intro paragraph *and*
// the attendee list *and* every discussion bullet into Summary wholesale
// (user-reported: "meeting summary currently takes too much... other
// sections bleed into summary"). Attendees/Discussion Points are now
// recognized-but-excluded headers, same pattern as Open Points, so their
// content no longer bleeds anywhere — Summary correctly ends up empty for
// this kind of document instead (there being no actual Summary header to
// draw from), same as any other doc with real structure but no Summary
// section (see the "drops unlabeled text" test above).
test('parseMeetingMinutes excludes an Attendees list and a Discussion Points section, rather than dumping them into Summary', function () {
  const text = `This status meeting covered progress on the Nimbus Mobile App Redesign, focusing on the onboarding flow rebuild, a critical crash bug, marketing launch timing, and support readiness.
Meeting Attendees
• Priya Nair (Product Manager)
• Tom Reyes (Engineering Lead)
Discussion Points
• The onboarding flow rebuild is roughly 80% complete, but was blocked on complex animation transitions.
• A crash bug (ticket NIM-482) was identified as a null pointer issue.`;
  const parsed = parseMeetingMinutes(text);
  assertEqual(parsed.summary, '', 'no literal Summary header exists in this doc, so nothing should land there');
  assertFalse(parsed.summary.includes('Priya Nair'), 'the attendee list must not bleed into Summary');
  assertFalse(parsed.summary.includes('animation transitions'), 'Discussion Points content must not bleed into Summary');
  assertEqual(parsed.actionItems, '');
  assertEqual(parsed.decisions, '');
  assertEqual(parsed.nextSteps, '');
});

test('parseMeetingMinutes excludes inline content on the "Attendees:"/"Discussion Points:" header lines themselves, and resumes normally at the next real header', function () {
  const text = 'Attendees: Alice, Bob\nDiscussion Points: covered budget and timeline\nDecisions\nGo live on the 15th.';
  const parsed = parseMeetingMinutes(text);
  assertFalse(parsed.decisions.includes('Alice'));
  assertFalse(parsed.decisions.includes('budget'));
  assertEqual(parsed.decisions, 'Go live on the 15th.', 'parsing should resume normally once a real header follows');
});

test('parseMeetingMinutes still recognizes an explicit Summary header even alongside Attendees/Discussion Points', function () {
  const text = 'Summary\nKickoff went well.\nAttendees\nAlice, Bob\nDiscussion Points\nTimeline looks tight.';
  const parsed = parseMeetingMinutes(text);
  assertEqual(parsed.summary, 'Kickoff went well.');
});

test('linesToActionItems turns each non-blank line into its own row with Owner/Due Date left blank', function () {
  const rows = linesToActionItems('Alice to update the runbook.\n\nBob to schedule the cutover.');
  assertEqual(rows.length, 2);
  assertEqual(rows[0].text, 'Alice to update the runbook.');
  assertEqual(rows[0].owner, '');
  assertEqual(rows[0].dueDate, null);
  assertEqual(rows[1].text, 'Bob to schedule the cutover.');
});

// ---------- Pasting an actual table (Excel/Word/Outlook clipboard, or markdown) ----------

test('linesToActionItems splits a tab-separated table into text/owner/dueDate, skipping the header row', function () {
  const table = [
    'Action Item\tOwner\tDue Date',
    'Send simplified transition specs to Tom\tSofia Bergman\tJul 22',
    'Pause external launch communications until the date is confirmed\tMarcus Webb\t',
    'Send a test device budget request to Priya\tDaniel Achebe\tJul 24'
  ].join('\n');
  const rows = linesToActionItems(table);
  assertEqual(rows.length, 3, 'the header row should be recognized and skipped, not turned into a 4th row');
  assertEqual(rows[0].text, 'Send simplified transition specs to Tom');
  assertEqual(rows[0].owner, 'S. Bergman', 'a full name from an imported table should be shortened to "first initial. last name"');
  assertTrue(!!rows[0].dueDate, 'a bare "Jul 22" due date should resolve to a real ISO date, not stay null');
  assertEqual(rows[1].owner, 'M. Webb');
  assertEqual(rows[1].dueDate, null, 'a row whose due-date column was empty in the source table should stay unset, not error');
});

test('linesToActionItems also splits a markdown-style pipe table', function () {
  const table = '| Update the runbook | Alice | 2026-08-01 |\n| Schedule the cutover | Bob | |';
  const rows = linesToActionItems(table);
  assertEqual(rows.length, 2);
  assertEqual(rows[0].text, 'Update the runbook');
  assertEqual(rows[0].owner, 'Alice', 'a single-word name has nothing to shorten and passes through unchanged');
  assertEqual(rows[0].dueDate, '2026-08-01');
  assertEqual(rows[1].owner, 'Bob');
  assertEqual(rows[1].dueDate, null);
});

test('parseMinutesPaste extracts owner and due date from a pasted table under the Action Items header', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesPasteInput').value = [
    'Action Items',
    'Action Item\tOwner\tDue Date',
    'Send simplified transition specs to Tom\tSofia Bergman\tJul 22',
    'Pause external launch communications until the date is confirmed\tMarcus Webb\t'
  ].join('\n');
  parseMinutesPaste();
  assertEqual(editingMinutesActionItems.length, 2, 'the table header row must not survive into the working rows either');
  assertEqual(editingMinutesActionItems[0].owner, 'S. Bergman');
  assertTrue(!!editingMinutesActionItems[0].dueDate);
  assertEqual(editingMinutesActionItems[1].owner, 'M. Webb');
  assertEqual(editingMinutesActionItems[1].dueDate, null);
});

// Regression test for a user-reported bug: clicking Auto-fill with nothing
// pasted yet silently did nothing at all — no toast, no visible change,
// indistinguishable from the button being broken. Every other no-op guard
// in this modal already showed one; this was the one that didn't.
test('parseMinutesPaste shows a toast instead of silently doing nothing when the paste box is empty', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesPasteInput').value = '   ';
  parseMinutesPaste();
  assertIncludes(document.getElementById('toastMsg').textContent, 'Paste some meeting notes');
});

// Same bug, same fix, for the drag-and-drop path — dropping something that
// isn't a real file (e.g. dragged text or a link, not an actual file) used
// to leave no trace the drop was even noticed.
test('handleMinutesFileDrop shows a toast instead of silently doing nothing when the drop has no file', async function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  await handleMinutesFileDrop({ preventDefault: () => {}, dataTransfer: { files: [] } });
  assertIncludes(document.getElementById('toastMsg').textContent, "didn't contain a file");
});

// ---------- Owner name shortening ("Peer Rexroth" -> "P. Rexroth") ----------

test('shortenOwnerName shortens a two-word name to "first initial. last name"', function () {
  assertEqual(shortenOwnerName('Peer Rexroth'), 'P. Rexroth');
});

test('shortenOwnerName keeps every word after the first for a multi-word name', function () {
  assertEqual(shortenOwnerName('Mary Jane Watson'), 'M. Jane Watson');
});

test('shortenOwnerName leaves a single-word name unchanged — nothing to shorten', function () {
  assertEqual(shortenOwnerName('Alice'), 'Alice');
});

test('shortenOwnerName leaves blank/empty input unchanged', function () {
  assertEqual(shortenOwnerName(''), '');
  assertEqual(shortenOwnerName(undefined), '');
});

test('shortenOwnerName does not re-shorten a name that already looks shortened', function () {
  assertEqual(shortenOwnerName('P. Rexroth'), 'P. Rexroth');
  assertEqual(shortenOwnerName('P Rexroth'), 'P Rexroth');
});

test('shortenOwnerName is only applied on import (linesToActionItems), not to a name typed directly into the modal', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Do the thing';
  editingMinutesActionItems[0].owner = 'Peer Rexroth';
  saveMinutes();
  assertEqual(cycle.minutes.actionItems[0].owner, 'Peer Rexroth', 'manually typed/edited owners in the modal are stored verbatim, not shortened');
});

// ---------- Flexible due-date parsing ----------

test('parseFlexibleDate passes an already-ISO date straight through', function () {
  assertEqual(parseFlexibleDate('2026-07-22'), '2026-07-22');
});

test('parseFlexibleDate resolves today\'s own "Mon D" (no year) back to today\'s date', function () {
  const today = new Date(todayStr() + 'T00:00:00');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  assertEqual(parseFlexibleDate(`${monthNames[today.getMonth()]} ${today.getDate()}`), todayStr());
});

test('parseFlexibleDate rolls a yearless date more than ~30 days in the past forward to next year', function () {
  const today = new Date(todayStr() + 'T00:00:00');
  const past = new Date(today);
  past.setDate(past.getDate() - 40);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${monthNames[past.getMonth()]} ${past.getDate()}`;
  const expectedYear = today.getFullYear() + 1;
  const expected = `${expectedYear}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
  assertEqual(parseFlexibleDate(label), expected);
});

test('parseFlexibleDate accepts M/D/YYYY and M/D with an inferred year', function () {
  assertEqual(parseFlexibleDate('7/22/2026'), '2026-07-22');
  const today = new Date(todayStr() + 'T00:00:00');
  const label = `${today.getMonth() + 1}/${today.getDate()}`;
  assertEqual(parseFlexibleDate(label), todayStr());
});

test('parseFlexibleDate returns null for blank or unrecognized text, rather than a garbage date', function () {
  assertEqual(parseFlexibleDate(''), null);
  assertEqual(parseFlexibleDate('   '), null);
  assertEqual(parseFlexibleDate('TBD'), null);
  assertEqual(parseFlexibleDate('Someday'), null);
});

// ---------- docxParagraphText / list numbering (re-adds markers Word doesn't store as text) ----------
// docxParagraphText() only ever calls p.getElementsByTagName(...) (and, on
// whatever that returns, .getAttribute()/.textContent) — a plain object
// literal graph is enough to stand in for real DOM elements, without
// needing an actual DOMParser (unavailable in this harness — see the
// "Testing caveat" in CLAUDE.md for why the rest of the .docx extraction
// pipeline can't be exercised this way).
function fakeAttrEl(val) { return { getAttribute: () => val }; }
function fakeDocxParagraph(texts, numPrInfo) {
  const numPrEl = numPrInfo ? {
    getElementsByTagName(tag) {
      if (tag === 'w:numId') return [fakeAttrEl(numPrInfo.numId)];
      if (tag === 'w:ilvl') return numPrInfo.ilvl != null ? [fakeAttrEl(numPrInfo.ilvl)] : [];
      return [];
    }
  } : null;
  return {
    getElementsByTagName(tag) {
      if (tag === 'w:t') return texts.map(t => ({ textContent: t }));
      if (tag === 'w:numPr') return numPrEl ? [numPrEl] : [];
      return [];
    }
  };
}

test('docxParagraphText falls back to a flat bullet for a list paragraph when numbering info isn\'t available', function () {
  assertEqual(docxParagraphText(fakeDocxParagraph(['Discuss timeline'], { numId: '1', ilvl: '0' })), '• Discuss timeline');
});

test('docxParagraphText leaves an ordinary paragraph (no <w:numPr>) alone', function () {
  assertEqual(docxParagraphText(fakeDocxParagraph(['Discuss timeline'], null)), 'Discuss timeline');
});

test('docxParagraphText joins multiple runs within one paragraph before adding the marker', function () {
  assertEqual(docxParagraphText(fakeDocxParagraph(['Alice ', 'to update ', 'the runbook'], { numId: '1', ilvl: '0' })), '• Alice to update the runbook');
});

test('docxParagraphText renders a real bullet-format list using the numbering map, not the raw lvlText character', function () {
  const numbering = { numToAbstract: { '1': 'a' }, abstractFormats: { a: { '0': { numFmt: 'bullet', lvlText: '' } } } };
  const getNextCount = makeListCounterTracker();
  assertEqual(docxParagraphText(fakeDocxParagraph(['First'], { numId: '1', ilvl: '0' }), numbering, getNextCount), '• First');
});

test('docxParagraphText renders a decimal-format list with real incrementing numbers', function () {
  const numbering = { numToAbstract: { '1': 'a' }, abstractFormats: { a: { '0': { numFmt: 'decimal', lvlText: '%1.' } } } };
  const getNextCount = makeListCounterTracker();
  assertEqual(docxParagraphText(fakeDocxParagraph(['First'], { numId: '1', ilvl: '0' }), numbering, getNextCount), '1. First');
  assertEqual(docxParagraphText(fakeDocxParagraph(['Second'], { numId: '1', ilvl: '0' }), numbering, getNextCount), '2. Second');
});

test('docxParagraphText renders lowerLetter/upperRoman formats correctly', function () {
  const numbering = {
    numToAbstract: { '1': 'a' },
    abstractFormats: { a: { '0': { numFmt: 'lowerLetter', lvlText: '%1)' }, '1': { numFmt: 'upperRoman', lvlText: '%1.' } } }
  };
  const getNextCount = makeListCounterTracker();
  assertEqual(docxParagraphText(fakeDocxParagraph(['One'], { numId: '1', ilvl: '0' }), numbering, getNextCount), 'a) One');
  assertEqual(docxParagraphText(fakeDocxParagraph(['Two'], { numId: '1', ilvl: '0' }), numbering, getNextCount), 'b) Two');
  assertEqual(docxParagraphText(fakeDocxParagraph(['Sub'], { numId: '1', ilvl: '1' }), numbering, getNextCount), 'I. Sub');
});

test('makeListCounterTracker resets a deeper level\'s counter once a shallower item appears again', function () {
  const getNextCount = makeListCounterTracker();
  assertEqual(getNextCount('1', '0'), 1);
  assertEqual(getNextCount('1', '1'), 1);
  assertEqual(getNextCount('1', '1'), 2);
  assertEqual(getNextCount('1', '0'), 2, 'a second top-level item continues its own counter');
  assertEqual(getNextCount('1', '1'), 1, 'the sub-level counter should have reset when the top-level item reappeared');
});

test('makeListCounterTracker tracks separate lists (different numId) independently', function () {
  const getNextCount = makeListCounterTracker();
  assertEqual(getNextCount('1', '0'), 1);
  assertEqual(getNextCount('2', '0'), 1);
  assertEqual(getNextCount('1', '0'), 2);
});

test('formatListCounter renders decimal, letter, and roman-numeral formats', function () {
  assertEqual(formatListCounter('decimal', 3), '3');
  assertEqual(formatListCounter('lowerLetter', 1), 'a');
  assertEqual(formatListCounter('lowerLetter', 27), 'aa');
  assertEqual(formatListCounter('upperLetter', 2), 'B');
  assertEqual(formatListCounter('lowerRoman', 9), 'ix');
  assertEqual(formatListCounter('upperRoman', 4), 'IV');
});

test('docxListMarker always renders "•" for a bullet format, ignoring the literal lvlText character', function () {
  assertEqual(docxListMarker('bullet', '', 5), '•');
});

test('docxListMarker substitutes the formatted counter into the lvlText template', function () {
  assertEqual(docxListMarker('decimal', '(%1)', 3), '(3)');
  assertEqual(docxListMarker('decimal', null, 3), '3.', 'a missing lvlText should fall back to a plain "N." template');
});

test('parseMinutesPaste fills the Action Items table (not a single textarea) from the pasted text', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesPasteInput').value = 'Summary\nAll good.\nAction Items\nAlice to update the runbook.\nBob to schedule the cutover.';
  parseMinutesPaste();
  assertEqual(document.getElementById('minutesSummaryInput').value, 'All good.');
  assertEqual(editingMinutesActionItems.length, 2);
  assertEqual(editingMinutesActionItems[0].text, 'Alice to update the runbook.');
  assertEqual(editingMinutesActionItems[1].text, 'Bob to schedule the cutover.');
});

function addCompletedReviewCycle() {
  const it = addReviewItem({});
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleReviewConfirm(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  return reviewCycles[0];
}

test('openMinutesModal pre-fills the fields (including the Action Items table) from existing minutes, or blank for a cycle with none yet', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  assertEqual(document.getElementById('minutesSummaryInput').value, '');
  assertEqual(editingMinutesActionItems.length, 0);
  assertEqual(document.getElementById('minutesRemoveBtn').style.display, 'none');

  cycle.minutes = { summary: 'S', actionItems: [{ id: 'a1', text: 'Update runbook', owner: 'Alice', dueDate: '2026-08-01' }], decisions: 'D', nextSteps: 'N', importedAt: Date.now() };
  openMinutesModal(cycle.id);
  assertEqual(document.getElementById('minutesSummaryInput').value, 'S');
  assertEqual(editingMinutesActionItems.length, 1);
  assertEqual(editingMinutesActionItems[0].text, 'Update runbook');
  assertEqual(editingMinutesActionItems[0].owner, 'Alice');
  assertEqual(document.getElementById('minutesRemoveBtn').style.display, 'inline-flex');
});

// ---------- Drop-zone "processed" status badge ----------
// The dropped/parsed raw text is deliberately never shown in the paste box
// (see handleMinutesFileDrop()'s own comment) — instead the box is left
// blank and a small checkmark badge (setMinutesDropzoneStatus()) shows the
// filename. These tests exercise that badge directly, plus the full
// file-drop flow with a fake File-like object (no real browser File API in
// this harness).

test('setMinutesDropzoneStatus(name) shows the badge with that filename; setMinutesDropzoneStatus(null) hides it', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  setMinutesDropzoneStatus('notes.txt');
  assertEqual(document.getElementById('minutesDropzoneStatus').style.display, 'flex');
  assertIncludes(document.getElementById('minutesDropzoneStatusText').textContent, 'notes.txt');
  setMinutesDropzoneStatus(null);
  assertEqual(document.getElementById('minutesDropzoneStatus').style.display, 'none');
});

test('openMinutesModal and clearMinutesFields both hide any leftover "processed" badge from a previous drop', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  setMinutesDropzoneStatus('notes.txt');
  clearMinutesFields();
  assertEqual(document.getElementById('minutesDropzoneStatus').style.display, 'none');

  setMinutesDropzoneStatus('notes.txt');
  openMinutesModal(cycle.id);
  assertEqual(document.getElementById('minutesDropzoneStatus').style.display, 'none');
});

test('handleMinutesFileDrop parses the dropped file into the fields, clears the paste box, and shows the processed badge instead of dumping raw text into it', async function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  const fakeFile = { name: 'notes.txt', text: async () => 'Summary\nAll good.\nAction Items\nAlice to update the runbook.' };
  const fakeEvent = { preventDefault: () => {}, dataTransfer: { files: [fakeFile] } };
  await handleMinutesFileDrop(fakeEvent);
  assertEqual(document.getElementById('minutesSummaryInput').value, 'All good.');
  assertEqual(editingMinutesActionItems.length, 1);
  assertEqual(document.getElementById('minutesPasteInput').value, '', 'the raw dropped text must never land in the paste box');
  assertEqual(document.getElementById('minutesDropzoneStatus').style.display, 'flex');
  assertIncludes(document.getElementById('minutesDropzoneStatusText').textContent, 'notes.txt');
});

test('addMinutesActionItemRow/removeMinutesActionItemRow add and remove rows from the working table', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  addMinutesActionItemRow();
  assertEqual(editingMinutesActionItems.length, 2);
  removeMinutesActionItemRow(0);
  assertEqual(editingMinutesActionItems.length, 1);
});

test('clearMinutesFields blanks the whole working form without touching anything already saved', function () {
  const cycle = addCompletedReviewCycle();
  cycle.minutes = { summary: 'Saved summary', actionItems: [{ id: 'a1', text: 'Saved item', owner: 'Alice', dueDate: null }], decisions: 'Saved decision', nextSteps: 'Saved next step', importedAt: 1 };
  openMinutesModal(cycle.id);
  document.getElementById('minutesPasteInput').value = 'some pasted text';
  clearMinutesFields();
  assertEqual(document.getElementById('minutesPasteInput').value, '');
  assertEqual(document.getElementById('minutesSummaryInput').value, '');
  assertEqual(document.getElementById('minutesDecisionsInput').value, '');
  assertEqual(document.getElementById('minutesNextStepsInput').value, '');
  assertEqual(editingMinutesActionItems.length, 0);
  // The already-saved minutes on the cycle itself must be untouched — only
  // the open modal's working form was cleared, and nothing was saved yet.
  assertEqual(cycle.minutes.summary, 'Saved summary');
  assertEqual(cycle.minutes.actionItems.length, 1);
});

test('the Action Item cell renders as a <textarea>, not a single-line <input>, so a multi-line description isn\'t clipped', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  const html = document.getElementById('minutesActionItemsRows').innerHTML;
  assertIncludes(html, '<textarea');
  assertEqual((html.match(/type="text"/g) || []).length, 1, 'only Owner should be a plain single-line input — Action Item is the textarea');
});

test('a multi-line action item description round-trips through save intact', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Line one\nLine two';
  saveMinutes();
  assertEqual(cycle.minutes.actionItems[0].text, 'Line one\nLine two');
});

test('saveMinutes stores Summary/Decisions/Next Steps plus a structured Action Items table, and stamps importedAt once', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesSummaryInput').value = 'Discussed timeline';
  document.getElementById('minutesDecisionsInput').value = 'Go live 15th';
  document.getElementById('minutesNextStepsInput').value = 'Confirm date';
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  editingMinutesActionItems[0].owner = 'Alice';
  editingMinutesActionItems[0].dueDate = '2026-08-01';
  saveMinutes();
  assertEqual(cycle.minutes.summary, 'Discussed timeline');
  assertEqual(cycle.minutes.decisions, 'Go live 15th');
  assertEqual(cycle.minutes.nextSteps, 'Confirm date');
  assertEqual(cycle.minutes.actionItems.length, 1);
  assertEqual(cycle.minutes.actionItems[0].text, 'Update runbook');
  assertEqual(cycle.minutes.actionItems[0].owner, 'Alice');
  assertEqual(cycle.minutes.actionItems[0].dueDate, '2026-08-01');
  assertTrue(typeof cycle.minutes.importedAt === 'number');
  const firstImportedAt = cycle.minutes.importedAt;

  openMinutesModal(cycle.id);
  document.getElementById('minutesSummaryInput').value = 'Updated summary';
  saveMinutes();
  assertEqual(cycle.minutes.summary, 'Updated summary');
  assertEqual(cycle.minutes.importedAt, firstImportedAt, 'importedAt should be set once, on first save, not bumped on every edit');
});

test('saveMinutes drops a blank action-item row (no text, owner, or due date)', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesSummaryInput').value = 'Something';
  addMinutesActionItemRow(); // left entirely blank
  saveMinutes();
  assertEqual(cycle.minutes.actionItems.length, 0);
});

test('saveMinutes refuses to save when every field (including the action items table) is blank', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  saveMinutes();
  assertEqual(cycle.minutes, null);
});

test('removeMinutes clears a cycle\'s minutes after confirmation', function () {
  const cycle = addCompletedReviewCycle();
  cycle.minutes = { summary: 'S', actionItems: [], decisions: '', nextSteps: '', importedAt: Date.now() };
  openMinutesModal(cycle.id);
  removeMinutes();
  confirmModalAction();
  assertEqual(cycle.minutes, null);
});

test('removeMinutes also deletes that cycle\'s action items from the workstream actionLog, so none linger orphaned', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  assertEqual(workstreams[0].actionLog.length, 1, 'sanity check — saving minutes should have synced one action log entry');

  openMinutesModal(cycle.id);
  removeMinutes();
  confirmModalAction();
  assertEqual(workstreams[0].actionLog.length, 0);
});

test('removeMinutes only deletes action items from its own cycle, leaving other cycles\' entries on the same workstream alone', function () {
  const cycle1 = addCompletedReviewCycle();
  openMinutesModal(cycle1.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'From cycle 1';
  saveMinutes();

  startReviewCycle(workstreams[0].id);
  const cycle2 = activeReviewCycle(workstreams[0].id);
  completeReviewCycle(cycle2.id);
  openMinutesModal(cycle2.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'From cycle 2';
  saveMinutes();
  assertEqual(workstreams[0].actionLog.length, 2);

  openMinutesModal(cycle1.id);
  removeMinutes();
  confirmModalAction();
  assertEqual(workstreams[0].actionLog.length, 1);
  assertEqual(workstreams[0].actionLog[0].text, 'From cycle 2');
});

test('reviewHistoryRowHtml shows an outline "Add meeting minutes" icon when none exist, and a filled "View" icon once they do', function () {
  const cycle = addCompletedReviewCycle();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  renderReview();
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Add meeting minutes');
  assertIncludes(html, 'fa-regular fa-file-lines');

  cycle.minutes = { summary: 'S', actionItems: [], decisions: '', nextSteps: '', importedAt: Date.now() };
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'View meeting minutes');
  assertIncludes(html, 'fa-solid fa-file-lines');
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

// ---------- Not Applicable milestones are excluded from review confirmation ----------

test('isItemConfirmedInCycle ignores notApplicable milestones — confirming just the applicable ones is enough', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  it.milestones[1].notApplicable = true;
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertFalse(isItemConfirmedInCycle(cycle, it));
  toggleMilestoneConfirm(cycle.id, it.milestones[0].id);
  assertTrue(isItemConfirmedInCycle(cycle, it), 'the notApplicable milestone must not block confirmation');
});

test('isItemConfirmedInCycle reads an item as already confirmed when every one of its milestones is notApplicable', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  it.milestones.forEach(m => { m.notApplicable = true; });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertTrue(isItemConfirmedInCycle(cycle, it), 'nothing left to confirm — vacuously confirmed');
});

test('toggleConfirmAllMilestones only confirms the applicable milestones, leaving notApplicable ones with no confirmation entry at all', function () {
  const it = addReviewItemWithMilestones(['A', 'B', 'C']);
  it.milestones[2].notApplicable = true;
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleConfirmAllMilestones(cycle.id, it.id);
  assertEqual(reviewCycles[0].milestoneConfirmations.length, 2, 'only the two applicable milestones should get an entry');
  assertFalse(isMilestoneConfirmedInCycle(cycle, it.milestones[2]));
  assertTrue(isItemConfirmedInCycle(cycle, it));
});

test('toggleConfirmAllMilestones is a no-op when every milestone on the item is notApplicable', function () {
  const it = addReviewItemWithMilestones(['A']);
  it.milestones[0].notApplicable = true;
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleConfirmAllMilestones(cycle.id, it.id);
  assertEqual(reviewCycles[0].milestoneConfirmations.length, 0, 'nothing to confirm — already vacuously confirmed');
});

// ---------- A Complete milestone/item auto-confirms — no manual review
// needed (an explicit user request: "mark completed task as reviewed, no
// need to review them again") ----------

test('isMilestoneConfirmedInCycle reads a Complete milestone as confirmed with no stored confirmation entry at all', function () {
  const it = addReviewItemWithMilestones(['A']);
  it.milestones[0].status = 'complete';
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertTrue(isMilestoneConfirmedInCycle(cycle, it.milestones[0]), 'Complete must count as confirmed without ever being clicked');
  assertEqual(cycle.milestoneConfirmations.length, 0, 'no entry should have been written just from checking');
});

test('isItemConfirmedInCycle reads an item as confirmed once every one of its milestones is Complete, with no manual confirms', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  it.milestones.forEach(m => { m.status = 'complete'; });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertTrue(isItemConfirmedInCycle(cycle, it));
});

test('a mix of Complete and still-open milestones only needs the open ones confirmed manually', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  it.milestones[0].status = 'complete';
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertFalse(isItemConfirmedInCycle(cycle, it), 'the still-open milestone B must still block confirmation');
  toggleMilestoneConfirm(cycle.id, it.milestones[1].id);
  assertTrue(isItemConfirmedInCycle(cycle, it), 'A is auto-confirmed via Complete, B was just confirmed manually');
});

test('a zero-milestone item that is Complete auto-confirms too, with no cycle.confirmations entry needed', function () {
  const it = addReviewItem({ status: 'complete' });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertTrue(isItemConfirmedInCycle(cycle, it));
  assertEqual(cycle.confirmations.length, 0);
});

test('toggleConfirmAllMilestones never writes a redundant confirmation entry for an already-Complete milestone', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  it.milestones[0].status = 'complete';
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  toggleConfirmAllMilestones(cycle.id, it.id);
  assertEqual(reviewCycles[0].milestoneConfirmations.length, 1, 'only B (still open) should get a real entry — A is already auto-confirmed');
  assertEqual(reviewCycles[0].milestoneConfirmations[0].milestoneId, it.milestones[1].id);
});

test('canCompleteReviewCycle passes for a workstream whose every item/milestone is already Complete, with nothing manually confirmed', function () {
  const it = addReviewItemWithMilestones(['A', 'B']);
  it.milestones.forEach(m => { m.status = 'complete'; });
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertTrue(canCompleteReviewCycle(cycle));
});

test('milestoneRowsHtml shows an inert, already-checked indicator (not a clickable toggle) for a Complete milestone during a review', function () {
  const it = addReviewItemWithMilestones(['A']);
  it.milestones[0].status = 'complete';
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  const html = milestoneRowsHtml(it, cycle);
  assertNotIncludes(html, `onclick="toggleMilestoneConfirm('${cycle.id}','${it.milestones[0].id}')"`, 'no clickable toggle for a milestone that auto-confirms');
  assertIncludes(html, 'review-confirm-toggle confirmed');
  assertIncludes(html, 'fa-circle-check');
});

test('itemRowHtml shows an inert, already-checked indicator for a Complete zero-milestone item during a review', function () {
  const it = addReviewItem({ status: 'complete' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  const html = itemRowHtml(it, cycle);
  assertNotIncludes(html, `onclick="toggleReviewConfirm('${cycle.id}','${it.id}')"`, 'no clickable toggle for an item that auto-confirms');
  assertIncludes(html, 'review-confirm-toggle item-level confirmed');
});

test('milestoneRowsHtml shows an inert placeholder, not a real confirm toggle, for a notApplicable milestone during a review', function () {
  const it = addReviewItemWithMilestones(['A']);
  it.milestones[0].notApplicable = true;
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  toggleItemExpanded(it.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, `toggleMilestoneConfirm`, 'a notApplicable milestone must not offer a real confirm toggle');
  assertIncludes(html, 'excluded from this review');
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

// ---------- Action Log (Review's second tab) ----------

test('saveMinutes syncs saved action items into the workstream\'s own actionLog, unstarted', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  editingMinutesActionItems[0].owner = 'Alice';
  editingMinutesActionItems[0].dueDate = '2026-08-01';
  saveMinutes();
  const log = workstreams[0].actionLog;
  assertEqual(log.length, 1);
  assertEqual(log[0].text, 'Update runbook');
  assertEqual(log[0].owner, 'Alice');
  assertEqual(log[0].dueDate, '2026-08-01');
  assertEqual(log[0].completed, false);
  assertEqual(log[0].cycleId, cycle.id);
});

test('re-saving minutes updates a matching actionLog entry\'s text/owner/due date in place without resetting completed', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  const entryId = workstreams[0].actionLog[0].id;
  toggleActionLogItem(workstreams[0].id, entryId);
  assertEqual(workstreams[0].actionLog[0].completed, true);

  openMinutesModal(cycle.id);
  editingMinutesActionItems[0].text = 'Update runbook v2';
  saveMinutes();
  assertEqual(workstreams[0].actionLog.length, 1, 'the same action item id should update the existing log row, not add a second one');
  assertEqual(workstreams[0].actionLog[0].text, 'Update runbook v2');
  assertEqual(workstreams[0].actionLog[0].completed, true, 'completing a log entry must survive re-saving the minutes it came from');
});

test('saving a second review cycle\'s minutes appends to the same workstream actionLog rather than replacing it', function () {
  const cycle1 = addCompletedReviewCycle();
  openMinutesModal(cycle1.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'From cycle 1';
  saveMinutes();

  startReviewCycle(workstreams[0].id);
  const cycle2 = activeReviewCycle(workstreams[0].id);
  completeReviewCycle(cycle2.id);
  openMinutesModal(cycle2.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'From cycle 2';
  saveMinutes();

  assertEqual(workstreams[0].actionLog.length, 2);
  assertEqual(workstreams[0].actionLog.map(a => a.text).sort().join(','), 'From cycle 1,From cycle 2');
});

test('toggleActionLogItem flips completed and stamps/clears completedAt', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Do the thing';
  saveMinutes();
  const id = workstreams[0].actionLog[0].id;

  toggleActionLogItem(workstreams[0].id, id);
  assertEqual(workstreams[0].actionLog[0].completed, true);
  assertTrue(typeof workstreams[0].actionLog[0].completedAt === 'number');

  toggleActionLogItem(workstreams[0].id, id);
  assertEqual(workstreams[0].actionLog[0].completed, false);
  assertEqual(workstreams[0].actionLog[0].completedAt, null);
});

// ---------- The priority flag (Action Log + Decision Log) ----------
// An explicit user request ("for action and decision items add a priority
// flag (shown as a small flag in list view)") — a plain on/off toggle,
// independent of completed/completedAt (an item can be flagged and still
// open, flagged and already done, or neither), same Reviewer+ gating as
// every other Action/Decision Log mutation.

test('toggleActionLogFlag flips flagged, independent of completed', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Do the thing';
  saveMinutes();
  const id = workstreams[0].actionLog[0].id;
  assertEqual(workstreams[0].actionLog[0].flagged, false, 'a freshly-synced action item starts unflagged');

  toggleActionLogFlag(workstreams[0].id, id);
  assertEqual(workstreams[0].actionLog[0].flagged, true);
  assertEqual(workstreams[0].actionLog[0].completed, false, 'flagging must not touch completed');

  toggleActionLogItem(workstreams[0].id, id);
  assertEqual(workstreams[0].actionLog[0].flagged, true, 'completing must not touch flagged');

  toggleActionLogFlag(workstreams[0].id, id);
  assertEqual(workstreams[0].actionLog[0].flagged, false);
});

test('toggleActionLogFlag is blocked below Reviewer', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Do the thing';
  saveMinutes();
  const id = workstreams[0].actionLog[0].id;
  userRole = 'visitor';
  toggleActionLogFlag(workstreams[0].id, id);
  assertEqual(workstreams[0].actionLog[0].flagged, false);
});

test('actionLogRowHtml renders the priority flag as a clickable button at Reviewer+, an inert span below it', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Do the thing';
  saveMinutes();
  const w = workstreams[0];
  const id = w.actionLog[0].id;
  setFilterWorkstream(w.id);
  setMode('review');
  setReviewTab('actionLog');
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onclick="toggleActionLogFlag('${w.id}','${id}')"`);
  assertIncludes(html, 'fa-regular fa-flag', 'unflagged renders the outline icon');

  toggleActionLogFlag(w.id, id);
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'fa-solid fa-flag', 'flagged renders the filled icon');
  assertIncludes(html, 'priority-flag-btn flagged');

  userRole = 'visitor';
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, `onclick="toggleActionLogFlag('${w.id}','${id}')"`, 'not clickable below Reviewer');
  assertIncludes(html, 'fa-solid fa-flag', 'still shows the real flagged state below Reviewer');
});

// A user-reported alignment bug: the header's flag icon (a plain <span>,
// no button, no padding) didn't line up with either row state's own icon —
// the clickable Reviewer+ button gets its padding from .row-icon-btn, the
// read-only row span had none at all, and the header span matched neither.
// .priority-flag-btn now declares that same padding directly (see its own
// CSS comment), and every one of the three renders — header span, clickable
// row button, read-only row span — carries the class, so all three share
// one box model.
test('the priority flag header cell shares .priority-flag-btn with both row states, so their icons align', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Do the thing';
  saveMinutes();
  const w = workstreams[0];
  setFilterWorkstream(w.id);
  setMode('review');
  setReviewTab('actionLog');
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'class="priority-flag-btn" style="grid-column:1" title="Priority flag"', 'the header cell itself carries priority-flag-btn');
  assertIncludes(html, 'row-icon-btn priority-flag-btn', 'the clickable row button also carries it (via row-icon-btn)');

  userRole = 'visitor';
  renderReview();
  html = document.getElementById('main').innerHTML;
  // below Reviewer the row renders a plain <span class="priority-flag-btn">
  // (no row-icon-btn) — still the same class the header itself carries
  assertIncludes(html, '<span class="priority-flag-btn ');
});

test('deleteActionLogItem removes the entry only after confirmation', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Do the thing';
  saveMinutes();
  const id = workstreams[0].actionLog[0].id;

  deleteActionLogItem(workstreams[0].id, id);
  assertEqual(workstreams[0].actionLog.length, 1, 'opening the confirm modal must not delete anything by itself');
  confirmModalAction();
  assertEqual(workstreams[0].actionLog.length, 0);
});

// Undoable via the same toast-with-undo pattern deleteItem() already uses —
// an explicit later user request ("build an undo... for delete operations").

test('deleteActionLogItem is undoable, restoring the entry at its original position', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'First';
  addMinutesActionItemRow();
  editingMinutesActionItems[1].text = 'Second';
  saveMinutes();
  const id = workstreams[0].actionLog[0].id;

  deleteActionLogItem(workstreams[0].id, id);
  confirmModalAction();
  assertEqual(workstreams[0].actionLog.length, 1);
  assertTrue(!!toastUndoAction, 'an undo action should be armed after deleting');
  triggerToastUndo();
  assertEqual(workstreams[0].actionLog.length, 2);
  assertEqual(workstreams[0].actionLog[0].id, id, 'restored at its original index');
});

test('deleteActionLogItem does not touch the source cycle\'s own saved minutes', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Do the thing';
  saveMinutes();
  const id = workstreams[0].actionLog[0].id;

  deleteActionLogItem(workstreams[0].id, id);
  confirmModalAction();
  assertEqual(cycle.minutes.actionItems.length, 1, 'deleting from the log is separate from the cycle\'s own minutes.actionItems');
});

test('actionLogRowHtml renders a Delete button wired to deleteActionLogItem', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  const id = workstreams[0].actionLog[0].id;
  assertIncludes(html, `deleteActionLogItem('${workstreams[0].id}','${id}')`);
  assertIncludes(html, 'fa-trash');
});

test('normalizeData backfills a missing/malformed workstream.actionLog to an empty array, and fills in a hand-built row', function () {
  workstreams[0].actionLog = 'not an array';
  normalizeData();
  assertDeepEqual(workstreams[0].actionLog, []);

  workstreams[0].actionLog = [{ text: 'X' }];
  normalizeData();
  const a = workstreams[0].actionLog[0];
  assertTrue(isSafeId(a.id));
  assertEqual(a.text, 'X');
  assertEqual(a.owner, '');
  assertEqual(a.dueDate, null);
  assertEqual(a.completed, false);
  assertEqual(a.completedAt, null);
  assertTrue(typeof a.addedAt === 'number');
  assertEqual(a.flagged, false, 'a hand-built row missing flagged backfills to false');
});

// The Review Status/Review tab's own label still flexes with the shared
// workstream selector, but — per a later, explicit user request ("move
// Review Status... all to the left, before Action Log") — its position no
// longer does: it always sorts leftmost now, ahead of Action Log/Decision
// Log/Change Log, regardless of which label is currently showing.
test('#tabReviewScope always sorts leftmost (order -1), whether it reads "Review" or "Review Status"', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  let tab = document.getElementById('tabReviewScope');
  assertIncludes(tab.innerHTML, 'Review');
  assertNotIncludes(tab.innerHTML, 'Review Status');
  assertEqual(tab.style.order, '-1');

  setFilterWorkstream(null); // "All Workstreams"
  tab = document.getElementById('tabReviewScope');
  assertIncludes(tab.innerHTML, 'Review Status');
  assertEqual(tab.style.order, '-1', 'position must stay leftmost even once the label switches to "Review Status"');
});

test('setReviewTab switches renderReview between the Scope Item Review checklist and the Action Log', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');

  assertEqual(reviewTab, 'scope', 'Review should default to the Scope Item Review tab');
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Start review cycle', 'the completed cycle from addCompletedReviewCycle() has no active cycle left, so Scope Item Review falls back to its "start a new one" state');
  assertNotIncludes(html, 'action-log-list');

  setReviewTab('actionLog');
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'action-log-list');
  assertIncludes(html, 'Update runbook');
  assertNotIncludes(html, 'Start review cycle');

  setReviewTab('scope');
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Start review cycle');
});

test('the "X open of Y action items" count sits in the section header (next to the workstream name), not floating above the table', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  const headerEnd = html.indexOf('</div>'); // .review-header is the very first element renderReview() writes
  const countIdx = html.indexOf('open of 1 action item');
  const tableIdx = html.indexOf('action-log-list');
  assertTrue(countIdx >= 0 && countIdx < headerEnd, 'the count should render inside .review-header, before its closing tag');
  assertTrue(countIdx < tableIdx, 'the count should appear before the table in document order too');
});

test('actionLogCountHtml renders nothing when the workstream has no action items yet — no empty "0 open of 0" badge in the header', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'open of');
});

test('actionLogHtml shows an empty state when the workstream has no action items yet', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'No action items yet');
  assertNotIncludes(html, 'action-log-header', 'no header row without any actual rows to label');
});

test('actionLogHtml shows a header row (Action Item / Owner / Due Date / Source / Created / Closed / Actions) once there is at least one action item', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'action-log-header');
  assertIncludes(html, 'Action Item');
  assertIncludes(html, 'Owner');
  assertIncludes(html, 'Due Date');
  assertIncludes(html, 'Source');
  assertIncludes(html, 'Created');
  assertIncludes(html, 'Closed');
  // Delete/the confirm toggle share one "Actions" label spanning both
  // columns (8/10) — a user-reported gap, since it used to be left
  // unlabeled while every other column here had its own header text.
  const headerRow = html.slice(html.indexOf('action-log-header'), html.indexOf('action-log-header') + 600);
  assertIncludes(headerRow, 'grid-column:8/10', 'the Actions label must span both the Delete and Confirm columns');
  assertIncludes(headerRow, '>Actions<');
});

test('actionLogRowHtml shows the Source column as plain "Review" (with the fuller "From review started ..." text kept as a hover tooltip), since every row is transcribed from a review\'s minutes', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>Review<');
  assertIncludes(html, 'From review started');
});

test('actionLogRowHtml shows a Created date (from addedAt) and a Closed date only once the item is completed (from completedAt)', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const id = workstreams[0].actionLog[0].id;
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, fmtDate(dateStrFromTs(workstreams[0].actionLog[0].addedAt)), 'Created should show the addedAt date');
  assertEqual(workstreams[0].actionLog[0].completedAt, null, 'sanity check — not completed yet');

  toggleActionLogItem(workstreams[0].id, id);
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, fmtDate(dateStrFromTs(workstreams[0].actionLog[0].completedAt)), 'Closed should show the completedAt date once completed');
});

// Regression guard for Action Log's own bespoke 9-column grid (priority
// flag / Action Item / Owner / Due Date / Source / Created / Closed /
// Delete / Confirm — see CLAUDE.md for why this is no longer derived from
// --item-grid-cols at all): both the header row and every data row must
// agree on the exact column numbers, since .action-log-row/.action-log-
// header's CSS pins each column's width via a fully explicit
// grid-template-columns override that only stays aligned if header and
// data rows place their content at the same column numbers.
test('actionLogHtml\'s header and data rows agree on where the flag/Action Item/Owner/Due Date/Source/Created/Closed/Delete/Confirm sit (columns 1-9)', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  const headerRow = html.slice(html.indexOf('action-log-header'), html.indexOf('action-log-header') + 600);
  assertIncludes(headerRow, 'grid-column:1" title="Priority flag"');
  assertIncludes(headerRow, 'grid-column:2">Action Item');
  assertIncludes(headerRow, 'grid-column:3">Owner');
  assertIncludes(headerRow, 'grid-column:4">Due Date');
  assertIncludes(headerRow, 'grid-column:5">Source');
  assertIncludes(headerRow, 'grid-column:6">Created');
  assertIncludes(headerRow, 'grid-column:7">Closed');

  const id = workstreams[0].actionLog[0].id;
  assertIncludes(html, `grid-column:1" onclick="toggleActionLogFlag('${workstreams[0].id}','${id}')"`, 'the priority flag must sit at column 1, before Action Item');
  assertIncludes(html, `<span class="action-log-text" style="grid-column:2">`, 'Action Item must sit at column 2 on the data row too');
  assertIncludes(html, `grid-column:8" onclick="deleteActionLogItem('${workstreams[0].id}','${id}')"`, 'Delete must sit at column 8, after Created/Closed');
  assertIncludes(html, `grid-column:9" onclick="toggleActionLogItem('${workstreams[0].id}','${id}')"`, 'the confirm toggle must sit at column 9, last');
});

// Regression test: the same shape of bug as actionLogHtml()'s header above,
// but in milestoneHeaderHtml() — a visible "Confirm" text label used to sit
// at the review-only trailing column in the header row, while every
// milestone data row below it (milestoneRowsHtml()) only ever puts a bare
// icon there. Since each row is its own independent CSS Grid instance and
// column 2 is the only flexible track, the wider text label consumed more
// of the header's own width than the data rows' icon did — visibly shifting
// Due/Actual/Status/Confirm out of alignment (reported via screenshot).
// Fixed the same way: an invisible placeholder matching the real icon, not
// a text label. That trailing column was column 12 when this was first
// fixed — now column 11, after --item-grid-cols dropped its always-blank
// "Actual" placeholder track (an explicit later user request, "remove
// column 6") and every explicit grid-column reference shifted down by one.
test('milestoneHeaderHtml\'s Confirm column is an (invisible) icon placeholder, not a text label, so it stays aligned with the data rows\' own icon-only column', function () {
  const m = { id: genId(), name: 'M1', dueDate: todayStr(), status: 'not-started', actualDate: null };
  const it = addReviewItem({ name: 'Has milestone', milestones: [m] });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  toggleItemExpanded(it.id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  const headerRow = html.slice(html.indexOf('milestone-header'), html.indexOf('milestone-header') + 500);
  assertIncludes(headerRow, 'grid-column:12', 'the header row must place something at the same trailing column the data rows\' implicit toggle column uses');
  assertIncludes(headerRow, 'visibility:hidden', 'the placeholder should reserve space without actually being visible');
  assertNotIncludes(headerRow, '>Confirm<', 'a visible text label here is wider than the data rows\' icon and would reintroduce the misalignment');
});

test('sortedActionLog puts open items first (soonest due date first, undated last) and sinks completed items to the bottom', function () {
  const list = [
    { id: 'a', text: 'Undated open', completed: false, dueDate: null },
    { id: 'b', text: 'Due later', completed: false, dueDate: '2026-09-01' },
    { id: 'c', text: 'Due sooner', completed: false, dueDate: '2026-08-01' },
    { id: 'd', text: 'Done recently', completed: true, completedAt: 200 },
    { id: 'e', text: 'Done earlier', completed: true, completedAt: 100 }
  ];
  const sorted = sortedActionLog(list).map(a => a.id);
  assertDeepEqual(sorted, ['c', 'b', 'a', 'd', 'e']);
});

test('sortedActionLog\'s keyFn param sorts a list of wrapped {w, a} pairs by the wrapped item\'s own fields, same ordering as the plain-list case', function () {
  const list = [
    { w: 'ws1', a: { id: 'a', completed: false, dueDate: '2026-09-01' } },
    { w: 'ws2', a: { id: 'b', completed: false, dueDate: '2026-08-01' } },
    { w: 'ws1', a: { id: 'c', completed: true, completedAt: 100 } }
  ];
  const sorted = sortedActionLog(list, x => x.a).map(x => x.a.id);
  assertDeepEqual(sorted, ['b', 'a', 'c']);
});

// ---------- "All Workstreams" Action Log ----------
// Reachable from Review mode's Action Log tab with "All Workstreams"
// selected in the sidebar — see setMode()/setFilterWorkstream()'s own
// comments for why Review mode no longer requires a specific workstream
// the way it used to (Scope Item Review still does; the Action Log doesn't).

function addSecondWorkstreamWithCompletedCycle() {
  document.getElementById('wsNameInput').value = 'Second Stream';
  wsColorChoice = 'teal';
  saveWorkstream();
  const w2 = workstreams[1];
  const it = addReviewItem({ workstreamId: w2.id });
  startReviewCycle(w2.id);
  const cycle = activeReviewCycle(w2.id);
  toggleReviewConfirm(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  return reviewCycles.find(c => c.workstreamId === w2.id);
}

test('allWorkstreamsActionLogHtml merges every workstream\'s own action log into one list, each row tagged with its source workstream', function () {
  const cycle1 = addCompletedReviewCycle();
  openMinutesModal(cycle1.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'From workstream 1';
  saveMinutes();

  const cycle2 = addSecondWorkstreamWithCompletedCycle();
  openMinutesModal(cycle2.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'From workstream 2';
  saveMinutes();

  const html = allWorkstreamsActionLogHtml();
  assertIncludes(html, 'From workstream 1');
  assertIncludes(html, 'From workstream 2');
  assertIncludes(html, esc(workstreams[0].name));
  assertIncludes(html, esc(workstreams[1].name));
  assertIncludes(html, 'action-log-row with-ws', 'each data row must carry the with-ws modifier so its CSS grid gets the extra Workstream column');
});

test('allWorkstreamsActionLogHtml\'s header includes a Workstream column and shifts every later column one slot right (columns 3-10)', function () {
  addCompletedReviewCycle();
  const w = workstreams[0];
  w.actionLog = [{ id: 'a1', text: 'X', owner: 'Alice', dueDate: null, completed: false, completedAt: null, cycleId: null, addedAt: Date.now(), flagged: false }];
  const html = allWorkstreamsActionLogHtml();
  const headerRow = html.slice(html.indexOf('action-log-header'), html.indexOf('action-log-header') + 600);
  assertIncludes(headerRow, 'grid-column:1" title="Priority flag"');
  assertIncludes(headerRow, 'grid-column:2">Action Item');
  assertIncludes(headerRow, 'grid-column:3">Workstream');
  assertIncludes(headerRow, 'grid-column:4">Owner');
  assertIncludes(headerRow, 'grid-column:5">Due Date');
  assertIncludes(headerRow, 'grid-column:6">Source');
  assertIncludes(headerRow, 'grid-column:7">Created');
  assertIncludes(headerRow, 'grid-column:8">Closed');

  assertIncludes(html, `grid-column:1" onclick="toggleActionLogFlag('${w.id}','a1')"`, 'the priority flag stays at column 1 in this view too');
  assertIncludes(html, `<span class="action-log-ws" style="grid-column:3"`, 'the Workstream cell must sit at column 3 on the data row too');
  assertIncludes(html, `grid-column:9" onclick="deleteActionLogItem('${w.id}','a1')"`, 'Delete shifts to column 9 to make room for the flag and Workstream columns');
  assertIncludes(html, `grid-column:10" onclick="toggleActionLogItem('${w.id}','a1')"`, 'the confirm toggle shifts to column 10, still last');
});

test('allWorkstreamsActionLogHtml shows the same empty state as the per-workstream table when no workstream has any action items', function () {
  const html = allWorkstreamsActionLogHtml();
  assertIncludes(html, 'No action items yet');
});

test('renderReview shows the "All Workstreams" Action Log when no workstream is filtered and reviewTab is "actionLog", with an aggregate open/total count', function () {
  const cycle1 = addCompletedReviewCycle();
  openMinutesModal(cycle1.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Item one';
  saveMinutes();

  const cycle2 = addSecondWorkstreamWithCompletedCycle();
  openMinutesModal(cycle2.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Item two';
  saveMinutes();

  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setFilterWorkstream(null);
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>All Workstreams<');
  assertIncludes(html, '2 open of 2 action items');
  assertIncludes(html, 'Item one');
  assertIncludes(html, 'Item two');
});

test('a completed action item on the "All Workstreams" view is excluded from the open count, same as the per-workstream one', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Close me';
  saveMinutes();
  toggleActionLogItem(workstreams[0].id, workstreams[0].actionLog[0].id);

  setMode('review'); // no workstream filtered
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '0 open of 1 action item');
});

// ---------- Decision Log (Review's third tab) ----------
// Action Log's counterpart for the Decisions section of meeting minutes. A
// decision has no owner/due date/completed state of its own — it's one line
// of free text — so linesToDecisions() splits a meeting's whole Decisions
// block into individual lines, and syncDecisionLogFromMinutes() matches
// existing rows by exact text (there's no per-line id the way action items
// have) rather than by id.

test('linesToDecisions splits a Decisions block into individual lines, stripping bullet markers and blank lines', function () {
  const lines = linesToDecisions('• Go live on the 15th.\n- Freeze scope after Friday.\n\n  Revisit budget next quarter.  ');
  assertDeepEqual(lines, ['Go live on the 15th.', 'Freeze scope after Friday.', 'Revisit budget next quarter.']);
});

test('saveMinutes syncs each line of the saved Decisions text into the workstream\'s own decisionLog', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = '• Go live on the 15th.\n• Freeze scope after Friday.';
  saveMinutes();
  const log = workstreams[0].decisionLog;
  assertEqual(log.length, 2);
  assertEqual(log[0].text, 'Go live on the 15th.');
  assertEqual(log[1].text, 'Freeze scope after Friday.');
  assertEqual(log[0].cycleId, cycle.id);
});

test('re-saving minutes with an unchanged decision line keeps that line\'s same log entry (same id/addedAt), not a new one', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  const entryId = workstreams[0].decisionLog[0].id;
  const addedAt = workstreams[0].decisionLog[0].addedAt;

  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.\nFreeze scope after Friday.';
  saveMinutes();
  assertEqual(workstreams[0].decisionLog.length, 2, 'the unchanged line must not be duplicated');
  const unchanged = workstreams[0].decisionLog.find(d => d.text === 'Go live on the 15th.');
  assertEqual(unchanged.id, entryId);
  assertEqual(unchanged.addedAt, addedAt);
  assertTrue(workstreams[0].decisionLog.some(d => d.text === 'Freeze scope after Friday.'));
});

test('re-saving minutes with a decision line removed drops just that line\'s log entry, leaving the rest', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.\nFreeze scope after Friday.';
  saveMinutes();
  assertEqual(workstreams[0].decisionLog.length, 2, 'sanity check');

  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  assertEqual(workstreams[0].decisionLog.length, 1);
  assertEqual(workstreams[0].decisionLog[0].text, 'Go live on the 15th.');
});

test('saving a second review cycle\'s minutes appends to the same workstream decisionLog rather than replacing it', function () {
  const cycle1 = addCompletedReviewCycle();
  openMinutesModal(cycle1.id);
  document.getElementById('minutesDecisionsInput').value = 'From cycle 1';
  saveMinutes();

  startReviewCycle(workstreams[0].id);
  const cycle2 = activeReviewCycle(workstreams[0].id);
  completeReviewCycle(cycle2.id);
  openMinutesModal(cycle2.id);
  document.getElementById('minutesDecisionsInput').value = 'From cycle 2';
  saveMinutes();

  assertEqual(workstreams[0].decisionLog.length, 2);
  assertEqual(workstreams[0].decisionLog.map(d => d.text).sort().join(','), 'From cycle 1,From cycle 2');
});

test('removeMinutes also deletes that cycle\'s decisions from the workstream decisionLog, so none linger orphaned', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  assertEqual(workstreams[0].decisionLog.length, 1, 'sanity check — saving minutes should have synced one decision log entry');

  openMinutesModal(cycle.id);
  removeMinutes();
  confirmModalAction();
  assertEqual(workstreams[0].decisionLog.length, 0);
});

test('removeMinutes only deletes decisions from its own cycle, leaving other cycles\' entries on the same workstream alone', function () {
  const cycle1 = addCompletedReviewCycle();
  openMinutesModal(cycle1.id);
  document.getElementById('minutesDecisionsInput').value = 'From cycle 1';
  saveMinutes();

  startReviewCycle(workstreams[0].id);
  const cycle2 = activeReviewCycle(workstreams[0].id);
  completeReviewCycle(cycle2.id);
  openMinutesModal(cycle2.id);
  document.getElementById('minutesDecisionsInput').value = 'From cycle 2';
  saveMinutes();
  assertEqual(workstreams[0].decisionLog.length, 2);

  openMinutesModal(cycle1.id);
  removeMinutes();
  confirmModalAction();
  assertEqual(workstreams[0].decisionLog.length, 1);
  assertEqual(workstreams[0].decisionLog[0].text, 'From cycle 2');
});

test('toggleDecisionLogFlag flips flagged', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  const id = workstreams[0].decisionLog[0].id;
  assertEqual(workstreams[0].decisionLog[0].flagged, false, 'a freshly-synced decision starts unflagged');

  toggleDecisionLogFlag(workstreams[0].id, id);
  assertEqual(workstreams[0].decisionLog[0].flagged, true);
  toggleDecisionLogFlag(workstreams[0].id, id);
  assertEqual(workstreams[0].decisionLog[0].flagged, false);
});

test('toggleDecisionLogFlag is blocked below Reviewer', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  const id = workstreams[0].decisionLog[0].id;
  userRole = 'visitor';
  toggleDecisionLogFlag(workstreams[0].id, id);
  assertEqual(workstreams[0].decisionLog[0].flagged, false);
});

test('decisionLogRowHtml renders the priority flag as a clickable button at Reviewer+, an inert span below it', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  const w = workstreams[0];
  const id = w.decisionLog[0].id;
  setFilterWorkstream(w.id);
  setMode('review');
  setReviewTab('decisionLog');
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onclick="toggleDecisionLogFlag('${w.id}','${id}')"`);
  assertIncludes(html, 'fa-regular fa-flag');

  toggleDecisionLogFlag(w.id, id);
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'fa-solid fa-flag');
  assertIncludes(html, 'priority-flag-btn flagged');

  userRole = 'visitor';
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, `onclick="toggleDecisionLogFlag('${w.id}','${id}')"`);
  assertIncludes(html, 'fa-solid fa-flag', 'still shows the real flagged state below Reviewer');
});

// syncDecisionLogFromMinutes() matches an existing row by text and reuses
// the same object — flagged must survive a re-save of the source minutes
// unrelated to this decision, the same "don't reset completed on re-sync"
// invariant syncActionLogFromMinutes() already guards.
test('flagged survives re-saving the source cycle\'s minutes unchanged', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  const id = workstreams[0].decisionLog[0].id;
  toggleDecisionLogFlag(workstreams[0].id, id);
  assertEqual(workstreams[0].decisionLog[0].flagged, true);

  openMinutesModal(cycle.id);
  saveMinutes(); // unrelated re-save, same decision text
  assertEqual(workstreams[0].decisionLog.length, 1);
  assertEqual(workstreams[0].decisionLog[0].flagged, true, 'flagged must survive a re-sync that matches the same decision text');
});

test('deleteDecisionLogItem is undoable, restoring the entry at its original position', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'First decision\nSecond decision';
  saveMinutes();
  const id = workstreams[0].decisionLog[0].id;

  deleteDecisionLogItem(workstreams[0].id, id);
  confirmModalAction();
  assertEqual(workstreams[0].decisionLog.length, 1);
  assertTrue(!!toastUndoAction, 'an undo action should be armed after deleting');
  triggerToastUndo();
  assertEqual(workstreams[0].decisionLog.length, 2);
  assertEqual(workstreams[0].decisionLog[0].id, id, 'restored at its original index');
});

test('deleteDecisionLogItem removes the entry only after confirmation, and does not touch the source cycle\'s own saved minutes', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  const id = workstreams[0].decisionLog[0].id;

  deleteDecisionLogItem(workstreams[0].id, id);
  assertEqual(workstreams[0].decisionLog.length, 1, 'opening the confirm modal must not delete anything by itself');
  confirmModalAction();
  assertEqual(workstreams[0].decisionLog.length, 0);
  assertEqual(cycle.minutes.decisions, 'Go live on the 15th.', 'deleting from the log is separate from the cycle\'s own saved minutes');
});

test('normalizeData backfills a missing/malformed workstream.decisionLog to an empty array, and fills in a hand-built row', function () {
  workstreams[0].decisionLog = 'not an array';
  normalizeData();
  assertDeepEqual(workstreams[0].decisionLog, []);

  workstreams[0].decisionLog = [{ text: 'X' }];
  normalizeData();
  const d = workstreams[0].decisionLog[0];
  assertTrue(isSafeId(d.id));
  assertEqual(d.text, 'X');
  assertTrue(typeof d.addedAt === 'number');
  assertEqual(d.flagged, false, 'a hand-built row missing flagged backfills to false');
});

test('setReviewTab switches renderReview to the Decision Log, alongside Scope Item Review and Action Log', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');

  setReviewTab('decisionLog');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'decision-log-row');
  assertIncludes(html, 'Go live on the 15th.');
  assertNotIncludes(html, 'Start review cycle');
});

test('decisionLogHtml shows an empty state when the workstream has no decisions yet, and a header row (Decision / Source / Logged) once there is at least one', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('decisionLog');
  let html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'No decisions yet');
  assertNotIncludes(html, 'decision-log-header', 'no header row without any actual rows to label');

  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'decision-log-header');
  assertIncludes(html, '>Decision<');
  assertIncludes(html, '>Source<');
  assertIncludes(html, '>Logged<');
  // A user-reported inconsistency: Action Log's own trailing action column(s)
  // get a header label ("Actions"), but Decision Log's lone Delete column
  // used to render a genuinely empty header cell. Now labeled "Delete" —
  // matching Action Log's own "always label the actions column" convention,
  // just naming this one action directly rather than reusing "Actions" for
  // a column that only ever has the one.
  assertIncludes(html, '>Delete<');
  assertNotIncludes(html, '>Owner<', 'a decision has no owner column, unlike an action item');
});

test('decisionLogRowHtml renders a Delete button wired to deleteDecisionLogItem, with no confirm/complete toggle — a decision has no done state', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  document.getElementById('minutesDecisionsInput').value = 'Go live on the 15th.';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('decisionLog');
  const html = document.getElementById('main').innerHTML;
  const id = workstreams[0].decisionLog[0].id;
  assertIncludes(html, `deleteDecisionLogItem('${workstreams[0].id}','${id}')`);
  assertIncludes(html, 'fa-trash');
  assertNotIncludes(html, 'review-confirm-toggle');
});

test('decisionLogCountHtml renders "N decisions" and nothing when the workstream has none yet', function () {
  assertEqual(decisionLogCountHtml([]), '');
  assertIncludes(decisionLogCountHtml([{ addedAt: 1 }]), '1 decision');
  assertIncludes(decisionLogCountHtml([{ addedAt: 1 }, { addedAt: 2 }]), '2 decisions');
});

test('sortedDecisionLog orders decisions most-recently-logged first', function () {
  const list = [
    { id: 'a', text: 'Oldest', addedAt: 100 },
    { id: 'b', text: 'Newest', addedAt: 300 },
    { id: 'c', text: 'Middle', addedAt: 200 }
  ];
  const sorted = sortedDecisionLog(list).map(d => d.id);
  assertDeepEqual(sorted, ['b', 'c', 'a']);
});

test('sortedDecisionLog\'s keyFn param sorts a list of wrapped {w, d} pairs by the wrapped item\'s own addedAt, same ordering as the plain-list case', function () {
  const list = [
    { w: 'ws1', d: { id: 'a', addedAt: 100 } },
    { w: 'ws2', d: { id: 'b', addedAt: 300 } }
  ];
  const sorted = sortedDecisionLog(list, x => x.d).map(x => x.d.id);
  assertDeepEqual(sorted, ['b', 'a']);
});

// ---------- "All Workstreams" Decision Log ----------

test('allWorkstreamsDecisionLogHtml merges every workstream\'s own decision log into one list, each row tagged with its source workstream', function () {
  const cycle1 = addCompletedReviewCycle();
  openMinutesModal(cycle1.id);
  document.getElementById('minutesDecisionsInput').value = 'From workstream 1';
  saveMinutes();

  const cycle2 = addSecondWorkstreamWithCompletedCycle();
  openMinutesModal(cycle2.id);
  document.getElementById('minutesDecisionsInput').value = 'From workstream 2';
  saveMinutes();

  const html = allWorkstreamsDecisionLogHtml();
  assertIncludes(html, 'From workstream 1');
  assertIncludes(html, 'From workstream 2');
  assertIncludes(html, esc(workstreams[0].name));
  assertIncludes(html, esc(workstreams[1].name));
  assertIncludes(html, 'decision-log-row with-ws', 'each data row must carry the with-ws modifier so its CSS grid gets the extra Workstream column');
});

test('allWorkstreamsDecisionLogHtml\'s header includes a Workstream column and shifts Source/Logged/Delete one slot right', function () {
  addCompletedReviewCycle();
  const w = workstreams[0];
  w.decisionLog = [{ id: 'd1', text: 'X', cycleId: null, addedAt: Date.now(), flagged: false }];
  const html = allWorkstreamsDecisionLogHtml();
  const headerRow = html.slice(html.indexOf('decision-log-header'), html.indexOf('decision-log-header') + 400);
  assertIncludes(headerRow, 'grid-column:1" title="Priority flag"');
  assertIncludes(headerRow, 'grid-column:2">Decision');
  assertIncludes(headerRow, 'grid-column:3">Workstream');
  assertIncludes(headerRow, 'grid-column:4">Source');
  assertIncludes(headerRow, 'grid-column:5">Logged');

  assertIncludes(html, `grid-column:1" onclick="toggleDecisionLogFlag('${w.id}','d1')"`, 'the priority flag stays at column 1 in this view too');
  assertIncludes(html, `<span class="action-log-ws" style="grid-column:3"`, 'the Workstream cell must sit at column 3 on the data row too');
  assertIncludes(html, `grid-column:6" onclick="deleteDecisionLogItem('${w.id}','d1')"`, 'Delete shifts to column 6 to make room for the flag and Workstream columns');
});

test('allWorkstreamsDecisionLogHtml shows the same empty state as the per-workstream table when no workstream has any decisions', function () {
  const html = allWorkstreamsDecisionLogHtml();
  assertIncludes(html, 'No decisions yet');
});

test('renderReview shows the "All Workstreams" Decision Log when no workstream is filtered and reviewTab is "decisionLog", with an aggregate count', function () {
  const cycle1 = addCompletedReviewCycle();
  openMinutesModal(cycle1.id);
  document.getElementById('minutesDecisionsInput').value = 'Decision one';
  saveMinutes();

  const cycle2 = addSecondWorkstreamWithCompletedCycle();
  openMinutesModal(cycle2.id);
  document.getElementById('minutesDecisionsInput').value = 'Decision two';
  saveMinutes();

  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('decisionLog');
  setFilterWorkstream(null);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>All Workstreams<');
  assertIncludes(html, '2 decisions');
  assertIncludes(html, 'Decision one');
  assertIncludes(html, 'Decision two');
});

// ---------- "All Workstreams" review-dates overview (Scope Item Review's
// own landing view with no workstream selected — an explicit user request;
// see reviewDatesOverviewHtml()) ----------

function addWorkstreamWithReviewedDaysAgo(name, daysAgo) {
  document.getElementById('wsNameInput').value = name;
  wsColorChoice = 'teal';
  saveWorkstream();
  const w = workstreams[workstreams.length - 1];
  const it = addReviewItem({ workstreamId: w.id });
  startReviewCycle(w.id);
  const cycle = activeReviewCycle(w.id);
  toggleReviewConfirm(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  if (daysAgo !== null) cycle.completedAt = Date.now() - daysAgo * DAY_MS;
  return w;
}

test('reviewDatesOverviewHtml shows "Never reviewed" and red styling for a workstream with items but no completed review', function () {
  addReviewItem({});
  const html = reviewDatesOverviewHtml();
  assertIncludes(html, 'Never reviewed');
  assertIncludes(html, 'stale-red');
});

test('reviewDatesOverviewHtml applies no color coding to a workstream with no scope items yet, even though it is technically never reviewed', function () {
  assertEqual(items.filter(it => it.workstreamId === workstreams[0].id).length, 0, 'sanity check — a fresh workstream starts with no items');
  const html = reviewDatesOverviewHtml();
  assertIncludes(html, 'Never reviewed');
  assertFalse(html.includes('stale-red'));
  assertFalse(html.includes('stale-amber'));
});

test('reviewDatesOverviewHtml color-codes by staleness — under 2 weeks is uncolored, 2-4 weeks is amber, over 4 weeks (or never) is red', function () {
  const fresh = addWorkstreamWithReviewedDaysAgo('Fresh', 5);
  const amber = addWorkstreamWithReviewedDaysAgo('Getting Stale', 20);
  const stale = addWorkstreamWithReviewedDaysAgo('Very Stale', 40);
  const html = reviewDatesOverviewHtml();
  assertIncludes(html, `review-date-row" onclick="setFilterWorkstream('${fresh.id}')"`);
  assertIncludes(html, `review-date-row stale-amber" onclick="setFilterWorkstream('${amber.id}')"`);
  assertIncludes(html, `review-date-row stale-red" onclick="setFilterWorkstream('${stale.id}')"`);
});

test('reviewDatesOverviewHtml ranks workstreams oldest (or never-reviewed) review first', function () {
  const recent = addWorkstreamWithReviewedDaysAgo('Recent', 1);
  const neverReviewed = workstreams.find(w => w.id === workstreams[0].id);
  addReviewItem({ workstreamId: neverReviewed.id }); // workstreams[0] — never reviewed
  const oldest = addWorkstreamWithReviewedDaysAgo('Oldest', 60);

  const html = reviewDatesOverviewHtml();
  const posNever = html.indexOf(neverReviewed.id);
  const posOldest = html.indexOf(oldest.id);
  const posRecent = html.indexOf(recent.id);
  assertTrue(posNever < posOldest, 'never-reviewed ranks ahead of a workstream reviewed 60 days ago');
  assertTrue(posOldest < posRecent, 'a review from 60 days ago ranks ahead of one from yesterday');
});

test('reviewDatesOverviewHtml rows are clickable and select that workstream', function () {
  const w = addWorkstreamWithReviewedDaysAgo('Clickable', 3);
  assertIncludes(reviewDatesOverviewHtml(), `onclick="setFilterWorkstream('${w.id}')"`);
});

test('renderReview shows the all-workstreams review-dates overview on Scope Item Review with no workstream selected', function () {
  addReviewItem({});
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setFilterWorkstream(null);
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>All Workstreams<');
  assertIncludes(html, 'review-date-row');
  assertIncludes(html, 'Never reviewed');
});

// ---------- Change Log (Review's fourth tab) ----------
// A cross-workstream, chronological feed of every change logged during a
// review cycle (see logReviewChange()) — an explicit user request. This
// introduces no new data of its own — it flattens the changeLog entries
// already stored on each review cycle (see the "Scope Item Confirmed"
// tests above, which already exercise how tagChange/statusChange/
// dateChange entries get logged in the first place).

test('workstreamChangeLogEntries flattens every review cycle\'s changeLog for one workstream, newest first', function () {
  const it = addReviewItem({ name: 'Call Money', itStatus: 'green' });
  startReviewCycle(workstreams[0].id);
  const cycle1 = activeReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus'); // green -> amber
  cycle1.changeLog[0].changedAt = Date.now() - 2000;
  toggleReviewConfirm(cycle1.id, it.id);
  completeReviewCycle(cycle1.id);

  startReviewCycle(workstreams[0].id);
  const cycle2 = activeReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus'); // amber -> red
  cycle2.changeLog[0].changedAt = Date.now();
  toggleReviewConfirm(cycle2.id, it.id);
  completeReviewCycle(cycle2.id);

  const entries = workstreamChangeLogEntries(workstreams[0].id);
  assertEqual(entries.length, 2);
  assertEqual(entries[0].tagChange.newValue, 'red', 'the more recent change (cycle2) comes first');
  assertEqual(entries[1].tagChange.newValue, 'amber', 'the older change (cycle1) comes second');
});

test('changeLogHtml shows an empty state when the workstream has no logged changes yet', function () {
  assertIncludes(changeLogHtml(workstreams[0]), 'No changes logged yet');
});

test('changeLogHtml renders a tag change as old icon -> new icon, with the item name as label — same rendering as the per-cycle history row', function () {
  const it = addReviewItem({ name: 'Call Money', itStatus: 'green' });
  startReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus');
  const html = changeLogHtml(workstreams[0]);
  assertIncludes(html, 'review-change-label" style="flex:1">Call Money<');
  assertIncludes(html, 'review-change-arrow');
  assertEqual((html.match(/fa-laptop-code/g) || []).length, 2, 'the IT icon should render twice — old value, then new value');
});

test('changeLogCountHtml renders "N changes" (singular for one) and nothing for an empty list', function () {
  assertEqual(changeLogCountHtml([]), '');
  assertIncludes(changeLogCountHtml([{}, {}]), '2 changes');
  assertIncludes(changeLogCountHtml([{}]), '1 change<');
});

test('allWorkstreamsChangeLogHtml merges every workstream\'s changes into one feed, each row tagged with its source workstream, newest first', function () {
  const it1 = addReviewItem({ name: 'Item One', itStatus: 'green' });
  startReviewCycle(workstreams[0].id);
  const c1 = activeReviewCycle(workstreams[0].id);
  cycleItemAttr(it1.id, 'itStatus');
  c1.changeLog[0].changedAt = Date.now() - 5000;

  document.getElementById('wsNameInput').value = 'Second Stream';
  wsColorChoice = 'teal';
  saveWorkstream();
  const w2 = workstreams[1];
  const it2 = addReviewItem({ workstreamId: w2.id, name: 'Item Two', itStatus: 'green' });
  startReviewCycle(w2.id);
  const c2 = activeReviewCycle(w2.id);
  cycleItemAttr(it2.id, 'itStatus');
  c2.changeLog[0].changedAt = Date.now();

  const html = allWorkstreamsChangeLogHtml();
  assertIncludes(html, 'Workstream 1');
  assertIncludes(html, 'Second Stream');
  const posOne = html.indexOf('Item One');
  const posTwo = html.indexOf('Item Two');
  assertTrue(posTwo < posOne, 'the more recent change (Item Two, on Second Stream) should render first');
});

test('allWorkstreamsChangeLogHtml shows the same empty state as the per-workstream view when nothing has been logged', function () {
  assertIncludes(allWorkstreamsChangeLogHtml(), 'No changes logged yet');
});

test('setReviewTab switches renderReview to the Change Log, alongside the other three tabs', function () {
  const it = addReviewItem({ name: 'Call Money', itStatus: 'green' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus');

  setReviewTab('changeLog');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Workstream 1');
  assertIncludes(html, '1 change<');
  assertIncludes(html, 'review-change-label" style="flex:1">Call Money<');
  assertNotIncludes(html, 'Start review cycle');
});

test('renderReview shows the "All Workstreams" Change Log when no workstream is filtered and reviewTab is "changeLog"', function () {
  const it = addReviewItem({ name: 'Call Money', itStatus: 'green' });
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  cycleItemAttr(it.id, 'itStatus');
  setFilterWorkstream(null);
  setReviewTab('changeLog');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, '>All Workstreams<');
  assertIncludes(html, '1 change<');
  assertIncludes(html, 'Call Money');
});
