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

// ---------- actualDate also excludes something from Overdue/Upcoming ----------
// An explicit user request ("also consider the actual date to determine if
// a milestone is overdue and upcoming") — actualDate is deliberately manual
// and independent of status (see "Data model" in CLAUDE.md), so something
// can genuinely already be finished (actualDate recorded) while its status
// field still lags behind at e.g. 'red'/'not-started'. Without this, such
// an item/milestone would still nag as Overdue/Upcoming despite already
// being done in practice.

test('a past-due milestone with an actualDate already recorded does not appear in the Overdue feed, even though its status isn\'t complete', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Actually finished', dueDate: isoDaysFromNow(-3), actualDate: isoDaysFromNow(-1), status: 'not-started' }] });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Actually finished');
});

test('a milestone due soon with an actualDate already recorded does not appear in the Upcoming feed, even though its status isn\'t complete', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Already done', dueDate: isoDaysFromNow(3), actualDate: isoDaysFromNow(-1), status: 'amber' }] });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Already done');
});

test('a past-due item with an actualDate already recorded does not appear in the Overdue feed, even though its status isn\'t complete', function () {
  addDashItem({ name: 'Already wrapped up', status: 'red', dueDate: isoDaysFromNow(-3), actualDate: isoDaysFromNow(-1) });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Already wrapped up');
});

test('an item due soon with an actualDate already recorded does not appear in the Upcoming feed, even though its status isn\'t complete', function () {
  addDashItem({ name: 'Finished early', status: 'amber', dueDate: isoDaysFromNow(3), actualDate: isoDaysFromNow(-1) });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Finished early');
});

test('a past-due milestone with no actualDate yet still appears in the Overdue feed as before', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Still open', dueDate: isoDaysFromNow(-3), actualDate: null, status: 'not-started' }] });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Still open');
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

// ---------- Export Dashboard as Exec Summary (PDF/PNG) ----------
// exportExecSummaryPdf()/exportExecSummaryPng() themselves touch
// window.print()/Image/canvas — none of which this JXA harness mocks (same
// gap documented for the file-sync functions elsewhere) — so only their own
// early feature-detection guard is exercised here. buildExecSummaryHtml()
// and its small helpers are plain string-building with no such dependency,
// so they're tested directly.

test('buildExecSummaryHtml renders the programme name, "All Workstreams" scope, RAG counts, and a per-workstream row', function () {
  programme.name = 'Acme Programme';
  addDashItem({ name: 'Red one', status: 'red' });
  addDashItem({ name: 'Green one', status: 'green' });
  filterWorkstreamId = null;
  const html = buildExecSummaryHtml();
  assertIncludes(html, 'Acme Programme');
  assertIncludes(html, 'All Workstreams');
  assertIncludes(html, '1 Off Track');
  assertIncludes(html, '1 On Track');
  assertIncludes(html, 'Workstream 1'); // the per-workstream summary row
});

test('buildExecSummaryHtml scopes to the selected workstream instead of "All Workstreams"', function () {
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  const secondWsId = workstreams[1].id;
  setFilterWorkstream(secondWsId);
  const html = buildExecSummaryHtml();
  assertIncludes(html, 'Second');
  assertNotIncludes(html, 'All Workstreams');
});

test('buildExecSummaryHtml caps the Overdue feed and shows a "+N more" line once the cap is exceeded', function () {
  for (let i = 0; i < EXEC_SUMMARY_FEED_CAP + 3; i++) {
    addDashItem({ name: 'Overdue ' + i, status: 'red', dueDate: isoDaysFromNow(-1) });
  }
  const html = buildExecSummaryHtml();
  assertIncludes(html, '+3 more');
});

test('buildExecSummaryHtml shows "Nothing here." for an empty Overdue/Upcoming feed', function () {
  const html = buildExecSummaryHtml();
  assertIncludes(html, 'Nothing here.');
});

test('buildExecSummaryHtml output is well-formed — every opened div/span is closed', function () {
  addDashItem({ name: 'Item', status: 'amber', dueDate: isoDaysFromNow(-1) });
  const html = buildExecSummaryHtml();
  assertEqual((html.match(/<div\b/g) || []).length, (html.match(/<\/div>/g) || []).length, 'every <div> needs a matching </div>');
  assertEqual((html.match(/<span\b/g) || []).length, (html.match(/<\/span>/g) || []).length, 'every <span> needs a matching </span>');
});

test('execSummaryScopeLabel falls back to "All Workstreams" for a stale/missing filterWorkstreamId', function () {
  filterWorkstreamId = 'does-not-exist';
  assertEqual(execSummaryScopeLabel(), 'All Workstreams');
  filterWorkstreamId = workstreams[0].id;
  assertEqual(execSummaryScopeLabel(), workstreams[0].name);
});

test('programmeFileSlug slugifies the programme name and falls back to "Pulse" when nothing alphanumeric remains', function () {
  programme.name = 'Acme  Programme! 2026';
  assertEqual(programmeFileSlug(), 'Acme-Programme-2026');
  programme.name = '!!!';
  assertEqual(programmeFileSlug(), 'Pulse');
  programme.name = '';
  assertEqual(programmeFileSlug(), 'Pulse');
});

test('argbToHex strips the leading alpha byte off an EXCEL_RAG_COLORS-style ARGB hex string', function () {
  assertEqual(argbToHex('FF1F9D55'), '#1F9D55');
});

test('exportExecSummaryPdf shows a toast instead of crashing when window.print is unavailable', function () {
  exportExecSummaryPdf();
  assertIncludes(document.getElementById('toastMsg').textContent, 'PDF export needs a browser environment');
});

test('exportExecSummaryPng shows a toast instead of crashing when canvas 2D isn\'t available', async function () {
  await exportExecSummaryPng();
  assertIncludes(document.getElementById('toastMsg').textContent, 'PNG export needs a browser environment');
});

test('execSummaryCanvasHeight grows with more workstreams and more (capped) overdue/upcoming entries', function () {
  const base = execSummaryCanvasHeight(computeDashboardData());
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  const withExtraWs = execSummaryCanvasHeight(computeDashboardData());
  assertTrue(withExtraWs > base, 'an extra workstream row should add height');
  for (let i = 0; i < EXEC_SUMMARY_FEED_CAP + 3; i++) {
    addDashItem({ name: 'Overdue ' + i, status: 'red', dueDate: isoDaysFromNow(-1) });
  }
  const withOverdue = execSummaryCanvasHeight(computeDashboardData());
  assertTrue(withOverdue > withExtraWs, 'a longer (even if capped) overdue feed should add height');
});

test('execSummaryFeedRowCount caps at EXEC_SUMMARY_FEED_CAP + 1 (the "+N more" line), and is 1 for an empty feed', function () {
  assertEqual(execSummaryFeedRowCount([]), 1);
  assertEqual(execSummaryFeedRowCount([{ label: 'a', date: '2026-01-01' }]), 1);
  const many = Array.from({ length: EXEC_SUMMARY_FEED_CAP + 5 }, (_, i) => ({ label: 'e' + i, date: '2026-01-01' }));
  assertEqual(execSummaryFeedRowCount(many), EXEC_SUMMARY_FEED_CAP + 1);
});
