// ---------- L1 Plans ----------
// Overarching, high-level plans that sit above every workstream — an
// explicit user request ("define overaching, high-level plans ('L1
// plans'). I would then [want] the option to link the workstream
// milestones to the L1 milestones"). Not a new top-level data shape — a
// plain item, itemType:'l1plan', workstreamId/categoryId always null — but
// it keeps a real, non-empty, hand-managed `milestones` array
// (name/dueDate/status, no category/template to seed from). This is what
// lets it ride the *existing*, unmodified items/milestones
// sync+tombstone+merge machinery with zero new plumbing.
//
// The link lives on the *workstream* milestone (m.l1MilestoneId), not the
// L1 milestone. Many-to-one: a workstream milestone links to at most one
// L1 milestone at a time. Linking is pure traceability —
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

// ---------- No Plan-dates column at all on the L1 Plan's own row ----------
// A later, explicit user request ("remove due on L1 level"), reversing
// this row's own brief prior stint showing a single, discrete Due value
// there (itself a reversal of the original Start->Due range). The column
// still renders as a real, empty element — never omitted, since an
// omitted cell would collapse the shared --item-grid-cols column and
// misalign everything after it (see "Column layout is a real CSS grid" in
// CLAUDE.md) — it just has nothing in it. it.startDate/dueDate are still
// computed and stored by the universal "item with milestones" roll-up,
// completely unrelated to what this row chooses to display.

test('an L1 Plan\'s own row shows a bare, empty Plan-dates cell — no Due value, no Start->Due range, no date input at all', function () {
  const p = addL1Plan();
  const html = itemRowHtml(p);
  assertNotIncludes(html, 'updateItemDateField', 'no editable date field of any kind on this row');
  assertNotIncludes(html, 'item-dates-computed', 'no computed date text either');
  assertNotIncludes(html, 'item-dates-arrow');
});

test('the empty Plan-dates cell still renders as a real element, not omitted — an omitted cell would collapse the shared grid column', function () {
  const p = addL1Plan();
  const html = itemRowHtml(p);
  assertIncludes(html, '<span></span>');
});

test('an L1 Plan\'s own dueDate/startDate are still computed from its milestones by the universal roll-up, even though nothing on the row displays them', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  updateL1MilestoneDateField(p.id, m.id, '2026-11-20');
  assertEqual(p.dueDate, '2026-11-20', 'the universal item roll-up still computes this, unrelated to what the row shows');
  const html = itemRowHtml(p);
  assertNotIncludes(html, '2026-11-20', 'but it never appears anywhere on the row itself');
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

// ---------- Connect icon + linked-count badge next to the name ----------
// A later, explicit user request ("replace the big linking item, with a
// simple like item (like the delete icon). move the information of how
// many milestones are linked next to the l1 milestone name") — the pill
// button showing "N linked"/"Connect" text was replaced with a plain
// icon-only .row-icon-btn, matching Delete's own treatment right next to
// it; the "how many are linked" count moved to a small badge right after
// the milestone's own name instead.

test('the connect action is a plain icon-only button (no "N linked"/"Connect" text), matching Delete\'s own .row-icon-btn treatment', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, `onclick="openL1ConnectModal('${p.id}','${m.id}')"`);
  assertNotIncludes(html, 'Connect workstream milestones to this one">\n          <i class="fa-solid fa-link"></i> Connect', 'the old text-bearing pill markup must be gone');
  assertNotIncludes(html, '>Connect<');
  assertNotIncludes(html, 'l1-milestone-link-btn', 'the old pill class is gone entirely');
});

test('the connect icon renders below Editor as a bare, empty placeholder — same as Delete\'s own below-Editor treatment', function () {
  const p = addL1Plan();
  addL1Milestone(p.id);
  userRole = 'reviewer';
  const html = l1MilestoneRowsHtml(p);
  assertNotIncludes(html, 'openL1ConnectModal');
});

test('the milestone name shows a small "N linked" badge right next to it once anything is linked, and nothing extra when it isn\'t', function () {
  const p = addL1Plan();
  const m1 = addL1Milestone(p.id, 'Unlinked milestone');
  const m2 = addL1Milestone(p.id, 'Linked milestone');
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m2.id };
  item.milestones.push(wm);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, `<span>Unlinked milestone</span>`, 'no badge at all when nothing is linked');
  assertIncludes(html, `Linked milestone<span class="l1-milestone-linked-count">1 linked</span>`);
});

test('the "N linked" badge reflects the real linked count, not just 0-vs-1', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'A', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  const wm2 = { id: genId(), name: 'B', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm1, wm2);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, '<span class="l1-milestone-linked-count">2 linked</span>');
});

test('l1MilestoneHeaderHtml no longer labels the connect column — it\'s a plain icon action now, same as the unlabeled Delete column beside it', function () {
  const html = l1MilestoneHeaderHtml();
  assertNotIncludes(html, '>Linked<');
});

// ---------- Aligning the action columns across all three nesting levels ----------
// A later, explicit user request ("align all action columns (L1 plan, L1
// mielstone, connected mielstones)") — Connect+Delete now share a single
// 56px .l1-milestone-actions cluster, matching the shared item grid's own
// 56px Actions column width; the connected/linked milestone row has no
// real actions of its own but still reserves a matching, blank trailing
// 56px cell purely so its own right edge lines up with the other two.

test('Connect and Delete share one .l1-milestone-actions cluster, not two separate grid cells', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'l1-milestone-actions');
  const clusterStart = html.indexOf('l1-milestone-actions');
  const clusterEnd = html.indexOf('</span>', html.indexOf(`onclick="removeL1Milestone('${p.id}','${m.id}')"`, clusterStart));
  const cluster = html.slice(clusterStart, clusterEnd);
  assertIncludes(cluster, 'openL1ConnectModal');
  assertIncludes(cluster, 'removeL1Milestone');
});

// A user-reported "why is there space next to actions? ... delete it"
// reversed a prior attempt that reproduced the L1 Plan row's own oversized
// Actions gap (120px Actions + 116px spacer, borrowed from --item-grid-cols'
// .journeys-list override, itself sized for Journeys' own 4-icon worst
// case) on the bespoke L1 Milestone/linked rows too. A follow-up user
// report ("now l1 is not aligned again") caught that simply deleting the
// spacer broke alignment outright — renderL1Plans() then switched to its
// own dedicated .l1-plans-list override, correctly sized for L1 Plans' own
// 3-icon Actions column. That pass mistakenly treated --item-grid-cols'
// 9th value (100px, Tags) as Status and its 10th value (116px, the real
// Status) as "a blank spacer before Actions" — Status and Actions are
// actually directly adjacent in the real grid, no blank column between
// them at all (see "Column layout is a real CSS grid" in CLAUDE.md for the
// authoritative 11-column list) — which is what led to a spurious 10px
// spacer being added here too. Fixed: Status is 116px everywhere (not
// 100px), and there's no spacer anywhere — Status sits directly next to
// Actions (or the blank alignment cell, on .l1-linked-row) on all three
// nesting levels, matching the shared grid's own real adjacency.

test('l1LinkedHeaderHtml/l1LinkedRowHtml carry exactly one small, deliberately blank trailing cell, directly after Status — matching .l1-milestone-row\'s own real Actions width, no spacer', function () {
  const headerHtml = l1LinkedHeaderHtml();
  assertEqual((headerHtml.match(/<span/g) || []).length, 7, 'six real columns (Workstream/Scope Item/Milestone/Due/Actual/Status) plus one blank alignment cell');
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  const rowHtml = l1LinkedRowHtml(item, wm);
  assertEqual((rowHtml.match(/<span/g) || []).length, 7, 'six real columns plus one blank alignment cell');
  assertIncludes(rowHtml, '      <span></span>\n    </div>', 'the trailing cell is genuinely empty, not a hidden action');
});

test('l1MilestoneHeaderHtml/l1MilestoneRowsHtml carry no spacer between Status and Actions — Status still sits directly adjacent to Actions, matching the shared grid\'s own real adjacency', function () {
  const p = addL1Plan();
  addL1Milestone(p.id);
  const headerHtml = l1MilestoneHeaderHtml();
  assertEqual((headerHtml.match(/<span/g) || []).length, 6, 'Chevron/Milestone/Due/[reserved alignment cell]/Status/Actions');
  const rowHtml = l1MilestoneRowsHtml(p);
  assertNotIncludes(rowHtml, '<span></span>\n        <span class="l1-milestone-actions">', 'no spacer cell sits between Status and the Actions cluster');
});

// A 110px column between Due and Status — an explicit user request ("align
// the due date of the l1 milestone with the due date of the linked
// milestones"), originally a genuinely blank alignment reservation, since
// given real content by a later request ("also show the actual date...").
// Unlike the earlier, mistaken pre-Status spacer this row's own alignment
// history already removed once (see the two tests just above and the CSS
// comment on .l1-milestone-header/.l1-milestone-row), this one sits in a
// genuinely different position (after Due, not after Status) and exists for
// a real, verified reason: it's what makes Due land at the same x-position
// as .l1-linked-row's own Due one level down, without disturbing
// Status/Actions' own alignment with .l1-plans-list one level up.

test('l1MilestoneHeaderHtml labels the column between Due and Status as Actual', function () {
  const headerHtml = l1MilestoneHeaderHtml();
  assertIncludes(headerHtml, '<span></span><span>Milestone</span><span>Due</span><span>Actual</span><span>Status</span><span></span>');
});

test('l1MilestoneRowsHtml renders the Actual cell between Due and Status, blank when nothing to show', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const rowHtml = l1MilestoneRowsHtml(p);
  const dueIdx = rowHtml.indexOf('title="Due date"');
  const statusIdx = rowHtml.indexOf('cycleL1MilestoneStatus');
  assertTrue(dueIdx > -1 && statusIdx > dueIdx, 'sanity check on ordering');
  const between = rowHtml.slice(dueIdx, statusIdx);
  assertIncludes(between, '<span></span>', 'a genuinely blank cell — this milestone has nothing linked, so there\'s no rolled-up Actual to show');
});

test('renderL1Plans() uses its own .l1-plans-list container, not the reused .journeys-list', function () {
  setMode('l1plans');
  renderL1Plans();
  const html = document.getElementById('l1PlansBody').innerHTML;
  assertIncludes(html, 'l1-plans-list');
  assertNotIncludes(html, 'journeys-list');
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

test('l1LinkedHeaderHtml labels all six columns: Workstream, Scope Item, Milestone, Due, Actual, Status', function () {
  const html = l1LinkedHeaderHtml();
  assertIncludes(html, 'l1-linked-header');
  ['Workstream', 'Scope Item', 'Milestone', 'Due', 'Actual', 'Status'].forEach(label => assertIncludes(html, `<span>${label}</span>`));
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

test('linking never changes the L1 milestone\'s own stored status or dueDate — the displayed status and Due both roll up live instead (see the "L1/L2 status rollup" and "L1/L2 date rollup" tests below), but the underlying manual fields are untouched', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'red';
  m.dueDate = '2026-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2026-12-31', actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertEqual(m.status, 'red', 'the stored field is unchanged by the link — only the displayed/computed value now differs from it');
  assertEqual(m.dueDate, '2026-01-01', 'the stored dueDate is unchanged too — the computed rollup is display-only, exactly like status');
});

// ---------- L1/L2 status rollup — a later, explicit user reversal of the ----------
// original "pure traceability, no rollup" decision ("l1 and l2 should be
// rolled-up"). An L1 milestone (L2) with at least one linked workstream
// milestone now shows a computed, read-only status (the same weakest-link
// reduce every other computed status in this app uses), falling back to
// its own manual, click-to-cycle status when nothing's linked. An L1
// Plan's own status (L1) rolls up one level further, from its own
// milestones' *effective* status (computed-or-manual). Both are computed
// live at render time, never stored/stamped, specifically so a linked
// workstream milestone's status changing anywhere on the Planning board is
// picked up on the very next render with no special hook needed at the
// change site itself.

test('computedL1MilestoneStatus returns null when nothing is linked', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  assertEqual(computedL1MilestoneStatus(m.id), null);
});

test('computedL1MilestoneStatus rolls up the weakest linked workstream milestone\'s own status', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'A', dueDate: null, actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  const wm2 = { id: genId(), name: 'B', dueDate: null, actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm1, wm2);
  assertEqual(computedL1MilestoneStatus(m.id), 'red', 'red is the weakest of green/red, per STATUS_SEVERITY');
});

test('linking a workstream milestone to an L1 milestone makes its displayed status roll up live', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'not-started';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  const htmlBefore = l1MilestoneRowsHtml(p);
  assertIncludes(htmlBefore, statusLabel('not-started'), 'unlinked — shows its own manual status');
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const htmlAfter = l1MilestoneRowsHtml(p);
  assertIncludes(htmlAfter, statusLabel('amber'), 'linked — now shows the computed status instead');
});

test('a linked L1 milestone\'s status badge is read-only, not a clickable cycle button', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  const html = l1MilestoneRowsHtml(p);
  assertNotIncludes(html, `onclick="cycleL1MilestoneStatus('${p.id}','${m.id}')"`, 'no click-to-cycle handler once the status is computed');
});

test('cycleL1MilestoneStatus refuses to run against a linked (computed) milestone', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'not-started';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  cycleL1MilestoneStatus(p.id, m.id);
  assertEqual(m.status, 'not-started', 'the stored status must not change — this milestone is computed, not manual');
});

test('computeL1PlanStatus returns null when the plan has no milestones', function () {
  const p = addL1Plan();
  assertEqual(computeL1PlanStatus(p.id), null);
});

test('computeL1PlanStatus rolls up over its own milestones\' effective status — a linked milestone contributes its computed status, an unlinked one contributes its own manual status', function () {
  const p = addL1Plan();
  const m1 = addL1Milestone(p.id, 'Linked milestone');
  const m2 = addL1Milestone(p.id, 'Manual milestone');
  m1.status = 'not-started';
  m2.status = 'green';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneId: m1.id };
  item.milestones.push(wm);
  assertEqual(computeL1PlanStatus(p.id), 'red', 'the linked milestone\'s own computed (red) status is the weakest, even though its own stored status is not-started');
});

test('itemRowHtml renders an L1 Plan\'s own status badge from computeL1PlanStatus(), live, not its stored status field', function () {
  const p = addL1Plan();
  p.status = 'green'; // stale/irrelevant stored value
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  const html = itemRowHtml(p);
  assertIncludes(html, statusLabel('red'), 'reflects the live rollup, not the stale stored status');
});

// ---------- L1 milestone Due (manual/imported only) and Actual (roll-up ----------
// only) — a later, explicit user reversal of a brief earlier attempt at
// rolling Due up the same way Status does ("l1 milestones should have its
// own due date, not rolled up. this is defined (or imported). Actual date
// should not be able to set, only rolled up"). Due is now, and was always
// meant to stay, a genuinely independent value — hand-typed or set by
// importL1PlansFromExcel()'s "Target Date" column — regardless of link
// state; this is also what makes it a meaningful comparison basis for the
// delayed-color checks below, both at this level and for attached
// milestones (a value derived FROM the exact linked milestones being
// checked against it could never fail the check). Actual, by contrast, has
// no manual path at all — computedL1MilestoneActualDate() is the only
// source, the latest actualDate among whichever linked, non-notApplicable
// milestones have finished *so far* (progressive, not gated on the whole
// group finishing first — a further, later explicit request: "also show
// the actual date... on L1 milestone level").

test('computedL1MilestoneActualDate returns null when nothing is linked, or nothing linked has finished yet', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  assertEqual(computedL1MilestoneActualDate(m.id), null);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Still open', dueDate: '2027-03-31', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  assertEqual(computedL1MilestoneActualDate(m.id), null);
});

test('computedL1MilestoneActualDate is progressive — the latest actualDate among whichever linked milestones have finished so far, not gated on the whole group', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'Done', dueDate: '2027-01-31', actualDate: '2027-01-20', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  const wm2 = { id: genId(), name: 'Still open', dueDate: '2027-06-30', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm1, wm2);
  assertEqual(computedL1MilestoneActualDate(m.id), '2027-01-20', 'shows the one real actualDate so far, even though the group isn\'t fully done');
});

test('computedL1MilestoneActualDate excludes a notApplicable linked milestone entirely', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'Real', dueDate: '2027-01-31', actualDate: '2027-01-20', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  const wm2 = { id: genId(), name: 'Skipped', dueDate: '2027-12-31', actualDate: '2027-12-31', status: 'complete', notApplicable: true, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm1, wm2);
  assertEqual(computedL1MilestoneActualDate(m.id), '2027-01-20', 'the notApplicable milestone\'s own actualDate must not win');
});

test('linking a workstream milestone to an L1 milestone leaves its own Due exactly as manually editable as before — an explicit user reversal of a brief earlier rollup attempt', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2026-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2027-05-15', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  const htmlBefore = l1MilestoneRowsHtml(p);
  assertIncludes(htmlBefore, 'inline-date-input', 'unlinked — the manually editable pill');
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const htmlAfter = l1MilestoneRowsHtml(p);
  assertIncludes(htmlAfter, 'inline-date-input', 'still linked — Due stays the same manually editable pill, never swapped for a computed span');
  assertIncludes(htmlAfter, 'value="2026-01-01"', 'still shows its own manual value, not the linked milestone\'s Due');
});

test('l1MilestoneRowsHtml shows the L1 milestone\'s own rolled-up Actual once a linked milestone has finished, blank otherwise', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2027-05-15', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertNotIncludes(l1MilestoneRowsHtml(p), fmtDate('2027-05-20'), 'nothing to show yet — the linked milestone hasn\'t finished');
  wm.status = 'complete'; wm.actualDate = '2027-05-20';
  assertIncludes(l1MilestoneRowsHtml(p), fmtDate('2027-05-20'), 'now shows the rolled-up Actual');
});

test('l1MilestoneRowsHtml colors the L1 milestone\'s own rolled-up Actual red when it lands after its own manually-set Due', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-05-15';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Finished late', dueDate: '2027-05-01', actualDate: '2027-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'color:var(--stat-red)', 'the rolled-up Actual (2027-06-01) is later than this milestone\'s own manual Due (2027-05-15)');
});

test('l1MilestoneRowsHtml never colors the rolled-up Actual when the L1 milestone has no manual Due to compare against', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Finished', dueDate: '2027-05-01', actualDate: '2027-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertNotIncludes(l1MilestoneRowsHtml(p), 'color:var(--stat-red)');
});

test('updateL1MilestoneDateField works normally on a linked milestone too — an explicit user reversal, Due is never computed/refused regardless of link state', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2026-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2027-05-15', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: m.id };
  item.milestones.push(wm);
  updateL1MilestoneDateField(p.id, m.id, '2030-01-01');
  assertEqual(m.dueDate, '2030-01-01', 'the manual dueDate must update normally — linking never blocks it');
});

test('l1LinkedRowHtml renders the linked milestone\'s Actual date, or an em dash placeholder when unset', function () {
  const item = addItem({ name: 'Deliverable' });
  const withActual = { id: genId(), name: 'Done', dueDate: '2027-01-01', actualDate: '2027-01-05', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  const noActual = { id: genId(), name: 'Open', dueDate: '2027-01-01', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  assertIncludes(l1LinkedRowHtml(item, withActual), fmtDate('2027-01-05'));
  assertIncludes(l1LinkedRowHtml(item, noActual), '—');
});

// ---------- Attached-milestone delayed color coding — a later, explicit ----------
// user request ("colorcode if due date and actual date [of attached
// milestones] are past L1 milestone due date"), confirmed directly: the
// comparison basis is the L1 milestone's own *manually-set* dueDate (`m.dueDate`,
// still there and untouched even once linking makes it read-only for
// display — see "linking never changes the L1 milestone's own stored...
// dueDate" above), not its rolled-up/displayed Due. The rolled-up Due is by
// definition the latest Due among these exact linked milestones, so no
// individual one could ever be "past" it — only the independent, hand-set
// target makes this a real, non-vacuous check for both Due and Actual.

test('l1LinkedRowHtml colors a linked milestone\'s Due red when past the L1 milestone\'s own manually-set due date', function () {
  const item = addItem({ name: 'Deliverable' });
  const late = { id: genId(), name: 'Slipping', dueDate: '2027-08-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  const onTrack = { id: genId(), name: 'On track', dueDate: '2027-05-01', actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  const l1Due = '2027-06-01';
  assertIncludes(l1LinkedRowHtml(item, late, l1Due), 'color:var(--stat-red)');
  assertNotIncludes(l1LinkedRowHtml(item, onTrack, l1Due), 'color:var(--stat-red)');
});

test('l1LinkedRowHtml colors a linked milestone\'s Actual red when past the L1 milestone\'s own manually-set due date', function () {
  const item = addItem({ name: 'Deliverable' });
  const finishedLate = { id: genId(), name: 'Finished late', dueDate: '2027-05-01', actualDate: '2027-08-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  const finishedOnTime = { id: genId(), name: 'Finished on time', dueDate: '2027-05-01', actualDate: '2027-04-20', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  const l1Due = '2027-06-01';
  assertIncludes(l1LinkedRowHtml(item, finishedLate, l1Due), 'color:var(--stat-red)');
  assertNotIncludes(l1LinkedRowHtml(item, finishedOnTime, l1Due), 'color:var(--stat-red)');
});

test('l1LinkedRowHtml never colors Due/Actual when the L1 milestone has no manually-set due date to compare against', function () {
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Whatever', dueDate: '2030-01-01', actualDate: '2030-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  assertNotIncludes(l1LinkedRowHtml(item, wm, null), 'color:var(--stat-red)');
});

test('l1MilestoneRowsHtml passes the L1 milestone\'s own manual dueDate through to its expanded linked rows for the delayed-color comparison', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-06-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Slipping', dueDate: '2027-08-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  toggleL1MilestoneExpanded(m.id);
  assertIncludes(l1MilestoneRowsHtml(p), 'color:var(--stat-red)');
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

test('renderL1ConnectList excludes a workstream milestone already linked to a *different* L1 milestone', function () {
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

// ---------- The connect list as a flat 5-column table — an explicit user ----------
// request replacing the original grouped layout (one heading per
// workstream, a bold sub-heading per scope item, a plain name-only row per
// milestone with no Due shown at all).

test('l1ConnectHeaderHtml labels all five columns: Workstream, Scope Item, Milestone, Due, and a blank checkbox column', function () {
  const html = l1ConnectHeaderHtml();
  assertIncludes(html, 'l1-connect-header');
  ['Workstream', 'Scope Item', 'Milestone', 'Due'].forEach(label => assertIncludes(html, `<span>${label}</span>`));
});

test('renderL1ConnectList shows each candidate\'s Workstream, Scope Item, and Due date as real columns, not just the milestone name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const w2 = { id: genId(), name: 'Data Platform', color: 'teal', order: 1 };
  workstreams.push(w2);
  const item = addItem({ name: 'Warehouse migration', workstreamId: w2.id });
  const wm = { id: genId(), name: 'Cutover complete', dueDate: '2027-04-01', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  const html = document.getElementById('l1ConnectList').innerHTML;
  assertIncludes(html, 'Data Platform', 'the candidate\'s own workstream name');
  assertIncludes(html, 'Warehouse migration', 'the candidate\'s own scope item name');
  assertIncludes(html, fmtDate('2027-04-01'), 'the candidate\'s own Due date');
});

test('renderL1ConnectList shows an em dash for a candidate with no Due date set', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'No date yet', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  assertIncludes(document.getElementById('l1ConnectList').innerHTML, '—');
});

test('renderL1ConnectList labels a candidate from an Unassigned scope item as "Unassigned", not a stale/missing workstream name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Orphan item', workstreamId: null });
  const wm = { id: genId(), name: 'Some milestone', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  assertIncludes(document.getElementById('l1ConnectList').innerHTML, 'Unassigned');
});

test('renderL1ConnectList sorts candidates by workstream display order, Unassigned last, then by scope item name within each', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const wsB = { id: genId(), name: 'B Stream', color: 'teal', order: 1 };
  workstreams.push(wsB); // workstreams[0] ('Workstream 1', order 0) already exists from resetState()
  const itemInB = addItem({ name: 'In B', workstreamId: wsB.id });
  const itemZ = addItem({ name: 'Z in first stream', workstreamId: workstreams[0].id });
  const itemA = addItem({ name: 'A in first stream', workstreamId: workstreams[0].id });
  const itemUnassigned = addItem({ name: 'Unassigned item', workstreamId: null });
  [itemInB, itemZ, itemA, itemUnassigned].forEach(it => {
    it.milestones.push({ id: genId(), name: `${it.name} milestone`, dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null });
  });
  openL1ConnectModal(p.id, m.id);
  const html = document.getElementById('l1ConnectList').innerHTML;
  const idxA = html.indexOf('A in first stream');
  const idxZ = html.indexOf('Z in first stream');
  const idxB = html.indexOf('In B');
  const idxUnassigned = html.indexOf('Unassigned item');
  assertTrue(idxA < idxZ, 'within the first workstream, A sorts before Z by name');
  assertTrue(idxZ < idxB, 'workstreams[0] (order 0) sorts before B Stream (order 1)');
  assertTrue(idxB < idxUnassigned, 'Unassigned always sorts last, regardless of name');
});

test('l1ConnectRowHtml renders the whole row as one clickable label wrapping the checkbox, not just the checkbox itself', function () {
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneId: null };
  const html = l1ConnectRowHtml(item, wm, false);
  assertIncludes(html, '<label class="l1-connect-row"');
  assertIncludes(html, '<input type="checkbox"');
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

test('normalizeData keeps itemType:"l1plan" and forces categoryId to null', function () {
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
  assertTrue(!!found, 'an L1 Plan must ride along in the index, same as an Unassigned item');
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

// ---------- L1 Plan import/export ----------
// A formatted .xlsx round-trip dedicated to L1 Plans (an explicit user
// request), matching a real template the user already tracked these by hand
// in (L1 Plan / Stream / Milestone / Target Date / Reporting Level — Stream
// is read but never stored, since Pulse has no equivalent concept).
// importL1PlansFromExcel()/buildL1PlansSheet() themselves need a real
// ExcelJS.Workbook, never loaded inside this zero-dependency JXA harness —
// same reason exportToExcelReport()'s own tests (sync.test.js) only exercise
// its ExcelJS-missing guard. Everything genuinely testable without ExcelJS
// itself is covered here: the plain date-conversion helper, the shared
// plan/milestone factories the import path reuses, and the guard.

test('excelCellToIsoDate converts a real Date via its UTC fields, matching excelDateCell()\'s own Date.UTC(...) write', function () {
  assertEqual(excelCellToIsoDate(new Date(Date.UTC(2027, 2, 31))), '2027-03-31');
});

test('excelCellToIsoDate falls back to parsing a plain string cell', function () {
  assertEqual(excelCellToIsoDate('2027-03-31'), '2027-03-31');
});

test('excelCellToIsoDate returns null for blank, unparseable, or bare-number cells rather than guessing', function () {
  assertEqual(excelCellToIsoDate(null), null);
  assertEqual(excelCellToIsoDate(undefined), null);
  assertEqual(excelCellToIsoDate(''), null);
  assertEqual(excelCellToIsoDate('not a date'), null);
  assertEqual(excelCellToIsoDate(46112), null, 'a bare number is never treated as a raw Excel serial');
});

test('makeL1Plan builds the exact same shape saveL1PlanQuickAdd() already pushes', function () {
  const plan = makeL1Plan('Factory-built plan');
  assertEqual(plan.itemType, 'l1plan');
  assertEqual(plan.name, 'Factory-built plan');
  assertEqual(plan.workstreamId, null);
  assertEqual(plan.categoryId, null);
  assertDeepEqual(plan.milestones, []);
});

test('makeL1Milestone defaults dueDate/reportingLevel to null when omitted, and sets them when given', function () {
  const bare = makeL1Milestone('Bare milestone');
  assertEqual(bare.dueDate, null);
  assertEqual(bare.reportingLevel, null);
  assertEqual(bare.l1MilestoneId, null, 'an L1 milestone never links to another L1 milestone');
  const full = makeL1Milestone('Full milestone', '2027-03-31', 'Programme');
  assertEqual(full.dueDate, '2027-03-31');
  assertEqual(full.reportingLevel, 'Programme');
});

test('normalizeData backfills a missing reportingLevel on an L1 Plan\'s own milestone to null, and forces it null on an ordinary item\'s', function () {
  const p = addL1Plan('RL plan');
  const m = addL1Milestone(p.id, 'RL milestone');
  delete m.reportingLevel;
  const it = addItem({ name: 'Ordinary', milestones: [{ id: genId(), name: 'X', dueDate: todayStr(), status: 'not-started', actualDate: null, reportingLevel: 'Programme' }] });
  normalizeData();
  assertEqual(items.find(i => i.id === p.id).milestones[0].reportingLevel, null);
  assertEqual(items.find(i => i.id === it.id).milestones[0].reportingLevel, null, 'reportingLevel is never a real concept on an ordinary item\'s milestone');
});

test('l1MilestoneRowsHtml renders a Reporting Level badge next to the name when set, and omits it when not', function () {
  const p = addL1Plan('Badge plan');
  const withLevel = addL1Milestone(p.id, 'Has a level');
  withLevel.reportingLevel = 'Programme';
  addL1Milestone(p.id, 'No level set');
  const html = l1MilestoneRowsHtml(items.find(i => i.id === p.id));
  assertIncludes(html, 'l1-milestone-reporting-level');
  assertIncludes(html, 'Programme');
  const count = (html.match(/l1-milestone-reporting-level/g) || []).length;
  assertEqual(count, 1, 'only the milestone that actually has a reportingLevel should render the badge');
});

test('importL1PlansFromExcel/exportL1PlansToExcel show a clear toast instead of throwing when ExcelJS hasn\'t loaded', async function () {
  assertEqual(typeof globalThis.ExcelJS, 'undefined', 'this harness never loads the real library');
  await importL1PlansFromExcel({});
  assertIncludes(document.getElementById('toastMsg').textContent, 'Excel import needs an internet connection');
  await exportL1PlansToExcel();
  assertIncludes(document.getElementById('toastMsg').textContent, 'Excel export needs an internet connection');
});

test('triggerL1PlanImport is blocked below Editor', function () {
  userRole = 'reviewer';
  // requireRole() itself shows the "role required" toast — just confirm it
  // doesn't get anywhere near opening the file picker (nothing to assert on
  // the click itself in this harness, but a below-Editor call must return
  // before ever touching document.getElementById('l1PlanImportFileInput')).
  triggerL1PlanImport();
  assertIncludes(document.getElementById('toastMsg').textContent, 'role or higher required');
});
