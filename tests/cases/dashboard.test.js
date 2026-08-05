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

test('allMilestonesFlat flattens every item\'s milestones with their parent item name and id attached', function () {
  const it = addDashItem({ milestones: [{ id: 'm1', name: 'M1', dueDate: todayStr(), status: 'not-started' }] });
  const flat = allMilestonesFlat();
  assertEqual(flat.length, 1);
  assertEqual(flat[0].itemName, 'Item');
  assertEqual(flat[0].itemId, it.id, 'the parent item\'s id must travel with a flattened milestone, so a Dashboard feed row can link back to it');
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

test('a notApplicable milestone due within the next 30 days does not appear in the Upcoming feed', function () {
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

// A user-reported bug: a scope item whose milestones are all still Pending
// (nothing planned yet) had its own dueDate silently defaulted to today's
// date at creation time (see saveItem()/saveInlineQuickAddItem()'s own
// comments in pulse.html) — which then read as genuinely Overdue on the
// Dashboard the very next day, despite the item and every one of its
// milestones still showing Pending. The fix makes a Pending item's own
// dueDate null instead of a fabricated date; this locks in that a null
// dueDate never shows up as Overdue regardless of status.
test('a Pending item with no date planned at all (dueDate: null) never appears in the Overdue feed', function () {
  addDashItem({ name: 'Not yet triaged', status: 'pending', dueDate: null, startDate: null });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Not yet triaged');
});

test('a Pending milestone with no date planned at all (dueDate: null) never appears in the Overdue feed', function () {
  addDashItem({ name: 'Parent item', status: 'pending', milestones: [{ id: 'm1', name: 'Scope Item Confirmed', dueDate: null, status: 'pending', actualDate: null }] });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Scope Item Confirmed');
});

test('an item due within the next 30 days appears in the Upcoming feed', function () {
  addDashItem({ name: 'Due soon', status: 'amber', dueDate: isoDaysFromNow(3) });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Due soon');
});

test('an item due more than 30 days out does not appear in the Upcoming feed', function () {
  addDashItem({ name: 'Far off', status: 'amber', dueDate: isoDaysFromNow(45) });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Far off');
});

test('an overdue milestone shows as "item name — milestone name"', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Late milestone', dueDate: isoDaysFromNow(-1), status: 'not-started' }] });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Parent item — Late milestone');
});

// ---------- Overdue/Upcoming rows are clickable ----------
// A user-reported gap: acting on a row here used to mean leaving Dashboard,
// finding the right workstream in Planning, and hunting for the item by
// eye. Each row now opens the item modal directly.

test('an Overdue row for a zero-milestone item opens that item\'s own modal', function () {
  const it = addDashItem({ name: 'Late task', status: 'red', dueDate: isoDaysFromNow(-3) });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, `onclick="openItemModal('${it.id}')"`);
});

test('an Upcoming row for a milestone opens its *parent item\'s* modal, not something keyed by the milestone\'s own id', function () {
  const it = addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Soon', dueDate: isoDaysFromNow(3), status: 'not-started' }] });
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onclick="openItemModal('${it.id}')"`);
  assertNotIncludes(html, `onclick="openItemModal('m1')"`);
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

// ---------- A future-dated actualDate is a plan, not a finished fact ----------
// A user-reported gap: actualDate is sometimes logged ahead of time (a
// planned completion date — the same "sometimes logged ahead of time" case
// isCompletedLate()'s own actualLate flag already accounts for via its own
// `<= todayStr()` gate). The bare `!actualDate` check above used to treat
// ANY actualDate, future or past, as "already finished" and hid it from
// both feeds regardless — silently dropping something genuinely still
// upcoming (or still overdue) the moment anyone logged a forward-looking
// actualDate against it. hasHappened() fixes this by only excluding once
// that date is today or earlier.

test('a milestone due soon with a FUTURE actualDate (a plan, not yet happened) still appears in the Upcoming feed', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Planned early', dueDate: isoDaysFromNow(10), actualDate: isoDaysFromNow(5), status: 'amber' }] });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Planned early');
});

test('an item due soon with a FUTURE actualDate (a plan, not yet happened) still appears in the Upcoming feed', function () {
  addDashItem({ name: 'Planned finish', status: 'amber', dueDate: isoDaysFromNow(10), actualDate: isoDaysFromNow(5) });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Planned finish');
});

// ---------- Overdue also weighs a *revised* (later) actualDate ----------
// A further, explicit user request ("if actual date is newer and not yet
// overdue, do not show as overdue"): once a later actualDate than dueDate
// is logged, the original dueDate is effectively superseded by that revised
// target — being past the stale original date no longer means anything is
// actually late, only missing the *revised* one would. isOverdue()'s own
// `actualDate > dueDate` check is what implements this; it only ever runs
// once hasHappened() has already ruled out a genuinely past actualDate
// (isOverdue() checks that first), so by the time it's reached, an
// actualDate that qualifies is guaranteed to still be ahead of today.

test('a past-due milestone with a revised (later) FUTURE actualDate no longer appears in the Overdue feed — the revised target hasn\'t been missed yet', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Slipping', dueDate: isoDaysFromNow(-3), actualDate: isoDaysFromNow(2), status: 'red' }] });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Slipping');
});

test('a past-due item with a revised (later) FUTURE actualDate no longer appears in the Overdue feed — the revised target hasn\'t been missed yet', function () {
  addDashItem({ name: 'Revised plan', status: 'red', dueDate: isoDaysFromNow(-3), actualDate: isoDaysFromNow(2) });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Revised plan');
});

test('once the revised (later) actualDate itself passes without completion, the item goes back to reading as Overdue', function () {
  addDashItem({ name: 'Revision also missed', status: 'red', dueDate: isoDaysFromNow(-10), actualDate: isoDaysFromNow(-1) });
  renderDashboard();
  // hasHappened() treats an actualDate of yesterday as "already finished" —
  // the field's own canonical meaning ("when it was actually finished") —
  // so this is still excluded from Overdue, just via the hasHappened() path
  // rather than the "revised target still ahead" path. Documented here so
  // the two exclusions' combined behavior at this boundary is explicit.
  assertNotIncludes(document.getElementById('main').innerHTML, 'Revision also missed');
});

test('a milestone whose actualDate is exactly today still counts as already happened, same as isCompletedLate()\'s own convention', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Done today', dueDate: isoDaysFromNow(3), actualDate: todayStr(), status: 'amber' }] });
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Done today');
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

// ---------- Dashboard's own Overview/Dependencies sub-tabs ----------
// A later, explicit user request moved the Dependencies tracker (below)
// into its own tab rather than sharing the page with Overview — the same
// planningTab/reviewTab shape (module-level, UI-only, not persisted).

test('render toggles dashboardModeToolbar only for Dashboard mode, and dashboardToolbar (Exec export) only for the Overview tab', function () {
  mode = 'dashboard'; dashboardTab = 'overview';
  render();
  assertEqual(document.getElementById('dashboardModeToolbar').style.display, '');
  assertEqual(document.getElementById('dashboardToolbar').style.display, '');
  dashboardTab = 'dependencies';
  render();
  assertEqual(document.getElementById('dashboardModeToolbar').style.display, '', 'the sub-tab row itself stays visible on both tabs');
  assertEqual(document.getElementById('dashboardToolbar').style.display, 'none', 'Exec Summary export doesn\'t cover the Dependencies tab\'s own content');
  mode = 'planning';
  render();
  assertEqual(document.getElementById('dashboardModeToolbar').style.display, 'none');
});

test('setDashboardTab switches dashboardTab and toggles each tab button\'s active class', function () {
  mode = 'dashboard';
  setDashboardTab('dependencies');
  assertEqual(dashboardTab, 'dependencies');
  assertTrue(document.getElementById('tabDashboardDependencies').classList.contains('active'));
  assertFalse(document.getElementById('tabDashboardOverview').classList.contains('active'));
  setDashboardTab('overview');
  assertEqual(dashboardTab, 'overview');
  assertTrue(document.getElementById('tabDashboardOverview').classList.contains('active'));
});

test('renderDashboard shows the Overview content (cards, per-workstream summary) only on the Overview tab', function () {
  addDashItem({ name: 'Any item' });
  dashboardTab = 'overview';
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'Per-workstream summary');
  dashboardTab = 'dependencies';
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'Per-workstream summary', 'Overview content must not leak into the Dependencies tab');
});

// ---------- Dependencies tracker ----------
// A dedicated cross-workstream tracker for items flagged dependency:true —
// an explicit user request, later moved into its own Dashboard sub-tab
// (dashboardTab === 'dependencies') rather than sharing the page with
// Overview. Distinct from Planning's own per-workstream Dependencies
// sub-section, which lists every dependency item regardless of completion,
// since it's a structural grouping, not an attention feed.

test('computeDashboardData dependencies lists every scoped, still-open item flagged dependency:true, sorted soonest-due-first', function () {
  addDashItem({ name: 'Later dep', dependency: true, dueDate: isoDaysFromNow(10) });
  addDashItem({ name: 'Sooner dep', dependency: true, dueDate: isoDaysFromNow(2) });
  addDashItem({ name: 'Not a dependency', dependency: false });
  const { dependencies } = computeDashboardData();
  assertEqual(dependencies.length, 2);
  assertEqual(dependencies[0].label, 'Sooner dep');
  assertEqual(dependencies[1].label, 'Later dep');
});

test('dependencies excludes a dependency item once its status is complete', function () {
  addDashItem({ name: 'Done dep', dependency: true, status: 'complete' });
  const { dependencies } = computeDashboardData();
  assertEqual(dependencies.length, 0);
});

test('a dependency entry carries its workstream name, SPOC, due date, status, and an overdue flag', function () {
  const it = addDashItem({ name: 'Vendor delivery', dependency: true, dependencySpoc: 'Jane Vendor', dueDate: isoDaysFromNow(-3), status: 'red' });
  const { dependencies } = computeDashboardData();
  const d = dependencies[0];
  assertEqual(d.itemId, it.id);
  assertEqual(d.workstreamName, workstreams[0].name);
  assertEqual(d.spoc, 'Jane Vendor');
  assertEqual(d.status, 'red');
  assertTrue(d.overdue);
});

test('a dependency entry with no SPOC recorded is not flagged overdue if not actually overdue', function () {
  addDashItem({ name: 'Future dep', dependency: true, dependencySpoc: null, dueDate: isoDaysFromNow(5) });
  const { dependencies } = computeDashboardData();
  assertEqual(dependencies[0].spoc, null);
  assertFalse(dependencies[0].overdue);
});

test('renderDashboard\'s Dependencies tab renders a clickable row per dependency, with a header and an overdue-flagged due date', function () {
  const it = addDashItem({ name: 'Vendor delivery', dependency: true, dependencySpoc: 'Jane Vendor', dueDate: isoDaysFromNow(-3), status: 'red' });
  dashboardTab = 'dependencies';
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'dash-dep-header');
  assertIncludes(html, 'Vendor delivery');
  assertIncludes(html, 'Jane Vendor');
  assertIncludes(html, `onclick="openItemModal('${it.id}')"`);
  assertIncludes(html, 'color:var(--stat-red)'); // overdue due-date styling
});

test('renderDashboard\'s Dependencies tab shows a "No open dependencies." placeholder when nothing is flagged', function () {
  addDashItem({ name: 'Plain item', dependency: false });
  dashboardTab = 'dependencies';
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'No open dependencies.');
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
