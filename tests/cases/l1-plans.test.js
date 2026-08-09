// ---------- L1 Plans ----------
// Overarching, high-level plans that sit above every workstream — an
// explicit user request ("define overaching, high-level plans ('L1
// plans'). I would then [want] the option to link the workstream
// milestones to the L1 milestones"). Not a new top-level data shape, the
// same reuse-items trick Journeys already established (see "Journeys" in
// CLAUDE.md): a plain item, itemType:'l1plan', workstreamId/categoryId
// always null — but, unlike a Journey/Sub Journey, an L1 Plan keeps a real,
// non-empty, hand-managed `milestones` array (name/dueDate/status, no
// category/template to seed from). This is what lets it ride the
// *existing*, unmodified items/milestones sync+tombstone+merge machinery
// with zero new plumbing.
//
// The link lives on the *workstream* milestone (m.l1MilestoneId), not the
// L1 milestone — mirroring how item.journeyId lives on a scope item, not on
// the Sub Journey it connects to. Many-to-one: a workstream milestone links
// to at most one L1 milestone at a time. Linking is pure traceability —
// confirmed directly with the user — it never computes or changes an L1
// milestone's own status/dates; those stay entirely manual, exactly like
// any other milestone.

function addL1Plan(name) {
  openL1PlanQuickAdd();
  document.getElementById('l1PlanQuickAddInput').value = name || 'New L1 Plan';
  saveL1PlanQuickAdd();
  return items[items.length - 1];
}

function addL1Milestone(planId, name) {
  openL1MilestoneQuickAdd(planId);
  document.getElementById('l1MilestoneQuickAddInput').value = name || 'New L1 Milestone';
  saveL1MilestoneQuickAdd();
  const plan = items.find(it => it.id === planId);
  return plan.milestones[plan.milestones.length - 1];
}

// ---------- Creating an L1 Plan ----------

test('openL1PlanQuickAdd/saveL1PlanQuickAdd creates a correctly-shaped L1 Plan', function () {
  const p = addL1Plan('Digital Transformation');
  assertEqual(p.itemType, 'l1plan');
  assertEqual(p.name, 'Digital Transformation');
  assertEqual(p.workstreamId, null, 'an L1 Plan is overarching — never assigned to a workstream');
  assertEqual(p.categoryId, null, 'an L1 Plan has no category at all');
  assertDeepEqual(p.milestones, []);
  assertEqual(p.status, 'not-started');
});

test('saveL1PlanQuickAdd is a no-op when the name is blank — no item created', function () {
  const before = items.length;
  openL1PlanQuickAdd();
  document.getElementById('l1PlanQuickAddInput').value = '   ';
  saveL1PlanQuickAdd();
  assertEqual(items.length, before);
  assertFalse(l1PlanQuickAddOpen, 'still closes back down even though nothing was created');
});

test('openL1PlanQuickAdd/saveL1PlanQuickAdd are blocked below Editor', function () {
  userRole = 'reviewer';
  const before = items.length;
  openL1PlanQuickAdd();
  assertFalse(l1PlanQuickAddOpen, 'requireRole should have refused before opening the input at all');
  saveL1PlanQuickAdd(); // a stray call with nothing open should also just no-op
  assertEqual(items.length, before);
});

test('cancelL1PlanQuickAdd discards the open input with no item created', function () {
  openL1PlanQuickAdd();
  document.getElementById('l1PlanQuickAddInput').value = 'Abandoned';
  const before = items.length;
  cancelL1PlanQuickAdd();
  assertFalse(l1PlanQuickAddOpen);
  assertEqual(items.length, before);
});

test('allL1Plans returns only itemType:"l1plan" items, sorted by order', function () {
  const p1 = addL1Plan('First');
  const p2 = addL1Plan('Second');
  addL1Plan('Third');
  const plans = allL1Plans();
  assertEqual(plans.length, 3);
  assertEqual(plans[0].id, p1.id);
  assertEqual(plans[1].id, p2.id);
});

// ---------- Inline milestone add ----------

test('openL1MilestoneQuickAdd/saveL1MilestoneQuickAdd adds a real, hand-added milestone to an L1 Plan', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id, 'Phase 1 complete');
  assertEqual(p.milestones.length, 1);
  assertEqual(m.name, 'Phase 1 complete');
  assertEqual(m.dueDate, null, 'no template to seed a date from — always hand-added');
  assertEqual(m.status, 'not-started');
  assertEqual(m.notApplicable, false);
  assertFalse(!!m.l1MilestoneId, 'an L1 milestone never links to another L1 milestone');
});

test('saveL1MilestoneQuickAdd supports adding several milestones to the same L1 Plan, like a scope item\'s own checklist', function () {
  const p = addL1Plan();
  addL1Milestone(p.id, 'Kickoff');
  addL1Milestone(p.id, 'Pilot live');
  addL1Milestone(p.id, 'Full rollout');
  assertEqual(p.milestones.length, 3);
  assertDeepEqual(p.milestones.map(m => m.name), ['Kickoff', 'Pilot live', 'Full rollout']);
});

test('saveL1MilestoneQuickAdd is a no-op when the name is blank', function () {
  const p = addL1Plan();
  openL1MilestoneQuickAdd(p.id);
  document.getElementById('l1MilestoneQuickAddInput').value = '';
  saveL1MilestoneQuickAdd();
  assertEqual(p.milestones.length, 0);
  assertEqual(l1MilestoneQuickAddOpenFor, null);
});

test('openL1MilestoneQuickAdd/saveL1MilestoneQuickAdd are blocked below Editor', function () {
  const p = addL1Plan();
  userRole = 'reviewer';
  openL1MilestoneQuickAdd(p.id);
  assertEqual(l1MilestoneQuickAddOpenFor, null, 'requireRole should have refused before opening the input');
  assertEqual(p.milestones.length, 0);
});

test('cancelL1MilestoneQuickAdd discards the open input with no milestone added', function () {
  const p = addL1Plan();
  openL1MilestoneQuickAdd(p.id);
  document.getElementById('l1MilestoneQuickAddInput').value = 'Abandoned milestone';
  cancelL1MilestoneQuickAdd();
  assertEqual(l1MilestoneQuickAddOpenFor, null);
  assertEqual(p.milestones.length, 0);
});

test('itemRowHtml renders the inline "+ Add Milestone" affordance for an L1 Plan at Editor+, and omits it below Editor', function () {
  const p = addL1Plan();
  toggleItemExpanded(p.id);
  assertIncludes(itemRowHtml(p), 'Add Milestone');
  assertIncludes(itemRowHtml(p), `openL1MilestoneQuickAdd('${p.id}')`);
  userRole = 'reviewer';
  assertNotIncludes(itemRowHtml(p), 'Add Milestone');
});

test('itemRowHtml shows the inline quick-add input in place of the button once openL1MilestoneQuickAdd has been called', function () {
  const p = addL1Plan();
  toggleItemExpanded(p.id);
  openL1MilestoneQuickAdd(p.id);
  const html = itemRowHtml(p);
  assertIncludes(html, 'l1MilestoneQuickAddInput');
  assertIncludes(html, 'saveL1MilestoneQuickAdd()');
});

test('a brand-new L1 Plan with zero milestones still has a real, clickable chevron — a user-reported bug: without one, there was no way to reach "+ Add Milestone" at all for a fresh plan', function () {
  const p = addL1Plan();
  assertEqual(p.milestones.length, 0);
  const html = itemRowHtml(p);
  assertIncludes(html, `onclick="toggleItemExpanded('${p.id}')"`, 'the chevron must be wired to actually expand the row, not render as the dead, non-clickable placeholder a zero-milestone ordinary item gets');
});

test('expanding a zero-milestone L1 Plan (via its own chevron toggle) shows "No milestones yet." plus the "+ Add Milestone" affordance', function () {
  const p = addL1Plan();
  toggleItemExpanded(p.id);
  const html = itemRowHtml(p);
  assertIncludes(html, 'No milestones yet.');
  assertIncludes(html, 'Add Milestone');
});

test('itemRowHtml renders an L1 Plan\'s own milestone rows (name/due/status/linked/delete) when expanded, via the bespoke l1-milestone grid, not the shared milestoneRowsHtml', function () {
  const p = addL1Plan();
  addL1Milestone(p.id, 'Go live');
  toggleItemExpanded(p.id);
  const html = itemRowHtml(p);
  assertIncludes(html, 'l1-milestone-row');
  assertIncludes(html, 'Go live');
  assertIncludes(html, 'cycleL1MilestoneStatus');
});

// ---------- Expanding an L1 milestone to reveal its linked workstream milestones ----------

test('an L1 milestone with no linked workstream milestones has a dead, non-clickable chevron', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  toggleItemExpanded(p.id);
  const html = l1MilestoneRowsHtml(p);
  assertNotIncludes(html, `toggleL1MilestoneExpanded('${m.id}')`);
});

test('an L1 milestone with a linked workstream milestone gets a real, clickable chevron', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2026-09-01', actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, `onclick="toggleL1MilestoneExpanded('${m.id}')"`);
});

test('toggleL1MilestoneExpanded reveals the linked workstream milestone underneath, read-only, and collapses again on a second toggle', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Finance Deliverable' });
  const wm = { id: genId(), name: 'Cutover complete', dueDate: '2026-09-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  let html = l1MilestoneRowsHtml(p);
  assertNotIncludes(html, 'Cutover complete', 'collapsed by default');
  toggleL1MilestoneExpanded(m.id);
  html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'l1-linked-row');
  assertIncludes(html, 'Cutover complete');
  assertIncludes(html, workstreams[0].name, 'names the source workstream, since a linked list can span several');
  assertIncludes(html, 'Finance Deliverable', 'names the source scope item too');
  toggleL1MilestoneExpanded(m.id);
  html = l1MilestoneRowsHtml(p);
  assertNotIncludes(html, 'Cutover complete', 'collapses back on a second toggle');
});

test('l1LinkedRowHtml never renders the linked milestone\'s status/due as an editable control — pure read-only display', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2026-09-01', actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  const html = l1LinkedRowHtml(item, wm);
  assertIncludes(html, 'cursor:default');
  assertNotIncludes(html, 'onclick', 'no click handler at all on the status badge here');
  assertNotIncludes(html, '<input', 'no editable date field here either');
});

test('l1LinkedRowHtml renders Workstream and Scope Item as two separate cells, not one combined "source" cell', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Finance Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  const html = l1LinkedRowHtml(item, wm);
  const matches = html.match(/<span class="l1-linked-source">/g) || [];
  assertEqual(matches.length, 2, 'Workstream and Scope Item each get their own l1-linked-source span');
  assertIncludes(html, `<span class="l1-linked-source">${workstreams[0].name}</span>`);
  assertIncludes(html, `<span class="l1-linked-source">Finance Deliverable</span>`);
});

test('l1LinkedHeaderHtml labels all five columns: Workstream, Scope Item, Milestone, Due, Status', function () {
  const html = l1LinkedHeaderHtml();
  assertIncludes(html, 'l1-linked-header');
  ['Workstream', 'Scope Item', 'Milestone', 'Due', 'Status'].forEach(label => assertIncludes(html, `<span>${label}</span>`));
});

test('l1MilestoneRowsHtml renders the linked-milestone header row once expanded, and omits it while collapsed', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  let html = l1MilestoneRowsHtml(p);
  assertNotIncludes(html, 'l1-linked-header', 'collapsed by default — no header shown yet');
  toggleL1MilestoneExpanded(m.id);
  html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'l1-linked-header');
});

test('l1LinkedRowHtml labels a linked milestone from an Unassigned scope item as "Unassigned", not a stale/missing workstream name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Unassigned deliverable', workstreamId: null });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  const html = l1LinkedRowHtml(item, wm);
  assertIncludes(html, 'Unassigned');
});

// ---------- Status/date roll-up (universal item behavior, not the link) ----------

test('cycleL1MilestoneStatus cycles through STATUSES and recomputes the parent L1 Plan\'s own status — the same universal "item with milestones" roll-up every item gets, unrelated to the link feature\'s own "no rollup" rule', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  assertEqual(m.status, 'not-started');
  cycleL1MilestoneStatus(p.id, m.id);
  assertEqual(m.status, STATUSES[(STATUSES.findIndex(s => s.id === 'not-started') + 1) % STATUSES.length].id);
  assertEqual(p.status, computedStatusFromMilestones(p.milestones));
});

test('cycleL1MilestoneStatus is blocked below Editor', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  userRole = 'reviewer';
  cycleL1MilestoneStatus(p.id, m.id);
  assertEqual(m.status, 'not-started', 'unchanged — the guard should have refused before touching it');
});

test('updateL1MilestoneDateField sets the due date and recomputes the parent L1 Plan\'s own plan-date range', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  updateL1MilestoneDateField(p.id, m.id, '2026-09-01');
  assertEqual(m.dueDate, '2026-09-01');
  assertEqual(p.startDate, '2026-09-01');
  assertEqual(p.dueDate, '2026-09-01');
});

test('updateL1MilestoneDateField is a no-op (no updatedAt bump) when the value equals the field\'s current value', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  updateL1MilestoneDateField(p.id, m.id, '2026-09-01');
  const stamped = m.updatedAt;
  updateL1MilestoneDateField(p.id, m.id, '2026-09-01');
  assertEqual(m.updatedAt, stamped);
});

test('updateL1MilestoneDateField is blocked below Editor', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  userRole = 'reviewer';
  updateL1MilestoneDateField(p.id, m.id, '2026-09-01');
  assertEqual(m.dueDate, null);
});

// ---------- Removing an L1 milestone ----------

test('removeL1Milestone tombstones the milestone via deletedMilestoneIds, same as an ordinary item\'s milestone removal', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  removeL1Milestone(p.id, m.id);
  assertEqual(p.milestones.length, 0);
  assertTrue(deletedMilestoneIds.some(t => t.id === m.id));
});

test('removeL1Milestone clears l1MilestoneId on every workstream milestone that was linked to it, rather than leaving a dangling reference', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneId: m.id };
  item.milestones.push(wm);
  assertEqual(linkedWorkstreamMilestones(m.id).length, 1);
  removeL1Milestone(p.id, m.id);
  assertEqual(wm.l1MilestoneId, null, 'the link is cleaned up immediately, not left to the next normalizeData() self-heal');
});

test('removeL1Milestone recomputes the parent L1 Plan\'s own status/date-range after removal', function () {
  const p = addL1Plan();
  const m1 = addL1Milestone(p.id);
  addL1Milestone(p.id);
  updateL1MilestoneDateField(p.id, m1.id, '2026-09-01');
  cycleL1MilestoneStatus(p.id, m1.id); // not-started -> next status
  removeL1Milestone(p.id, m1.id);
  assertEqual(p.status, computedStatusFromMilestones(p.milestones));
  const range = computedDateRangeFromMilestones(p.milestones);
  assertEqual(p.startDate, range ? range.startDate : null);
  assertEqual(p.dueDate, range ? range.dueDate : null);
});

test('removeL1Milestone is blocked below Editor', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  userRole = 'reviewer';
  removeL1Milestone(p.id, m.id);
  assertEqual(p.milestones.length, 1);
});

// ---------- Linking a workstream milestone to an L1 milestone ----------

test('toggleL1MilestoneLink sets l1MilestoneId on the workstream milestone and stamps updatedAt', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertEqual(wm.l1MilestoneId, m.id);
  assertTrue(wm.updatedAt > 0);
});

test('toggleL1MilestoneLink(false) clears the link', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, false);
  assertEqual(wm.l1MilestoneId, null);
});

test('linking never changes the L1 milestone\'s own status or dates — pure traceability, no rollup, per the explicit design decision', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'red';
  m.dueDate = '2026-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2026-12-31', actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertEqual(m.status, 'red', 'unchanged by the link');
  assertEqual(m.dueDate, '2026-01-01', 'unchanged by the link');
});

test('toggleL1MilestoneLink is blocked below Editor', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  userRole = 'reviewer';
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertEqual(wm.l1MilestoneId, null);
});

test('linkedWorkstreamMilestones returns every workstream milestone linked to a given L1 milestone, excluding L1 Plans\' own milestones entirely', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const otherPlan = addL1Plan('Other plan');
  addL1Milestone(otherPlan.id); // never a candidate for linking to another L1 milestone
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'A', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  const wm2 = { id: genId(), name: 'B', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm1, wm2);
  const linked = linkedWorkstreamMilestones(m.id);
  assertEqual(linked.length, 1);
  assertEqual(linked[0].milestone.id, wm1.id);
});

test('renderL1ConnectList excludes a workstream milestone already linked to a *different* L1 milestone, mirroring renderJourneyConnectList\'s own exclusion', function () {
  const p = addL1Plan();
  const m1 = addL1Milestone(p.id, 'Milestone 1');
  const m2 = addL1Milestone(p.id, 'Milestone 2');
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Claimed elsewhere', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m1.id };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m2.id);
  const html = document.getElementById('l1ConnectList').innerHTML;
  assertNotIncludes(html, 'Claimed elsewhere');
});

test('renderL1ConnectList still includes a milestone already linked to the *same* L1 milestone being managed, pre-checked', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Already linked', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  const html = document.getElementById('l1ConnectList').innerHTML;
  assertIncludes(html, 'Already linked');
  assertIncludes(html, 'checked');
});

test('renderL1ConnectList\'s search box narrows candidates by milestone or scope item name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Finance Migration' });
  const wm1 = { id: genId(), name: 'Cutover complete', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  const wm2 = { id: genId(), name: 'Unrelated step', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm1, wm2);
  openL1ConnectModal(p.id, m.id);
  document.getElementById('l1ConnectSearchInput').value = 'cutover';
  renderL1ConnectList();
  const html = document.getElementById('l1ConnectList').innerHTML;
  assertIncludes(html, 'Cutover complete');
  assertNotIncludes(html, 'Unrelated step');
});

test('closeL1ConnectModal clears the module-level connect state', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  openL1ConnectModal(p.id, m.id);
  closeL1ConnectModal();
  assertEqual(l1ConnectPlanId, null);
  assertEqual(l1ConnectMilestoneId, null);
});

test('findL1Milestone resolves an id to {plan, milestone}, or null when it doesn\'t exist', function () {
  const p = addL1Plan('Traceability plan');
  const m = addL1Milestone(p.id, 'Target milestone');
  const found = findL1Milestone(m.id);
  assertEqual(found.plan.id, p.id);
  assertEqual(found.milestone.id, m.id);
  assertEqual(findL1Milestone('not-a-real-id'), null);
});

// ---------- Read-only linked indicator on the workstream side ----------

test('l1LinkIndicatorHtml is empty for a milestone with no l1MilestoneId', function () {
  const m = { id: genId(), name: 'X', l1MilestoneId: null };
  assertEqual(l1LinkIndicatorHtml(m), '');
});

test('l1LinkIndicatorHtml renders a chain-link icon naming the L1 Plan and milestone once linked', function () {
  const p = addL1Plan('Company OKRs');
  const m = addL1Milestone(p.id, 'Q4 target');
  const wm = { id: genId(), name: 'Ship it', l1MilestoneId: m.id };
  const html = l1LinkIndicatorHtml(wm);
  assertIncludes(html, 'fa-link');
  assertIncludes(html, 'Company OKRs');
  assertIncludes(html, 'Q4 target');
});

test('l1LinkIndicatorHtml is empty (not a broken icon) when the l1MilestoneId no longer resolves to anything real', function () {
  const wm = { id: genId(), name: 'Ship it', l1MilestoneId: 'stale-deleted-id' };
  assertEqual(l1LinkIndicatorHtml(wm), '');
});

test('milestoneRowsHtml appends the linked indicator after a linked milestone\'s own name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  toggleItemExpanded(item.id);
  const html = milestoneRowsHtml(item, null, false);
  assertIncludes(html, 'Ship it');
  assertIncludes(html, 'fa-link');
});

// ---------- normalizeData() backfill ----------

test('normalizeData keeps itemType:"l1plan" and forces categoryId to null, same as Journey/Sub Journey', function () {
  items.push({ id: genId(), name: 'Untouched', itemType: 'l1plan', workstreamId: null, categoryId: categories[0].id, milestones: [], updatedAt: Date.now() });
  normalizeData();
  const p = items.find(it => it.name === 'Untouched');
  assertEqual(p.itemType, 'l1plan');
  assertEqual(p.categoryId, null);
});

test('normalizeData falls an unrecognized itemType back to "scope", never leaving a bogus value on the record', function () {
  items.push({ id: genId(), name: 'Bogus type', itemType: 'not-a-real-type', workstreamId: workstreams[0].id, categoryId: categories[0].id, milestones: [], updatedAt: Date.now() });
  normalizeData();
  assertEqual(items.find(it => it.name === 'Bogus type').itemType, 'scope');
});

test('normalizeData backfills a missing l1MilestoneId on an ordinary milestone to null', function () {
  const item = addItem({ name: 'Deliverable' });
  item.milestones.push({ id: genId(), name: 'M', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now() });
  normalizeData();
  assertEqual(item.milestones[0].l1MilestoneId, null);
});

test('normalizeData resets a stale l1MilestoneId pointing at a deleted L1 Plan/milestone back to null', function () {
  const item = addItem({ name: 'Deliverable' });
  item.milestones.push({ id: genId(), name: 'M', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneId: 'never-existed' });
  normalizeData();
  assertEqual(item.milestones[0].l1MilestoneId, null);
});

test('normalizeData preserves a valid l1MilestoneId that still resolves to a real L1 milestone', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  item.milestones.push({ id: genId(), name: 'M', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneId: m.id });
  normalizeData();
  assertEqual(item.milestones[0].l1MilestoneId, m.id);
});

test('normalizeData forces l1MilestoneId to null on an L1 Plan\'s own milestones — an L1 milestone never links to another L1 milestone', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.l1MilestoneId = 'bogus';
  normalizeData();
  assertEqual(m.l1MilestoneId, null);
});

// ---------- itemRowHtml / mode plumbing ----------

test('itemRowHtml renders a blank tagsHtml for an L1 Plan — IT/Business/Budget tags are not a meaningful concept for a high-level plan', function () {
  const p = addL1Plan();
  const html = itemRowHtml(p);
  assertIncludes(html, '<span class="item-tags"></span>');
});

test('an L1 Plan is excluded from unassignedItemsSorted() — it has its own dedicated page, not the Unassigned bucket', function () {
  const p = addL1Plan();
  const unassigned = unassignedItemsSorted();
  assertFalse(unassigned.some(it => it.id === p.id));
});

test('openItemModal hides Workstream/Category/Milestones fields for an existing L1 Plan opened via Edit', function () {
  const p = addL1Plan('Edit me');
  openItemModal(p.id);
  assertEqual(editingItemType, 'l1plan');
  assertEqual(document.getElementById('itemWorkstreamField').style.display, 'none');
  assertEqual(document.getElementById('itemCategoryField').style.display, 'none');
  assertEqual(document.getElementById('itemMilestonesField').style.display, 'none');
  assertDeepEqual(editingMilestones, [], 'milestones are managed inline on the L1 Plans page, never through this modal\'s editor');
});

test('setMode("l1plans") shows #l1PlansBody and hides #scopedBody/#adminBody', function () {
  setMode('l1plans');
  assertEqual(mode, 'l1plans');
  assertEqual(document.getElementById('l1PlansBody').style.display, '');
  assertEqual(document.getElementById('scopedBody').style.display, 'none');
});

test('renderL1Plans shows "No L1 Plans yet." when there are none', function () {
  setMode('l1plans');
  renderL1Plans();
  assertIncludes(document.getElementById('l1PlansBody').innerHTML, 'No L1 Plans yet.');
});

test('renderL1Plans lists every L1 Plan via itemRowHtml, in one flat (not per-workstream) list', function () {
  addL1Plan('Alpha initiative');
  addL1Plan('Beta initiative');
  setMode('l1plans');
  renderL1Plans();
  const html = document.getElementById('l1PlansBody').innerHTML;
  assertIncludes(html, 'Alpha initiative');
  assertIncludes(html, 'Beta initiative');
});

// ---------- Sync/merge: rides the existing items/milestones machinery for free ----------

test('buildIndexPayload includes an L1 Plan and its milestones — workstreamId:null puts it in the index\'s own items array, no new sync code needed', function () {
  const p = addL1Plan('Synced plan');
  addL1Milestone(p.id, 'Synced milestone');
  const payload = buildIndexPayload();
  const found = payload.items.find(it => it.id === p.id);
  assertTrue(!!found, 'an L1 Plan must ride along in the index, same as an Unassigned item or a Journey');
  assertEqual(found.milestones.length, 1);
  assertEqual(found.milestones[0].name, 'Synced milestone');
});

test('an L1 Plan round-trips correctly through buildIndexPayload()/recombineSyncData() with no data loss', function () {
  const p = addL1Plan('Round trip plan');
  addL1Milestone(p.id, 'Round trip milestone');
  const indexData = JSON.parse(JSON.stringify(buildIndexPayload()));
  const recombined = recombineSyncData(indexData, {});
  const found = recombined.items.find(it => it.id === p.id);
  assertTrue(!!found);
  assertEqual(found.itemType, 'l1plan');
  assertEqual(found.milestones[0].name, 'Round trip milestone');
});

test('a tombstoned L1 milestone sweeps correctly via the existing, unmodified mergeMilestonesArray()/mergeData() sweep — no new merge code needed', function () {
  const p = addL1Plan('Sweep plan');
  const m = addL1Milestone(p.id, 'To be deleted elsewhere');
  lastSyncedAt = Date.now() - 1000;
  removeL1Milestone(p.id, m.id);
  const tomb = deletedMilestoneIds.find(t => t.id === m.id);
  assertTrue(!!tomb);
  // Simulate an incoming copy of this same L1 Plan that still has the
  // milestone — the sweep in mergeMilestonesArray() should drop it locally
  // since the tombstone is newer than the milestone's own last edit.
  const incomingPlan = { ...p, updatedAt: Date.now() + 1, milestones: [{ ...m, l1MilestoneId: null }] };
  mergeData({ programme, workstreams: [], categories: [], items: [incomingPlan], deletedWorkstreamIds: [], deletedItemIds: [], deletedMilestoneIds: [], deletedActionLogIds: [], deletedDecisionLogIds: [], deletedReviewCycleIds: [] });
  const merged = items.find(it => it.id === p.id);
  assertEqual(merged.milestones.length, 0, 'the tombstone must win — a stale incoming copy should not resurrect the deleted L1 milestone');
});
