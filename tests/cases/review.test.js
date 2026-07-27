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

test('actionLogHtml shows a header row (Action Item / Owner / Due Date / Source) once there is at least one action item', function () {
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
});

// Regression test: the header row is missing a grid-column:12 element
// unless it reserves one — see actionLogHtml()'s own comment. Without it,
// column 12 (an implicit track, not one of the 11 explicit --item-grid-cols
// tracks) doesn't exist in the header row at all, so its flexible Action
// Item column resolves wider than the data rows' — visibly shifting Owner/
// Due Date/Source to the right of where they sit in the rows below.
test('actionLogHtml\'s header row reserves an (invisible) grid-column:12 slot so it doesn\'t shift out of alignment with the data rows below it', function () {
  const cycle = addCompletedReviewCycle();
  openMinutesModal(cycle.id);
  addMinutesActionItemRow();
  editingMinutesActionItems[0].text = 'Update runbook';
  saveMinutes();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  setReviewTab('actionLog');
  const html = document.getElementById('main').innerHTML;
  const headerRow = html.slice(html.indexOf('action-log-header'), html.indexOf('action-log-header') + 800);
  assertIncludes(headerRow, 'grid-column:12', 'the header row must place something at column 12 to match the data rows\' implicit toggle column');
  assertIncludes(headerRow, 'visibility:hidden', 'the col-12 placeholder should reserve space without actually being visible in the header');
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
