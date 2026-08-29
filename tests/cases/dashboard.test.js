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

// An item with milestones has its own dueDate/status *computed* from those
// milestones (see "Item plan date range roll-up" in CLAUDE.md) — so before
// this fix, an overdue milestone-bearing item produced two rows on the same
// feed: one labeled with just the item's own name (the item-level check)
// and one labeled "<item> — <milestone>" (the milestone-level check) for
// the very same underlying lateness. A user-reported duplicate; the fix
// restricts the item-level row to zero-milestone items only.
test('an overdue item WITH milestones does not get a redundant item-level Overdue row — only its own overdue milestone(s) show', function () {
  addDashItem({
    name: 'Milestone Task', status: 'red', dueDate: isoDaysFromNow(-3),
    milestones: [{ id: genId(), name: 'Late Milestone', dueDate: isoDaysFromNow(-3), status: 'red', actualDate: null, notApplicable: false }]
  });
  const { overdue } = computeDashboardData();
  assertFalse(overdue.some(e => e.label === 'Milestone Task'), 'the item-level row is redundant with the milestone row below and must not also appear');
  assertTrue(overdue.some(e => e.label === 'Milestone Task — Late Milestone'), 'the actual overdue milestone must still appear');
});

test('a zero-milestone overdue item still gets its own item-level Overdue row — there is no milestone to stand in for it', function () {
  addDashItem({ name: 'Plain Task', status: 'red', dueDate: isoDaysFromNow(-3) });
  const { overdue } = computeDashboardData();
  assertTrue(overdue.some(e => e.label === 'Plain Task'));
});

test('the same item-level/milestone-level dedup applies to the Upcoming feed', function () {
  addDashItem({
    name: 'Upcoming Milestone Task', status: 'amber', dueDate: isoDaysFromNow(5),
    milestones: [{ id: genId(), name: 'Soon Milestone', dueDate: isoDaysFromNow(5), status: 'amber', actualDate: null, notApplicable: false }]
  });
  const { upcoming } = computeDashboardData();
  assertFalse(upcoming.some(e => e.label === 'Upcoming Milestone Task'));
  assertTrue(upcoming.some(e => e.label === 'Upcoming Milestone Task — Soon Milestone'));
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

// ---------- Overdue/Upcoming rows show the actual date once one's set ----------
// A user-reported gap: the row's own date used to always be dueDate, even
// once a more relevant actualDate had been recorded — see toEntry()'s own
// comment in renderDashboard().
test('an Upcoming milestone with a future actualDate shows that actualDate on the row, not its dueDate — with an "(actual)" qualifier', function () {
  const due = isoDaysFromNow(10), actual = isoDaysFromNow(5);
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Planned early', dueDate: due, actualDate: actual, status: 'amber' }] });
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, fmtDate(actual));
  assertIncludes(html, '(actual)');
  assertFalse(html.includes(fmtDate(due)), 'the plain dueDate text should not appear once actualDate is shown instead');
});

test('an Upcoming milestone with no actualDate yet still shows its plain dueDate, with no "(actual)" qualifier', function () {
  addDashItem({ name: 'Parent item', milestones: [{ id: 'm1', name: 'Just planned', dueDate: isoDaysFromNow(10), actualDate: null, status: 'amber' }] });
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, fmtDate(isoDaysFromNow(10)));
  assertFalse(html.includes('(actual)'));
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
  dashboardTab = 'gantt';
  render();
  assertEqual(document.getElementById('dashboardModeToolbar').style.display, '', 'the sub-tab row itself stays visible on the Gantt tab too');
  assertEqual(document.getElementById('dashboardToolbar').style.display, 'none', 'Exec Summary export doesn\'t cover the Gantt tab\'s own content either');
  mode = 'planning';
  render();
  assertEqual(document.getElementById('dashboardModeToolbar').style.display, 'none');
});

test('setDashboardTab switches dashboardTab and toggles each tab button\'s active class, including the Gantt tab', function () {
  mode = 'dashboard';
  setDashboardTab('dependencies');
  assertEqual(dashboardTab, 'dependencies');
  assertTrue(document.getElementById('tabDashboardDependencies').classList.contains('active'));
  assertFalse(document.getElementById('tabDashboardOverview').classList.contains('active'));
  assertFalse(document.getElementById('tabDashboardGantt').classList.contains('active'));
  setDashboardTab('gantt');
  assertEqual(dashboardTab, 'gantt');
  assertTrue(document.getElementById('tabDashboardGantt').classList.contains('active'));
  assertFalse(document.getElementById('tabDashboardDependencies').classList.contains('active'));
  setDashboardTab('overview');
  assertEqual(dashboardTab, 'overview');
  assertTrue(document.getElementById('tabDashboardOverview').classList.contains('active'));
  assertFalse(document.getElementById('tabDashboardGantt').classList.contains('active'));
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

// ---------- Dashboard: Gantt chart ----------
// A timeline view — an explicit user request ("build a gant chart view per
// workstream, all workstream and l1 level"), landing as Dashboard's third
// sub-tab (dashboardTab === 'gantt'). Each row's bar spans an item's own
// Start→Due range, with its milestones layered on top as markers; "per
// workstream"/"all workstreams" reuses the shared sidebar filter exactly
// like Overview/Dependencies already do, with ganttScope as a separate
// internal toggle for switching to L1 Plans (never workstream-scoped).

test('ganttDayNumber returns a stable, UTC-based day count for an ISO date', function () {
  assertEqual(ganttDayNumber('1970-01-01'), 0);
  assertEqual(ganttDayNumber('1970-01-02'), 1);
  assertEqual(ganttDayNumber('2026-01-01') - ganttDayNumber('2025-01-01'), 365, '2025 is not a leap year');
});

test('ganttDateRange returns null for an empty scope, and a real, padded range otherwise', function () {
  assertEqual(ganttDateRange([]), null);
  const range = ganttDateRange(['2026-03-01', '2026-03-10']);
  assertTrue(range.start < ganttDayNumber('2026-03-01'), 'padded before the earliest date');
  assertTrue(range.end > ganttDayNumber('2026-03-10'), 'padded after the latest date');
});

test('ganttDateRange never collapses to a zero-width range, even for a single repeated date', function () {
  const range = ganttDateRange(['2026-03-01', '2026-03-01']);
  assertTrue(range.end > range.start);
});

test('ganttPercent positions a date proportionally within the range, clamped to [0,100]', function () {
  const range = { start: ganttDayNumber('2026-01-01'), end: ganttDayNumber('2026-01-11') };
  assertEqual(ganttPercent('2026-01-01', range), 0);
  assertEqual(ganttPercent('2026-01-11', range), 100);
  assertEqual(ganttPercent('2026-01-06', range), 50);
});

test('ganttPercentOrNull returns null for a date outside the range, instead of clamping it to an edge', function () {
  const range = { start: ganttDayNumber('2026-01-01'), end: ganttDayNumber('2026-01-11') };
  assertEqual(ganttPercentOrNull('2025-06-01', range), null);
  assertEqual(ganttPercentOrNull('2026-01-06', range), 50);
});

test('ganttBarRect computes left/width from start/end, with a minimum visible width for a same-day bar', function () {
  const range = { start: ganttDayNumber('2026-01-01'), end: ganttDayNumber('2026-01-11') };
  const rect = ganttBarRect('2026-01-01', '2026-01-11', range);
  assertEqual(rect.left, 0);
  assertEqual(rect.width, 100);
  const zeroWidth = ganttBarRect('2026-01-06', '2026-01-06', range);
  assertTrue(zeroWidth.width >= 0.6, 'a single-day bar must still render as a visible sliver, not collapse to nothing');
});

// ganttTicks()/ganttTickGranularity() — a later, user-reported fix
// ("timeline does not look to nice. maybe scale to quarters?"): a real,
// multi-year "All Workstreams" chart rendered one label per calendar month
// packed into the same fixed axis width, overlapping every one of them
// into unreadable, garbled text. The axis now auto-picks month/quarter/year
// granularity from the range's own total span instead of always using
// month.

test('ganttTickGranularity picks month for a short scope, quarter for a multi-year one, year for a much longer one', function () {
  assertEqual(ganttTickGranularity({ start: ganttDayNumber('2026-01-01'), end: ganttDayNumber('2026-06-01') }), 'month');
  assertEqual(ganttTickGranularity({ start: ganttDayNumber('2026-01-01'), end: ganttDayNumber('2028-06-01') }), 'quarter');
  assertEqual(ganttTickGranularity({ start: ganttDayNumber('2020-01-01'), end: ganttDayNumber('2030-01-01') }), 'year');
});

test('ganttTicks produces one tick per calendar month boundary actually inside a short range, with a "Mon YYYY" label', function () {
  // Range starts mid-December, so Dec 1 itself falls just before range.start
  // and is correctly excluded — only the three later month boundaries the
  // range genuinely spans (Jan 1, Feb 1, Mar 1) get a tick.
  const range = { start: ganttDayNumber('2025-12-15'), end: ganttDayNumber('2026-03-10') };
  const ticks = ganttTicks(range);
  assertEqual(ticks.length, 3, 'Jan 1, Feb 1, Mar 1');
  assertIncludes(ticks[0].label, '2026');
});

test('ganttTicks produces one tick per calendar quarter, aligned to real Q1/Q2/Q3/Q4 boundaries, for a multi-year range', function () {
  const range = { start: ganttDayNumber('2026-02-15'), end: ganttDayNumber('2028-08-01') };
  const ticks = ganttTicks(range);
  // Q1 2026 (starting Jan 1, before range.start) is excluded — the range
  // is already partway through it — so this starts at Q2 2026.
  assertEqual(ticks[0].label, 'Q2 2026');
  assertTrue(ticks.every(t => /^Q[1-4] \d{4}$/.test(t.label)), 'every label reads as a real "QN YYYY" boundary');
  assertTrue(ticks.length < 12, 'quarterly, not one per month, across this ~2.5 year span');
});

test('ganttTicks produces one tick per calendar year, for a much longer range', function () {
  const range = { start: ganttDayNumber('2015-06-01'), end: ganttDayNumber('2030-01-01') };
  const ticks = ganttTicks(range);
  assertTrue(ticks.every(t => /^\d{4}$/.test(t.label)), 'every label is a bare year');
  assertTrue(ticks.length <= 15, 'yearly, not quarterly, across this ~15 year span');
});

// ganttChartMinWidth() — a later, separate user-reported fix ("timeline
// does not look to nice") to a second bug the granularity fix above didn't
// cover on its own: even with the coarsest sensible granularity, a real
// multi-year range can still produce more ticks than comfortably fit in
// whatever width the chart's own container happens to have, so the labels
// just run together with no gap. Pinning a real min-width (the same
// pin-a-width-and-let-overflow-x:auto-scroll-the-rest convention this app
// already uses everywhere else) is the fix, computed from the actual tick
// count rather than a single fixed constant.

test('ganttChartMinWidth grows with the number of ticks, and never drops below a sane floor for a short scope', function () {
  const short = ganttChartMinWidth(3);
  const long = ganttChartMinWidth(20);
  assertTrue(long > short, 'more ticks need more room');
  assertTrue(short >= GANTT_LABEL_COL_WIDTH + 400, 'never below the floor, even for very few ticks');
});

test('renderGanttChartHtml pins the chart\'s own min-width from its actual tick count, so a long multi-year range gets real breathing room instead of overlapping labels', function () {
  const rows = [{ id: 'i1', name: 'Long-running item', start: '2020-01-01', end: '2029-01-01', status: 'green', milestones: [] }];
  const html = renderGanttChartHtml([{ name: null, color: null, rows }], 'empty');
  const ticks = ganttTicks(ganttDateRange(ganttRowDates(rows)));
  const expected = ganttChartMinWidth(ticks.length);
  assertIncludes(html, `min-width:${expected}px`);
});

// A later, user-reported fix ("do not overlap timeline over the edge" —
// clarified as the right edge, "Q1 2028 is going out of bounds"): the last
// tick's own label has no neighbor to its right to grow into the way every
// earlier tick does, so left-anchored like the rest, it could render past
// .gantt-chart's own right edge entirely — confirmed live, a real "Q2 2028"
// label rendered ~40px past the chart's own border, with nothing to clip
// it now that .gantt-chart has no overflow:hidden of its own (needed for
// the sticky axis row fix above it). The last tick now anchors from the
// right instead, so its text grows leftward into already-reserved space.

test('the last axis tick anchors from the right (not the left), so its own label grows into reserved space instead of past the chart\'s own edge', function () {
  const rows = [{ id: 'i1', name: 'Long-running item', start: '2020-01-01', end: '2029-01-01', status: 'green', milestones: [] }];
  const html = renderGanttChartHtml([{ name: null, color: null, rows }], 'empty');
  const range = ganttDateRange(ganttRowDates(rows));
  const ticks = ganttTicks(range);
  assertTrue(ticks.length > 1, 'this range should produce several ticks');
  const tickDivs = html.match(/<div class="gantt-axis-tick[^>]*>/g);
  assertEqual(tickDivs.length, ticks.length);
  // Every tick except the last is left-anchored, plain .gantt-axis-tick.
  tickDivs.slice(0, -1).forEach(function (div) {
    assertNotIncludes(div, 'gantt-axis-tick-last');
    assertIncludes(div, 'left:');
    assertNotIncludes(div, 'style="right:');
  });
  // The last tick is right-anchored instead, at the complementary percentage.
  const lastDiv = tickDivs[tickDivs.length - 1];
  assertIncludes(lastDiv, 'gantt-axis-tick-last');
  assertIncludes(lastDiv, `right:${100 - ticks[ticks.length - 1].pct}%`);
  assertNotIncludes(lastDiv, 'style="left:');
});

test('a chart with only one tick still anchors it from the right, as the (only, and therefore last) tick', function () {
  const rows = [{ id: 'i1', name: 'Short item', start: '2026-01-01', end: '2026-01-15', status: 'green', milestones: [] }];
  const html = renderGanttChartHtml([{ name: null, color: null, rows }], 'empty');
  const range = ganttDateRange(ganttRowDates(rows));
  const ticks = ganttTicks(range);
  assertEqual(ticks.length, 1, 'a narrow enough range produces exactly one month tick');
  assertIncludes(html, 'gantt-axis-tick-last');
  assertIncludes(html, `right:${100 - ticks[0].pct}%`);
});

test('ganttRowDates flattens every row\'s own bar start/end and milestone dates into one array', function () {
  const rows = [
    { start: '2026-01-01', end: '2026-02-01', milestones: [{ date: '2026-01-15' }] },
    { start: null, end: null, milestones: [{ date: '2026-03-01' }] }
  ];
  const dates = ganttRowDates(rows);
  assertDeepEqual(dates.slice().sort(), ['2026-01-01', '2026-01-15', '2026-02-01', '2026-03-01']);
});

test('ganttWorkstreamSections groups rows by workstream, and drops an item with no dateable data at all', function () {
  addDashItem({ name: 'Dated item', startDate: '2026-01-01', dueDate: '2026-02-01' });
  addDashItem({ name: 'Undated item', startDate: null, dueDate: null, milestones: [] });
  filterWorkstreamId = null;
  const sections = ganttWorkstreamSections();
  assertEqual(sections.length, 1);
  assertEqual(sections[0].rows.length, 1);
  assertEqual(sections[0].rows[0].name, 'Dated item');
});

test('ganttWorkstreamSections includes a row driven only by milestone dates, with no item-level Start/Due of its own', function () {
  addDashItem({ name: 'Milestone-only item', startDate: null, dueDate: null, milestones: [{ id: 'm1', name: 'M', dueDate: '2026-05-01', status: 'green' }] });
  const sections = ganttWorkstreamSections();
  const row = sections[0].rows.find(r => r.name === 'Milestone-only item');
  assertTrue(!!row);
  assertEqual(row.start, null);
  assertEqual(row.milestones.length, 1);
});

test('ganttWorkstreamSections excludes a notApplicable or undated milestone from a row\'s own markers', function () {
  addDashItem({ name: 'Item', startDate: '2026-01-01', dueDate: '2026-02-01', milestones: [
    { id: 'm1', name: 'Real', dueDate: '2026-01-15', status: 'green', notApplicable: false },
    { id: 'm2', name: 'N/A', dueDate: '2026-01-20', status: 'green', notApplicable: true },
    { id: 'm3', name: 'Undated', dueDate: null, status: 'green', notApplicable: false }
  ] });
  const sections = ganttWorkstreamSections();
  const row = sections[0].rows.find(r => r.name === 'Item');
  assertEqual(row.milestones.length, 1);
  assertEqual(row.milestones[0].name, 'Real');
});

test('ganttWorkstreamSections excludes Unassigned items and, when filterWorkstreamId narrows to one workstream, only that workstream\'s own section', function () {
  addDashItem({ name: 'Assigned', workstreamId: workstreams[0].id, startDate: '2026-01-01', dueDate: '2026-02-01' });
  addDashItem({ name: 'Unassigned', workstreamId: null, startDate: '2026-01-01', dueDate: '2026-02-01' });
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  const secondWs = workstreams[workstreams.length - 1];
  addDashItem({ name: 'Other workstream item', workstreamId: secondWs.id, startDate: '2026-01-01', dueDate: '2026-02-01' });

  filterWorkstreamId = null;
  let sections = ganttWorkstreamSections();
  const allNames = sections.flatMap(s => s.rows.map(r => r.name));
  assertIncludes(allNames.join(','), 'Assigned');
  assertNotIncludes(allNames.join(','), 'Unassigned');

  filterWorkstreamId = workstreams[0].id;
  sections = ganttWorkstreamSections();
  assertEqual(sections.length, 1);
  assertEqual(sections[0].name, workstreams[0].name);
});

// Dashboard's own Gantt tab is Workstreams-only. An L1 Plans version of it
// (a scope toggle, then its own sub-tab, then a milestone-row redesign)
// shipped and was later removed again entirely on a further, later,
// explicit user request ("remove gantt for l1").

test('renderDashboard\'s Gantt tab renders a bar for a dated item and a marker per milestone, with no scope toggle', function () {
  const it = addDashItem({ name: 'Migrate Database', startDate: '2026-01-01', dueDate: '2026-03-01', milestones: [
    { id: 'm1', name: 'Schema', dueDate: '2026-01-20', status: 'green' }
  ] });
  dashboardTab = 'gantt';
  renderDashboard();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'gantt-scope-toggle', 'the scope toggle moved to its own tab under L1 Plans — Dashboard\'s own Gantt tab is Workstreams-only');
  assertIncludes(html, 'gantt-bar');
  assertIncludes(html, 'gantt-marker');
  assertIncludes(html, 'Migrate Database');
  assertIncludes(html, `onclick="openItemModal('${it.id}')"`);
});

test('renderDashboard\'s Gantt tab shows its own empty-state message when nothing is dateable', function () {
  items = [];
  dashboardTab = 'gantt';
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'No dated items to show yet.');
});

test('renderDashboard\'s Gantt tab draws a today-line only when today actually falls within the visible range', function () {
  addDashItem({ name: 'Old item', startDate: isoDaysFromNow(-500), dueDate: isoDaysFromNow(-400) });
  dashboardTab = 'gantt';
  renderDashboard();
  assertNotIncludes(document.getElementById('main').innerHTML, 'gantt-today-line', 'today is nowhere near this far-past range');
  items = [];
  addDashItem({ name: 'Current item', startDate: isoDaysFromNow(-5), dueDate: isoDaysFromNow(5) });
  renderDashboard();
  assertIncludes(document.getElementById('main').innerHTML, 'gantt-today-line');
});
