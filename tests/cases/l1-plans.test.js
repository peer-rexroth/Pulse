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
// The link lives on the *workstream* milestone (m.l1MilestoneIds), not the
// L1 milestone. Many-to-many — a later, explicit user reversal of this
// feature's original many-to-one design ("change the link item to a
// checkbox to allow linking to multiple l1 milestones"): a workstream
// milestone can link to any number of L1 milestones at once. Linking is
// pure traceability on the workstream side — it never changes the
// workstream milestone's own status/dates — but does feed the L1 side's
// own rollup (see computedL1MilestoneStatus() in pulse.html).

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

// ---------- Editing an L1 Plan through the ordinary item modal ----------
// A user-reported bug: opening an L1 Plan's Edit modal (its only reachable
// use for one — renaming/deleting, see openItemModal()'s own comment) and
// clicking Save silently corrupted it, even with nothing else touched.
// #itemCategorySelect has no blank "no category" option, so an L1 Plan's own
// null categoryId defaulted to whichever real category renders first —
// which then tripped saveItem()'s zeroMilestoneCategorySwitch (the L1 Plan's
// original categoryId, null, now read as "different" from that default) and
// wholesale-replaced its real, hand-managed milestones with that category's
// generic template.

test('saveItem on an L1 Plan only ever renames it — categoryId/workstreamId/milestones are completely untouched', function () {
  const p = addL1Plan('Rollout');
  addL1Milestone(p.id, 'Phase 1');
  addL1Milestone(p.id, 'Phase 2');
  const originalMilestoneIds = p.milestones.map(m => m.id);
  openItemModal(p.id);
  document.getElementById('itemNameInput').value = 'Rollout (renamed)';
  saveItem();
  assertEqual(p.name, 'Rollout (renamed)');
  assertEqual(p.itemType, 'l1plan');
  assertEqual(p.categoryId, null, 'an L1 Plan must never pick up a real category just from opening/saving this modal');
  assertEqual(p.workstreamId, null);
  assertDeepEqual(p.milestones.map(m => m.id), originalMilestoneIds, 'the plan\'s own hand-added milestones must survive untouched, not get replaced by a category template');
});

test('saveItem on a zero-milestone L1 Plan still only renames it — the zero-milestone category-switch path must never apply to one', function () {
  const p = addL1Plan('Empty plan');
  openItemModal(p.id);
  document.getElementById('itemNameInput').value = 'Empty plan (renamed)';
  saveItem();
  assertEqual(p.name, 'Empty plan (renamed)');
  assertEqual(p.categoryId, null);
  assertEqual(p.milestones.length, 0, 'must not get seeded with a category\'s milestone template');
});

test('saveItem on an L1 Plan is blocked below Editor, same as any other item edit', function () {
  const p = addL1Plan('Guarded plan');
  userRole = 'reviewer';
  openItemModal(p.id);
  document.getElementById('itemNameInput').value = 'Should not apply';
  saveItem();
  assertEqual(p.name, 'Guarded plan');
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
  assertDeepEqual(m.l1MilestoneIds, [], 'an L1 milestone never links to another L1 milestone');
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
  const wm = { id: genId(), name: 'Ship it', dueDate: '2026-09-01', actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m2.id] };
  item.milestones.push(wm);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, `value="Unlinked milestone" onblur="updateL1MilestoneName('${p.id}','${m1.id}', this.value)"></span>`, 'no badge at all when nothing is linked');
  assertIncludes(html, `value="Linked milestone" onblur="updateL1MilestoneName('${p.id}','${m2.id}', this.value)"><span class="l1-milestone-linked-count">1 linked</span>`);
});

test('the "N linked" badge reflects the real linked count, not just 0-vs-1', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'A', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  const wm2 = { id: genId(), name: 'B', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
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

// A user-reported request ("highlight the L1 milestone row according to
// status") first tinted the whole row by the milestone's own effective
// status (computed/rolled-up when linked, its own manual value otherwise).
// A later, explicit user request reversed the row's own background to a
// pure date-vs-Due fact check instead (computedL1MilestoneDelayColor(),
// tested separately above) — effective status is now only ever the row's
// *fallback* tint, used whenever there's nothing to compute a delay color
// from (no manual Due set, or nothing linked with a date yet, both true in
// these two fixtures below since neither one ever sets m.dueDate).
test('l1MilestoneRowsHtml falls back to the milestone\'s own manual status color when unlinked and there\'s no Due to compare against', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'red';
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'class="l1-milestone-row" style="background:var(--stat-red-bg)"');
});

test('l1MilestoneRowsHtml falls back to the *computed* rolled-up status, not the milestone\'s own stale manual one, once it\'s linked but still has no Due', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'green'; // stale manual value — should be overridden by the computed rollup below
  const item = addItem({ name: 'Finance Deliverable' });
  const wm = { id: genId(), name: 'Cutover', dueDate: '2026-09-01', actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'class="l1-milestone-row" style="background:var(--stat-red-bg)"');
});

test('l1MilestoneRowsHtml tints the row by computedL1MilestoneDelayColor once the L1 milestone has its own Due set, overriding effective status entirely', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-03-15';
  m.status = 'red'; // manual status says red — the date-based delay color must win instead
  const item = addItem({ name: 'Finance Deliverable' });
  const wm = { id: genId(), name: 'On time', dueDate: '2027-03-01', actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'class="l1-milestone-row" style="background:var(--stat-green-bg)"');
});

// A Complete milestone is a hard override on the row color — an explicit
// user request ("if a l1 milestone is completed do not apply red, amber,
// green color coding. use blue"), checked before computedL1MilestoneDelayColor
// gets a say at all.

test('l1MilestoneRowsHtml tints the row blue when the milestone\'s own manual status is Complete, unlinked', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'complete';
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'class="l1-milestone-row" style="background:var(--stat-complete-bg)"');
});

test('l1MilestoneRowsHtml tints the row blue when linked and the rolled-up status is Complete, even with a Due set and a badly-late linked date', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-03-15';
  const item = addItem({ name: 'Finance Deliverable' });
  const wm = { id: genId(), name: 'Finished very late', dueDate: '2027-03-01', actualDate: '2027-09-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), 'red', 'sanity check — the date-based color alone would be red here');
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'class="l1-milestone-row" style="background:var(--stat-complete-bg)"', 'Complete overrides the red delay color entirely');
});

test('l1MilestoneRowsHtml still applies the date-based delay color for every non-Complete status', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-03-15';
  m.status = 'green';
  const item = addItem({ name: 'Finance Deliverable' });
  const wm = { id: genId(), name: 'Badly slipped', dueDate: '2027-03-01', actualDate: '2027-09-01', status: 'amber', notApplicable: false, l1MilestoneIds: [m.id], updatedAt: 0 };
  item.milestones.push(wm);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'class="l1-milestone-row" style="background:var(--stat-red-bg)"', 'not Complete — the date-based color still applies as before');
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
  const wm = { id: genId(), name: 'Cutover complete', dueDate: '2026-09-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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
  const wm = { id: genId(), name: 'Ship it', dueDate: '2026-09-01', actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  let html = l1MilestoneRowsHtml(p);
  assertNotIncludes(html, 'l1-linked-header', 'collapsed by default — no header shown yet');
  toggleL1MilestoneExpanded(m.id);
  html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'l1-linked-header');
});

test('l1MilestoneRowsHtml orders the expanded linked-milestones list by due date (or actual date) ascending, latest at the bottom, undated ones last', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const earliest = addItem({ name: 'Earliest' });
  earliest.milestones.push({ id: genId(), name: 'A', dueDate: '2026-01-01', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] });
  const latestByActual = addItem({ name: 'Latest by actual' });
  latestByActual.milestones.push({ id: genId(), name: 'B', dueDate: '2026-02-01', actualDate: '2026-06-01', status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] });
  const middle = addItem({ name: 'Middle' });
  middle.milestones.push({ id: genId(), name: 'C', dueDate: '2026-03-01', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] });
  const undated = addItem({ name: 'Undated' });
  undated.milestones.push({ id: genId(), name: 'D', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] });
  toggleL1MilestoneExpanded(m.id);
  const html = l1MilestoneRowsHtml(p);
  const names = ['Earliest', 'Middle', 'Latest by actual', 'Undated'];
  const order = names.map(n => html.indexOf(n));
  for (let i = 1; i < order.length; i++) assertTrue(order[i - 1] < order[i], `expected ${names[i-1]} before ${names[i]}`);
});

test('l1LinkedRowHtml labels a linked milestone from an Unassigned scope item as "Unassigned", not a stale/missing workstream name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Unassigned deliverable', workstreamId: null });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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

// A user-reported bug: the L1 Plan's own "X/Y milestones" badge
// (itemRowHtml()'s `done` count) never incremented for a *linked* L1
// milestone marked Complete purely through its own rolled-up status — it
// read the milestone's raw `m.status` field directly, but a linked
// milestone's real, displayed status is computedL1MilestoneStatus()'s own
// rollup, which deliberately never writes back onto `m.status` itself (see
// that function's own "computed fresh at read time, never stored back"
// comment). effectiveMilestoneStatus() is the fix — the same
// "rolled-up-when-linked, manual otherwise" fallback every other L1
// milestone display already uses.

test('itemRowHtml\'s "X/Y milestones" badge counts a linked L1 milestone as done once its rolled-up status is Complete, even though its own raw status field never changed', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  assertEqual(m.status, 'not-started', 'sanity check — the L1 milestone\'s own raw status is never touched by linking');
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Done', dueDate: '2027-01-01', actualDate: '2027-01-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertEqual(computedL1MilestoneStatus(m.id), 'complete', 'sanity check — the rollup itself is correct');
  assertEqual(m.status, 'not-started', 'sanity check — still untouched even after the link makes it read as Complete');
  const html = itemRowHtml(p);
  assertIncludes(html, '1/1 milestones', 'the badge must count the linked milestone\'s effective (rolled-up) status, not its stale raw one');
});

test('itemRowHtml\'s "X/Y milestones" badge still counts an unlinked L1 milestone\'s own manual Complete status directly, as before', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'complete';
  const html = itemRowHtml(p);
  assertIncludes(html, '1/1 milestones');
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

// ---------- Renaming an L1 milestone ----------
// A user-reported gap: Due and Status were already inline-editable directly
// on this row, but the name — set once at creation via quick-add — had no
// way to be corrected afterward at all ("i can only link and delete right
// now"). updateL1MilestoneName() closes that gap the same way Due already
// works: no modal, just a real, always-live input on the row itself,
// committing on blur.

test('updateL1MilestoneName renames the milestone and stamps updatedAt', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id, 'Original name');
  const before = m.updatedAt;
  updateL1MilestoneName(p.id, m.id, 'Corrected name');
  assertEqual(m.name, 'Corrected name');
  assertTrue(m.updatedAt >= before);
});

test('updateL1MilestoneName trims surrounding whitespace', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id, 'Original name');
  updateL1MilestoneName(p.id, m.id, '  Trimmed name  ');
  assertEqual(m.name, 'Trimmed name');
});

test('updateL1MilestoneName is a no-op — the name stays unchanged — when given a blank or whitespace-only value', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id, 'Original name');
  updateL1MilestoneName(p.id, m.id, '   ');
  assertEqual(m.name, 'Original name', 'a blank edit must not clear the name — the real value is what render() redraws the input back to');
});

test('updateL1MilestoneName is a no-op (no updatedAt bump) when the trimmed value equals the current name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id, 'Same name');
  const stamped = m.updatedAt;
  updateL1MilestoneName(p.id, m.id, 'Same name');
  assertEqual(m.updatedAt, stamped);
});

test('updateL1MilestoneName is blocked below Editor', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id, 'Original name');
  userRole = 'reviewer';
  updateL1MilestoneName(p.id, m.id, 'Should not stick');
  assertEqual(m.name, 'Original name');
});

test('l1MilestoneRowsHtml renders the name as a plain, non-editable span below Editor, not the live input', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id, 'Read only here');
  userRole = 'reviewer';
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, '<span class="l1-milestone-name">Read only here</span>');
  assertNotIncludes(html, '<input type="text" class="l1-milestone-name"');
});

test('l1MilestoneRowsHtml renders the name as a live, editable input at Editor+, wired to updateL1MilestoneName via onblur', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id, 'Editable here');
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, `<input type="text" class="l1-milestone-name" value="Editable here" onblur="updateL1MilestoneName('${p.id}','${m.id}', this.value)">`);
});

// ---------- Removing an L1 milestone ----------

// removeL1Milestone() now opens a confirm modal first — an explicit user
// request ("add a delete modal l1 plans and l1 milestones, asking for
// confirmation, like deleting milestones") — matching every other
// destructive delete in this app (deleteItem(), deleteWorkstreamFromModal(),
// deleteCategoryFromModal()). Every test below that actually expects the
// deletion to happen now calls confirmModalAction() to confirm it, the same
// way those other deletes' own tests already do.

test('removeL1Milestone opens a confirm modal rather than deleting outright', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  removeL1Milestone(p.id, m.id);
  assertEqual(p.milestones.length, 1, 'nothing should be removed until the confirm modal is actually confirmed');
  assertTrue(!!modalTarget, 'a confirm modal should be armed');
});

test('removeL1Milestone tombstones the milestone via deletedMilestoneIds, same as an ordinary item\'s milestone removal', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  removeL1Milestone(p.id, m.id);
  confirmModalAction();
  assertEqual(p.milestones.length, 0);
  assertTrue(deletedMilestoneIds.some(t => t.id === m.id));
});

test('removeL1Milestone removes its own id from every workstream milestone that was linked to it, rather than leaving a dangling reference', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(linkedWorkstreamMilestones(m.id).length, 1);
  removeL1Milestone(p.id, m.id);
  confirmModalAction();
  assertDeepEqual(wm.l1MilestoneIds, [], 'the link is cleaned up immediately, not left to the next normalizeData() self-heal');
});

test('removeL1Milestone only drops its own id, leaving a multi-linked workstream milestone\'s other links untouched', function () {
  const p1 = addL1Plan();
  const m1 = addL1Milestone(p1.id);
  const p2 = addL1Plan();
  const m2 = addL1Milestone(p2.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneIds: [m1.id, m2.id] };
  item.milestones.push(wm);
  removeL1Milestone(p1.id, m1.id);
  confirmModalAction();
  assertDeepEqual(wm.l1MilestoneIds, [m2.id]);
});

test('removeL1Milestone recomputes the parent L1 Plan\'s own status/date-range after removal', function () {
  const p = addL1Plan();
  const m1 = addL1Milestone(p.id);
  addL1Milestone(p.id);
  updateL1MilestoneDateField(p.id, m1.id, '2026-09-01');
  cycleL1MilestoneStatus(p.id, m1.id); // not-started -> next status
  removeL1Milestone(p.id, m1.id);
  confirmModalAction();
  assertEqual(p.status, computedStatusFromMilestones(p.milestones));
  const range = computedDateRangeFromMilestones(p.milestones);
  assertEqual(p.startDate, range ? range.startDate : null);
  assertEqual(p.dueDate, range ? range.dueDate : null);
});

test('removeL1Milestone undoes cleanly — restores the milestone and re-links whatever it had unlinked', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  removeL1Milestone(p.id, m.id);
  confirmModalAction();
  assertEqual(p.milestones.length, 0);
  assertDeepEqual(wm.l1MilestoneIds, []);
  triggerToastUndo();
  assertEqual(p.milestones.length, 1);
  assertEqual(p.milestones[0].id, m.id);
  assertDeepEqual(wm.l1MilestoneIds, [m.id], 'the link this delete itself removed should come back too');
});

test('removeL1Milestone is blocked below Editor', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  userRole = 'reviewer';
  removeL1Milestone(p.id, m.id);
  assertEqual(p.milestones.length, 1);
  assertFalse(!!modalTarget, 'the confirm modal itself must never open below Editor');
});

// ---------- Linking a workstream milestone to an L1 milestone ----------

test('toggleL1MilestoneLink adds l1ConnectMilestoneId to the workstream milestone\'s own l1MilestoneIds and stamps updatedAt', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertDeepEqual(wm.l1MilestoneIds, [m.id]);
  assertTrue(wm.updatedAt > 0);
});

test('toggleL1MilestoneLink(false) removes just that one id, leaving any other links on the same milestone untouched', function () {
  const p1 = addL1Plan();
  const m1 = addL1Milestone(p1.id);
  const p2 = addL1Plan();
  const m2 = addL1Milestone(p2.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m1.id, m2.id] };
  item.milestones.push(wm);
  openL1ConnectModal(p1.id, m1.id);
  toggleL1MilestoneLink(item.id, wm.id, false);
  assertDeepEqual(wm.l1MilestoneIds, [m2.id]);
});

test('a workstream milestone can be linked to multiple L1 milestones at once — the many-to-many reversal of this feature\'s original design', function () {
  const p1 = addL1Plan();
  const m1 = addL1Milestone(p1.id);
  const p2 = addL1Plan();
  const m2 = addL1Milestone(p2.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p1.id, m1.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  openL1ConnectModal(p2.id, m2.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertDeepEqual(wm.l1MilestoneIds, [m1.id, m2.id]);
  assertEqual(linkedWorkstreamMilestones(m1.id).length, 1);
  assertEqual(linkedWorkstreamMilestones(m2.id).length, 1);
});

test('toggleL1MilestoneLink checking an already-linked id twice does not duplicate it', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertDeepEqual(wm.l1MilestoneIds, [m.id]);
});

test('linking never changes the L1 milestone\'s own stored status or dueDate — the displayed status and Due both roll up live instead (see the "L1/L2 status rollup" and "L1/L2 date rollup" tests below), but the underlying manual fields are untouched', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'red';
  m.dueDate = '2026-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2026-12-31', actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
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
  const wm1 = { id: genId(), name: 'A', dueDate: null, actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  const wm2 = { id: genId(), name: 'B', dueDate: null, actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm1, wm2);
  assertEqual(computedL1MilestoneStatus(m.id), 'red', 'red is the weakest of green/red, per STATUS_SEVERITY');
});

test('linking a workstream milestone to an L1 milestone makes its displayed status roll up live', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'not-started';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
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
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  const html = l1MilestoneRowsHtml(p);
  assertNotIncludes(html, `onclick="cycleL1MilestoneStatus('${p.id}','${m.id}')"`, 'no click-to-cycle handler once the status is computed');
});

test('cycleL1MilestoneStatus refuses to run against a linked (computed) milestone', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.status = 'not-started';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m1.id] };
  item.milestones.push(wm);
  assertEqual(computeL1PlanStatus(p.id), 'red', 'the linked milestone\'s own computed (red) status is the weakest, even though its own stored status is not-started');
});

test('itemRowHtml renders an L1 Plan\'s own status badge from computeL1PlanStatus(), live, not its stored status field', function () {
  const p = addL1Plan();
  p.status = 'green'; // stale/irrelevant stored value
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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

test('computedL1MilestoneActualDate returns null when nothing is linked, or nothing linked has either date set', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  assertEqual(computedL1MilestoneActualDate(m.id), null);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'No dates yet', dueDate: null, actualDate: null, status: 'pending', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(computedL1MilestoneActualDate(m.id), null);
});

// A later, explicit user request ("l1 milestone actual date should roll up
// from linked milestones and reflect latest date from due date or actual
// date") reversed this function's own original Actual-only design — it now
// reduces over every linked, non-notApplicable milestone's own Due *and*
// Actual together, not Actual alone.

test('computedL1MilestoneActualDate is progressive — the latest Due or Actual among linked milestones so far, not gated on the whole group finishing', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'Done', dueDate: '2027-01-31', actualDate: '2027-01-20', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  const wm2 = { id: genId(), name: 'Still open', dueDate: '2027-06-30', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm1, wm2);
  assertEqual(computedL1MilestoneActualDate(m.id), '2027-06-30', 'the still-open milestone\'s own Due is the latest date across the group so far, even though it hasn\'t finished');
});

test('computedL1MilestoneActualDate prefers a linked milestone\'s own Actual over its Due whenever Actual lands later', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Finished late', dueDate: '2027-05-01', actualDate: '2027-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(computedL1MilestoneActualDate(m.id), '2027-06-01');
});

test('computedL1MilestoneActualDate excludes a notApplicable linked milestone\'s dates entirely', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'Real', dueDate: '2027-01-31', actualDate: '2027-01-20', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  const wm2 = { id: genId(), name: 'Skipped', dueDate: '2027-12-31', actualDate: '2027-12-31', status: 'complete', notApplicable: true, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm1, wm2);
  assertEqual(computedL1MilestoneActualDate(m.id), '2027-01-31', 'wm1\'s own later Due wins; the notApplicable milestone\'s dates must not count at all');
});

// The L1 milestone row's own background color — a later, explicit user
// request reversing the row-tint feature above from a status rollup to a
// pure "how late are the linked dates against my own Due" fact check
// ("Color should be determined by fact, if the due date or actual date of
// all linked scope item milestones is matching with the target date of the
// l1 milestones. If all dates are before or on the date, set to green. if
// its within 1 month after the date, set to amber, if its longer, set to
// red"). computedL1MilestoneStatus() itself is untouched — it still drives
// the row's own status badge — only l1MilestoneRowsHtml()'s own background
// now reads from this function instead.

test('computedL1MilestoneDelayColor returns null when the L1 milestone has no manual Due date set, even with linked dates that would otherwise be late', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Late', dueDate: '2027-01-01', actualDate: null, status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(m.dueDate, null, 'sanity check — a freshly quick-added L1 milestone starts with no Due');
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), null);
});

test('computedL1MilestoneDelayColor returns null when nothing is linked, or nothing linked has a date yet', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-01-01';
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), null);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'No dates yet', dueDate: null, actualDate: null, status: 'pending', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), null);
});

test('computedL1MilestoneDelayColor is green when every linked milestone\'s Due-or-Actual lands on or before the L1 milestone\'s own Due', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-03-15';
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'Early', dueDate: '2027-02-01', actualDate: '2027-01-20', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  const wm2 = { id: genId(), name: 'On the day', dueDate: '2027-03-15', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm1, wm2);
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), 'green');
});

test('computedL1MilestoneDelayColor is amber when the latest linked date is later than the L1 milestone\'s own Due but still within a month', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-03-15';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Slipped a bit', dueDate: '2027-03-20', actualDate: '2027-04-10', status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), 'amber', 'the latest linked date (2027-04-10) is after the Due (2027-03-15) but still within one calendar month of it (up to 2027-04-15)');
});

test('computedL1MilestoneDelayColor is red once the latest linked date is more than a month after the L1 milestone\'s own Due', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-03-15';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Badly slipped', dueDate: '2027-03-20', actualDate: '2027-04-16', status: 'red', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), 'red');
});

test('computedL1MilestoneDelayColor prefers a linked milestone\'s own Actual over its Due whenever Actual lands later, same as computedL1MilestoneActualDate', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Finished very late', dueDate: '2027-01-05', actualDate: '2027-05-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), 'red', 'the Actual (2027-05-01), not the earlier Due (2027-01-05), must be what\'s compared');
});

test('computedL1MilestoneDelayColor excludes a notApplicable linked milestone\'s dates entirely', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-01-31';
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'On time', dueDate: '2027-01-31', actualDate: '2027-01-20', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  const wm2 = { id: genId(), name: 'Skipped', dueDate: '2027-12-31', actualDate: '2027-12-31', status: 'complete', notApplicable: true, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm1, wm2);
  assertEqual(computedL1MilestoneDelayColor(m.id, m.dueDate), 'green', 'the notApplicable milestone\'s far-future dates must not count at all');
});

test('linking a workstream milestone to an L1 milestone leaves its own Due exactly as manually editable as before — an explicit user reversal of a brief earlier rollup attempt', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2026-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2027-05-15', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  const htmlBefore = l1MilestoneRowsHtml(p);
  assertIncludes(htmlBefore, 'inline-date-input', 'unlinked — the manually editable pill');
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const htmlAfter = l1MilestoneRowsHtml(p);
  assertIncludes(htmlAfter, 'inline-date-input', 'still linked — Due stays the same manually editable pill, never swapped for a computed span');
  assertIncludes(htmlAfter, 'value="2026-01-01"', 'still shows its own manual value, not the linked milestone\'s Due');
});

// A user-reported regression: "inline editing of the date field is broken
// again on 4 digit year. after 2 digits, it leaves field" — traced to this
// one field alone still carrying a hardcoded onchange attribute that every
// other date input in the app had already been fixed to drop (see "The
// native calendar picker commits via armPickerCommit(), not onchange" in
// views.test.js for the full history: Chrome fires change the moment any
// single segment looks complete, and a date input's year segment does that
// after just its first typed digit, destroying the still-focused input and
// swallowing every further keystroke). onblur is the only commit path for
// a keyboard edit now; armPickerCommit() (wired via the calendar icon's own
// onclick) is what makes a genuine native-picker selection still commit
// reliably despite that.
test('an L1 milestone\'s own Due input arms a picker commit via its calendar icon, not a plain onchange', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, `armPickerCommit(inp, v => updateL1MilestoneDateField('${p.id}','${m.id}',v))`);
  assertNotIncludes(html, `onchange="if(this.value) updateL1MilestoneDateField('${p.id}','${m.id}'`, 'must not auto-commit on a plain onchange any more');
});

test('l1MilestoneRowsHtml shows the L1 milestone\'s own rolled-up Actual from a linked milestone\'s Due even before it finishes, then from its Actual once that\'s later', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertNotIncludes(l1MilestoneRowsHtml(p), fmtDateY('2027-05-20'), 'nothing to show yet — the linked milestone has neither date set');
  wm.dueDate = '2027-05-15';
  assertIncludes(l1MilestoneRowsHtml(p), fmtDateY('2027-05-15'), 'now shows the rolled-up Due, even before the milestone has finished');
  wm.status = 'complete'; wm.actualDate = '2027-05-20';
  assertIncludes(l1MilestoneRowsHtml(p), fmtDateY('2027-05-20'), 'now shows the rolled-up Actual, since it\'s later than Due');
});

test('l1MilestoneRowsHtml renders the L1 milestone\'s own rolled-up Actual as a red overdue pill when it lands after its own manually-set Due', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-05-15';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Finished late', dueDate: '2027-05-01', actualDate: '2027-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'class="date-pill pill-overdue"', 'the rolled-up Actual (2027-06-01) is later than this milestone\'s own manual Due (2027-05-15)');
});

test('l1MilestoneRowsHtml never renders the rolled-up Actual as an overdue pill when the L1 milestone has no manual Due to compare against', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Finished', dueDate: '2027-05-01', actualDate: '2027-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertNotIncludes(l1MilestoneRowsHtml(p), 'pill-overdue');
});

// A user-reported alignment bug: an on-time rolled-up Actual used to render
// as bare, unpadded text (.item-dates-computed) while an overdue one
// rendered as a real, padded pill (.date-pill.pill-overdue) — two entirely
// different box models sharing one grid column, so the date text itself
// started at a different x-position row to row depending on which state
// each milestone happened to be in. Both states now share the identical
// .date-pill base (same padding/shape), differing only by the additive
// .pill-overdue color modifier — so the two rows below must both render
// through .date-pill, never through the old plain-text class at all.

test('l1MilestoneRowsHtml renders an on-time rolled-up Actual as a plain (non-overdue) date-pill, not bare unpadded text — for alignment with an overdue row\'s own pill', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-06-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'On time', dueDate: '2027-05-01', actualDate: '2027-05-15', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const html = l1MilestoneRowsHtml(p);
  assertIncludes(html, 'class="date-pill"', 'a real pill, same box model as the overdue variant, just no red tint');
  assertNotIncludes(html, 'item-dates-computed', 'no longer falls back to bare, unpadded text — that box model is what broke row-to-row alignment');
});

test('updateL1MilestoneDateField works normally on a linked milestone too — an explicit user reversal, Due is never computed/refused regardless of link state', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2026-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: '2027-05-15', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  updateL1MilestoneDateField(p.id, m.id, '2030-01-01');
  assertEqual(m.dueDate, '2030-01-01', 'the manual dueDate must update normally — linking never blocks it');
});

test('l1LinkedRowHtml renders the linked milestone\'s Actual date, or an em dash placeholder when unset', function () {
  const item = addItem({ name: 'Deliverable' });
  const withActual = { id: genId(), name: 'Done', dueDate: '2027-01-01', actualDate: '2027-01-05', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  const noActual = { id: genId(), name: 'Open', dueDate: '2027-01-01', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  assertIncludes(l1LinkedRowHtml(item, withActual), fmtDateY('2027-01-05'));
  assertIncludes(l1LinkedRowHtml(item, noActual), '—');
});

// A user-reported readability gap: these dates can legitimately span
// several years (an L1 target set far out, work items due long before
// it), and the plain fmtDate() every other read-only date span in this app
// defaults to never shows the year — making it genuinely impossible to
// tell, at a glance, whether a bare "19. Jan." landed months before or
// after the comparison date it was colored against. Both l1LinkedRowHtml()
// (Due/Actual) and l1MilestoneRowsHtml() (the L1 milestone's own rolled-up
// Actual) render via fmtDateY() instead, matching the same "Plan-date
// ranges always show the year" convention a Start→Due range already
// established. These two tests assert the literal year digits show up,
// not just that the html happens to match whatever fmtDateY() produces —
// a direct guard against silently reverting to fmtDate() one day.

test('l1LinkedRowHtml shows the year on both Due and Actual, not just month/day', function () {
  const item = addItem({ name: 'Deliverable' });
  const m = { id: genId(), name: 'Done', dueDate: '2027-01-01', actualDate: '2028-01-19', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  const html = l1LinkedRowHtml(item, m);
  assertIncludes(html, '2027', 'the year on Due');
  assertIncludes(html, '2028', 'the year on Actual');
});

test('l1MilestoneRowsHtml shows the year on the L1 milestone\'s own rolled-up Actual, not just month/day', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Finished', dueDate: '2027-05-01', actualDate: '2028-01-19', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertIncludes(l1MilestoneRowsHtml(p), '2028');
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
  const late = { id: genId(), name: 'Slipping', dueDate: '2027-08-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  const onTrack = { id: genId(), name: 'On track', dueDate: '2027-05-01', actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  const l1Due = '2027-06-01';
  assertIncludes(l1LinkedRowHtml(item, late, l1Due), 'color:var(--stat-red)');
  assertNotIncludes(l1LinkedRowHtml(item, onTrack, l1Due), 'color:var(--stat-red)');
});

test('l1LinkedRowHtml colors a linked milestone\'s Actual red when past the L1 milestone\'s own manually-set due date', function () {
  const item = addItem({ name: 'Deliverable' });
  const finishedLate = { id: genId(), name: 'Finished late', dueDate: '2027-05-01', actualDate: '2027-08-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  const finishedOnTime = { id: genId(), name: 'Finished on time', dueDate: '2027-05-01', actualDate: '2027-04-20', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  const l1Due = '2027-06-01';
  assertIncludes(l1LinkedRowHtml(item, finishedLate, l1Due), 'color:var(--stat-red)');
  assertNotIncludes(l1LinkedRowHtml(item, finishedOnTime, l1Due), 'color:var(--stat-red)');
});

test('l1LinkedRowHtml never colors Due/Actual when the L1 milestone has no manually-set due date to compare against', function () {
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Whatever', dueDate: '2030-01-01', actualDate: '2030-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  assertNotIncludes(l1LinkedRowHtml(item, wm, null), 'color:var(--stat-red)');
});

test('l1MilestoneRowsHtml passes the L1 milestone\'s own manual dueDate through to its expanded linked rows for the delayed-color comparison', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-06-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Slipping', dueDate: '2027-08-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
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
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  userRole = 'reviewer';
  toggleL1MilestoneLink(item.id, wm.id, true);
  assertDeepEqual(wm.l1MilestoneIds, []);
});

test('linkedWorkstreamMilestones returns every workstream milestone linked to a given L1 milestone, excluding L1 Plans\' own milestones entirely', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const otherPlan = addL1Plan('Other plan');
  addL1Milestone(otherPlan.id); // never a candidate for linking to another L1 milestone
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'A', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  const wm2 = { id: genId(), name: 'B', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm1, wm2);
  const linked = linkedWorkstreamMilestones(m.id);
  assertEqual(linked.length, 1);
  assertEqual(linked[0].milestone.id, wm1.id);
});

test('renderL1ConnectList no longer excludes a workstream milestone already linked to a *different* L1 milestone — many-to-many, a later reversal of this feature\'s original design', function () {
  const p = addL1Plan();
  const m1 = addL1Milestone(p.id, 'Milestone 1');
  const m2 = addL1Milestone(p.id, 'Milestone 2');
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Already linked elsewhere', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m1.id] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m2.id);
  const html = document.getElementById('l1ConnectList').innerHTML;
  assertIncludes(html, 'Already linked elsewhere');
  assertIncludes(html, `<input type="checkbox"  onchange="toggleL1MilestoneLink('${item.id}','${wm.id}', this.checked)">`, 'a real, unchecked candidate for m2 specifically, even though it\'s already linked to m1');
});

test('renderL1ConnectList still includes a milestone already linked to the *same* L1 milestone being managed, pre-checked', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Already linked', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
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
  const wm1 = { id: genId(), name: 'Cutover complete', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  const wm2 = { id: genId(), name: 'Unrelated step', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
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
  const wm = { id: genId(), name: 'Cutover complete', dueDate: '2027-04-01', actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
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
  const wm = { id: genId(), name: 'No date yet', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  assertIncludes(document.getElementById('l1ConnectList').innerHTML, '—');
});

test('renderL1ConnectList labels a candidate from an Unassigned scope item as "Unassigned", not a stale/missing workstream name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Orphan item', workstreamId: null });
  const wm = { id: genId(), name: 'Some milestone', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
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
    it.milestones.push({ id: genId(), name: `${it.name} milestone`, dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] });
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
  const wm = { id: genId(), name: 'Ship it', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
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

test('l1LinkIndicatorHtml is empty for a milestone with no l1MilestoneIds', function () {
  const m = { id: genId(), name: 'X', l1MilestoneIds: [] };
  assertEqual(l1LinkIndicatorHtml(m), '');
});

test('l1LinkIndicatorHtml renders a chain-link icon naming the L1 Plan and milestone once linked', function () {
  const p = addL1Plan('Company OKRs');
  const m = addL1Milestone(p.id, 'Q4 target');
  const wm = { id: genId(), name: 'Ship it', l1MilestoneIds: [m.id] };
  const html = l1LinkIndicatorHtml(wm);
  assertIncludes(html, 'fa-link');
  assertIncludes(html, 'Company OKRs');
  assertIncludes(html, 'Q4 target');
});

test('l1LinkIndicatorHtml lists every linked plan/milestone in its tooltip once linked to more than one', function () {
  const p1 = addL1Plan('Company OKRs');
  const m1 = addL1Milestone(p1.id, 'Q4 target');
  const p2 = addL1Plan('Finance Programme');
  const m2 = addL1Milestone(p2.id, 'Go-live');
  const wm = { id: genId(), name: 'Ship it', l1MilestoneIds: [m1.id, m2.id] };
  const html = l1LinkIndicatorHtml(wm);
  const count = (html.match(/fa-link/g) || []).length;
  assertEqual(count, 1, 'still one icon, regardless of how many links it names');
  assertIncludes(html, 'Company OKRs');
  assertIncludes(html, 'Q4 target');
  assertIncludes(html, 'Finance Programme');
  assertIncludes(html, 'Go-live');
});

test('l1LinkIndicatorHtml is empty (not a broken icon) when none of l1MilestoneIds resolves to anything real', function () {
  const wm = { id: genId(), name: 'Ship it', l1MilestoneIds: ['stale-deleted-id'] };
  assertEqual(l1LinkIndicatorHtml(wm), '');
});

test('l1LinkIndicatorHtml only names the ids that still resolve, skipping any stale ones mixed in', function () {
  const p = addL1Plan('Company OKRs');
  const m = addL1Milestone(p.id, 'Q4 target');
  const wm = { id: genId(), name: 'Ship it', l1MilestoneIds: ['stale-deleted-id', m.id] };
  const html = l1LinkIndicatorHtml(wm);
  assertIncludes(html, 'Q4 target');
});

test('milestoneRowsHtml appends the linked indicator after a linked milestone\'s own name', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  toggleItemExpanded(item.id);
  const html = milestoneRowsHtml(item, null, false);
  assertIncludes(html, 'Ship it');
  assertIncludes(html, 'fa-link');
});

test('saveItem() preserves an existing milestone\'s l1MilestoneIds through the item modal — a real, user-facing bug this app used to have (every save silently dropped every L1 link, since neither openItemModal()\'s own editingMilestones copy nor saveItem()\'s own milestone-mapping ever carried the field through at all)', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const it = {
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'Deliverable',
    owner: '', status: 'green', actualDate: null, startDate: todayStr(), dueDate: todayStr(), updatedAt: Date.now(),
    milestones: [{ id: genId(), name: 'Ship it', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] }]
  };
  items.push(it);
  openItemModal(it.id);
  // The fake <select> doesn't reflect populateCategorySelect()'s own
  // selected="" attribute in .value (a documented harness limitation — see
  // "Tests" in CLAUDE.md), so this is set explicitly, matching every other
  // test in this suite that saves an item through the modal.
  document.getElementById('itemCategorySelect').value = it.categoryId;
  // Edit something wholly unrelated — the bug fired regardless of what was
  // actually changed, since it was the milestone-mapping itself dropping
  // the field, not anything about how the edit was made.
  document.getElementById('itemNameInput').value = 'Deliverable (renamed)';
  saveItem();
  const saved = items.find(i => i.id === it.id);
  assertDeepEqual(saved.milestones[0].l1MilestoneIds, [m.id]);
  assertEqual(linkedWorkstreamMilestones(m.id).length, 1, 'the L1 milestone\'s own rollup must still see this link after the save');
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

test('normalizeData backfills a missing l1MilestoneIds on an ordinary milestone to an empty array', function () {
  const item = addItem({ name: 'Deliverable' });
  item.milestones.push({ id: genId(), name: 'M', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now() });
  normalizeData();
  assertDeepEqual(item.milestones[0].l1MilestoneIds, []);
});

test('normalizeData migrates a legacy scalar l1MilestoneId into a one-element l1MilestoneIds array, and drops the old field', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  item.milestones.push({ id: genId(), name: 'M', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneId: m.id });
  normalizeData();
  assertDeepEqual(item.milestones[0].l1MilestoneIds, [m.id]);
  assertEqual('l1MilestoneId' in item.milestones[0], false, 'the legacy scalar field is never read again after migration');
});

test('normalizeData drops any stale id in l1MilestoneIds pointing at a deleted L1 Plan/milestone, keeping the rest', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const item = addItem({ name: 'Deliverable' });
  item.milestones.push({ id: genId(), name: 'M', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneIds: ['never-existed', m.id] });
  normalizeData();
  assertDeepEqual(item.milestones[0].l1MilestoneIds, [m.id]);
});

test('normalizeData preserves every valid id in l1MilestoneIds that still resolves to a real L1 milestone', function () {
  const p1 = addL1Plan();
  const m1 = addL1Milestone(p1.id);
  const p2 = addL1Plan();
  const m2 = addL1Milestone(p2.id);
  const item = addItem({ name: 'Deliverable' });
  item.milestones.push({ id: genId(), name: 'M', dueDate: todayStr(), actualDate: null, status: 'not-started', notApplicable: false, updatedAt: Date.now(), l1MilestoneIds: [m1.id, m2.id] });
  normalizeData();
  assertDeepEqual(item.milestones[0].l1MilestoneIds, [m1.id, m2.id]);
});

test('normalizeData forces l1MilestoneIds to an empty array on an L1 Plan\'s own milestones — an L1 milestone never links to another L1 milestone', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.l1MilestoneIds = ['bogus'];
  normalizeData();
  assertDeepEqual(m.l1MilestoneIds, []);
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
  confirmModalAction();
  const tomb = deletedMilestoneIds.find(t => t.id === m.id);
  assertTrue(!!tomb);
  // Simulate an incoming copy of this same L1 Plan that still has the
  // milestone — the sweep in mergeMilestonesArray() should drop it locally
  // since the tombstone is newer than the milestone's own last edit.
  const incomingPlan = { ...p, updatedAt: Date.now() + 1, milestones: [{ ...m, l1MilestoneIds: [] }] };
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
  assertDeepEqual(bare.l1MilestoneIds, [], 'an L1 milestone never links to another L1 milestone');
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

// ---------- L1 Plans Dashboard sub-tab — an explicit user request, placed ----------
// as a sub-tab within L1 Plans itself (mirroring Dashboard mode's own
// Overview/Dependencies split) rather than a new top-level topbar button or
// folded into the main, workstream-scoped Dashboard. Two pieces confirmed
// directly with the user as the most load-bearing to build first: a status
// breakdown across every L1 Plan's own rolled-up status, and a flat
// Delayed list surfacing every place this app's own delayed-color coding
// is currently firing.

test('l1PlansTab defaults to "plans", and renderL1Plans() always renders the Plans/Dashboard sub-tab pill', function () {
  setMode('l1plans');
  renderL1Plans();
  const html = document.getElementById('l1PlansBody').innerHTML;
  assertIncludes(html, 'setL1PlansTab(\'plans\')');
  assertIncludes(html, 'setL1PlansTab(\'dashboard\')');
  assertIncludes(html, 'No L1 Plans yet.', 'defaults to the Plans tab\'s own content');
});

test('setL1PlansTab switches which tab is active and which content renders', function () {
  const p = addL1Plan('Only plan');
  setMode('l1plans');
  setL1PlansTab('dashboard');
  assertEqual(l1PlansTab, 'dashboard');
  let html = document.getElementById('l1PlansBody').innerHTML;
  assertIncludes(html, 'view-tab active');
  assertIncludes(html, 'L1 Plan Status');
  assertNotIncludes(html, 'l1-plans-list', 'the Plans tab\'s own list container should not render on the Dashboard tab');
  setL1PlansTab('plans');
  assertEqual(l1PlansTab, 'plans');
  html = document.getElementById('l1PlansBody').innerHTML;
  assertIncludes(html, 'l1-plans-list');
  assertIncludes(html, esc('Only plan'));
});

test('Import/Export only render on the Plans tab, not the Dashboard tab', function () {
  setMode('l1plans');
  setL1PlansTab('plans');
  assertIncludes(document.getElementById('l1PlansBody').innerHTML, 'triggerL1PlanImport');
  setL1PlansTab('dashboard');
  assertNotIncludes(document.getElementById('l1PlansBody').innerHTML, 'triggerL1PlanImport');
  assertNotIncludes(document.getElementById('l1PlansBody').innerHTML, 'exportL1PlansToExcel');
});

test('isWorkstreamMilestoneLate returns false for both when there is nothing to compare against (no L1 due date)', function () {
  const wm = { id: genId(), name: 'X', dueDate: '2030-01-01', actualDate: '2030-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  assertDeepEqual(isWorkstreamMilestoneLate(wm, null), { dueLate: false, actualLate: false });
});

test('isWorkstreamMilestoneLate flags Due and Actual independently against the given L1 due date', function () {
  const l1Due = '2027-06-01';
  assertDeepEqual(isWorkstreamMilestoneLate({ dueDate: '2027-08-01', actualDate: null }, l1Due), { dueLate: true, actualLate: false });
  assertDeepEqual(isWorkstreamMilestoneLate({ dueDate: '2027-05-01', actualDate: '2027-08-01' }, l1Due), { dueLate: false, actualLate: true });
  assertDeepEqual(isWorkstreamMilestoneLate({ dueDate: '2027-05-01', actualDate: '2027-05-15' }, l1Due), { dueLate: false, actualLate: false });
});

test('isL1MilestoneActualLate is false when there\'s no computed Actual, or no manual Due to compare against', function () {
  assertFalse(isL1MilestoneActualLate({ dueDate: '2027-01-01' }, null));
  assertFalse(isL1MilestoneActualLate({ dueDate: null }, '2027-01-01'));
});

test('l1DelayedEntries includes an L1 milestone whose own rolled-up Actual is later than its own manual Due', function () {
  const p = addL1Plan('Call Money');
  const m = addL1Milestone(p.id, 'Initiation');
  m.dueDate = '2027-05-15';
  const item = addItem({ name: 'Deliverable' });
  // Finishing after the L1's own Due (05-15) makes wm itself the attached
  // half of this signal too (its own actualDate is also past m.dueDate) —
  // both entries are correct and expected here, not a duplicate.
  const wm = { id: genId(), name: 'Finished late', dueDate: '2027-05-01', actualDate: '2027-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const entries = l1DelayedEntries();
  assertEqual(entries.length, 2, 'the L1\'s own rolled-up-Actual entry, plus the attached milestone\'s own Actual also being past the L1 Due');
  const l1Entry = entries.find(e => e.label === 'Call Money — Initiation');
  assertTrue(!!l1Entry, 'the L1 milestone\'s own entry should be present');
  assertEqual(l1Entry.date, '2027-06-01');
  assertEqual(l1Entry.planId, p.id);
  assertEqual(l1Entry.milestoneId, m.id);
});

test('l1DelayedEntries includes an attached milestone whose Due or Actual is later than the L1 milestone\'s own manual Due', function () {
  const p = addL1Plan('Call Money');
  const m = addL1Milestone(p.id, 'Initiation');
  m.dueDate = '2027-06-01';
  const item = addItem({ name: 'Ledger migration' });
  const wm = { id: genId(), name: 'Slipping', dueDate: '2027-08-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  const entries = l1DelayedEntries();
  // wm's own Due, being past m's own manual Due, is now also the latest
  // date in m's own rolled-up Actual (see computedL1MilestoneActualDate()'s
  // Due-or-Actual reversal) — so this correctly produces two entries, the
  // same "both are correct, not a duplicate" shape the L1-Actual-vs-Due test
  // above already establishes, not a regression back to one.
  assertEqual(entries.length, 2);
  const attachedEntry = entries.find(e => e.label === 'Call Money — Initiation: Ledger migration — Slipping');
  assertTrue(!!attachedEntry, 'the attached milestone\'s own entry should be present');
  assertEqual(attachedEntry.date, '2027-08-01');
});

test('l1DelayedEntries skips attached milestones entirely when the L1 milestone has no manual Due set', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id); // dueDate stays null
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Whatever', dueDate: '2030-01-01', actualDate: '2030-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(l1DelayedEntries().length, 0);
});

test('l1DelayedEntries never flags a notApplicable attached milestone — its dates are already cleared, the same as everywhere else in this app', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Skipped', dueDate: null, actualDate: null, status: 'not-started', notApplicable: true, updatedAt: 0, l1MilestoneIds: [m.id] };
  item.milestones.push(wm);
  assertEqual(l1DelayedEntries().length, 0);
});

test('l1DelayedEntries sorts entries oldest-offending first', function () {
  const p = addL1Plan();
  const m1 = addL1Milestone(p.id, 'Later one');
  m1.dueDate = '2027-01-01';
  const m2 = addL1Milestone(p.id, 'Earlier one');
  m2.dueDate = '2027-01-01';
  const item = addItem({ name: 'Deliverable' });
  const wm1 = { id: genId(), name: 'A', dueDate: '2027-09-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m1.id] };
  const wm2 = { id: genId(), name: 'B', dueDate: '2027-03-01', actualDate: null, status: 'amber', notApplicable: false, updatedAt: 0, l1MilestoneIds: [m2.id] };
  item.milestones.push(wm1, wm2);
  const entries = l1DelayedEntries();
  // Each attached milestone's own Due, being past its own L1 milestone's
  // manual Due, now also feeds that L1 milestone's own rolled-up Actual
  // (see computedL1MilestoneActualDate()'s Due-or-Actual reversal) — so
  // each side produces its own entry, 4 total, not 2.
  assertEqual(entries.length, 4);
  assertTrue(entries[0].label.includes('Earlier one') && entries[1].label.includes('Earlier one'), 'the March-dated pair sorts before the September-dated pair');
  assertTrue(entries[2].label.includes('Later one') && entries[3].label.includes('Later one'));
});

test('renderL1PlansDashboardHtml shows a status breakdown counting computeL1PlanStatus() across every L1 Plan', function () {
  const p1 = addL1Plan('On track plan');
  const m1 = addL1Milestone(p1.id);
  m1.status = 'green';
  const p2 = addL1Plan('At risk plan');
  const m2 = addL1Milestone(p2.id);
  m2.status = 'red';
  const html = renderL1PlansDashboardHtml();
  assertIncludes(html, 'L1 Plan Status');
  assertIncludes(html, '>2<', 'two total L1 Plans');
  assertIncludes(html, `1 ${esc(statusLabel('green'))}`);
  assertIncludes(html, `1 ${esc(statusLabel('red'))}`);
});

test('renderL1PlansDashboardHtml shows "Nothing delayed." when there are no delayed entries', function () {
  addL1Plan();
  assertIncludes(renderL1PlansDashboardHtml(), 'Nothing delayed.');
});

test('renderL1PlansDashboardHtml renders a clickable Delayed row wired to openL1MilestoneFromDashboard', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  m.dueDate = '2027-05-15';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Finished late', dueDate: '2027-05-01', actualDate: '2027-06-01', status: 'complete', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const html = renderL1PlansDashboardHtml();
  assertIncludes(html, `onclick="openL1MilestoneFromDashboard('${p.id}','${m.id}')"`);
  assertIncludes(html, 'attention-tag delayed');
  assertIncludes(html, '>Delayed<');
});

test('openL1MilestoneFromDashboard switches to L1 Plans mode, the Plans tab, and expands the plan and milestone', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  setMode('planning');
  setL1PlansTab('dashboard');
  openL1MilestoneFromDashboard(p.id, m.id);
  assertEqual(mode, 'l1plans');
  assertEqual(l1PlansTab, 'plans');
  assertTrue(expandedItemIds.has(p.id));
  assertTrue(expandedL1MilestoneIds.has(m.id));
});

test('l1PlanRollupRows counts each plan\'s own status, total milestones, and how many are linked vs standalone', function () {
  const p = addL1Plan('Call Money');
  const m1 = addL1Milestone(p.id, 'Linked one');
  m1.status = 'green';
  const m2 = addL1Milestone(p.id, 'Standalone one');
  m2.status = 'amber';
  const item = addItem({ name: 'Deliverable' });
  const wm = { id: genId(), name: 'Attached', dueDate: '2027-01-01', actualDate: null, status: 'green', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] };
  item.milestones.push(wm);
  openL1ConnectModal(p.id, m1.id);
  toggleL1MilestoneLink(item.id, wm.id, true);
  const rows = l1PlanRollupRows();
  assertEqual(rows.length, 1);
  const row = rows[0];
  assertEqual(row.plan.id, p.id);
  assertEqual(row.total, 2);
  assertEqual(row.linked, 1, 'm1 has a linked workstream milestone');
  assertEqual(row.standalone, 1, 'm2 has none');
  // m1 is linked, so its status rolls up from the (green) attached
  // milestone rather than reading its own manual 'green' value directly —
  // either way this plan's computed status should be 'green' here, not the
  // vestigial vacuous default.
  assertEqual(row.status, computeL1PlanStatus(p.id));
});

test('l1PlanRollupRows reports zero linked/standalone correctly for a plan with no milestones at all', function () {
  const p = addL1Plan('Empty plan');
  const rows = l1PlanRollupRows();
  assertEqual(rows.length, 1);
  assertEqual(rows[0].total, 0);
  assertEqual(rows[0].linked, 0);
  assertEqual(rows[0].standalone, 0);
  assertEqual(rows[0].status, 'not-started');
});

test('renderL1PlansDashboardHtml renders a Per-plan summary table with a clickable row per plan', function () {
  const p = addL1Plan('Call Money');
  const m = addL1Milestone(p.id, 'Initiation');
  m.status = 'red';
  const html = renderL1PlansDashboardHtml();
  assertIncludes(html, 'Per-plan summary');
  assertIncludes(html, `onclick="openL1PlanFromDashboard('${p.id}')"`);
  assertIncludes(html, esc('Call Money'));
  assertIncludes(html, '1 milestone');
  assertIncludes(html, '0 linked');
  assertIncludes(html, '1 standalone');
  assertIncludes(html, esc(statusLabel('red')));
});

test('renderL1PlansDashboardHtml shows "No L1 Plans yet." in the Per-plan summary when there are none', function () {
  assertIncludes(renderL1PlansDashboardHtml(), 'No L1 Plans yet.');
});

test('openL1PlanFromDashboard switches to L1 Plans mode, the Plans tab, and expands the plan (no milestone expand)', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  setMode('planning');
  setL1PlansTab('dashboard');
  openL1PlanFromDashboard(p.id);
  assertEqual(mode, 'l1plans');
  assertEqual(l1PlansTab, 'plans');
  assertTrue(expandedItemIds.has(p.id));
  assertFalse(expandedL1MilestoneIds.has(m.id));
});

// ---------- The "Unlinked" sub-tab: milestones with no L1 traceability ----------
// An explicit user request ("provide a view a under l1 plans that lists all
// scope items which are not linked to any l1 milestone"), later reshaped
// from a per-item list into a per-milestone table ("change the unlinked
// page to a view like on this screenshot") — see unlinkedMilestones()'s own
// comment in pulse.html for the exact filtering semantics this exercises.

function unlinkedMilestoneFixture(overrides) {
  return Object.assign({ id: genId(), name: 'M', dueDate: null, actualDate: null, status: 'not-started', notApplicable: false, updatedAt: 0, l1MilestoneIds: [] }, overrides || {});
}

test('unlinkedMilestones excludes every L1 Plan\'s own milestones', function () {
  const p = addL1Plan('A Plan');
  addL1Milestone(p.id);
  assertEqual(unlinkedMilestones().length, 0);
});

test('unlinkedMilestones excludes a genuinely zero-milestone scope item — nothing there to individually link', function () {
  addItem({ name: 'No milestones yet' });
  assertEqual(unlinkedMilestones().length, 0);
});

test('unlinkedMilestones includes every milestone on a scope item whose milestones are all unlinked', function () {
  const it = addItem({ name: 'All unlinked' });
  const m1 = unlinkedMilestoneFixture({ name: 'M1' });
  const m2 = unlinkedMilestoneFixture({ name: 'M2' });
  it.milestones.push(m1, m2);
  const entries = unlinkedMilestones();
  assertEqual(entries.length, 2);
  assertTrue(entries.some(e => e.milestone === m1));
  assertTrue(entries.some(e => e.milestone === m2));
});

test('unlinkedMilestones includes only the still-unlinked milestones on an item that\'s partially traced', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const it = addItem({ name: 'Partially traced' });
  const linkedOne = unlinkedMilestoneFixture({ name: 'Linked', l1MilestoneIds: [m.id] });
  const stillUnlinked = unlinkedMilestoneFixture({ name: 'Still unlinked' });
  it.milestones.push(linkedOne, stillUnlinked);
  const entries = unlinkedMilestones();
  assertEqual(entries.length, 1);
  assertEqual(entries[0].milestone, stillUnlinked);
});

test('unlinkedMilestonesSorted sorts by workstream display order, Unassigned last, then by the item\'s own name within each', function () {
  const wsB = { id: genId(), name: 'B Stream', color: 'teal', order: 1 };
  workstreams.push(wsB); // workstreams[0] ('Workstream 1', order 0) already exists from resetState()
  const itemInB = addItem({ name: 'In B', workstreamId: wsB.id });
  const itemUnassigned = addItem({ name: 'Unassigned item', workstreamId: null });
  const itemFirstZ = addItem({ name: 'Z in first stream', workstreamId: workstreams[0].id });
  const itemFirstA = addItem({ name: 'A in first stream', workstreamId: workstreams[0].id });
  [itemInB, itemUnassigned, itemFirstZ, itemFirstA].forEach(it => it.milestones.push(unlinkedMilestoneFixture({ name: `${it.name} milestone` })));
  const sorted = unlinkedMilestonesSorted();
  assertDeepEqual(sorted.map(e => e.item.id), [itemFirstA.id, itemFirstZ.id, itemInB.id, itemUnassigned.id]);
});

test('unlinkedMilestonesSorted keeps an item\'s own milestones in their existing array order relative to each other', function () {
  const it = addItem({ name: 'Multi' });
  const m1 = unlinkedMilestoneFixture({ name: 'First' });
  const m2 = unlinkedMilestoneFixture({ name: 'Second' });
  it.milestones.push(m1, m2);
  assertDeepEqual(unlinkedMilestonesSorted().map(e => e.milestone.id), [m1.id, m2.id]);
});

test('renderL1UnlinkedItemsHtml shows the count in its own header', function () {
  addItem({ name: 'One' }).milestones.push(unlinkedMilestoneFixture());
  addItem({ name: 'Two' }).milestones.push(unlinkedMilestoneFixture());
  const html = renderL1UnlinkedItemsHtml();
  assertIncludes(html, 'Not Linked to an L1 Milestone (2)');
});

test('renderL1UnlinkedItemsHtml renders each row as Workstream / Scope Item / Milestone / Due, with an icon-only Link action at Editor+', function () {
  const it = addItem({ name: 'Migrate billing', workstreamId: workstreams[0].id });
  const m = unlinkedMilestoneFixture({ name: 'Design defined', dueDate: '2026-09-01' });
  it.milestones.push(m);
  const html = renderL1UnlinkedItemsHtml();
  assertIncludes(html, `<span class="l1-unlinked-source">${esc(workstreams[0].name)}</span>`);
  assertIncludes(html, `<span class="l1-unlinked-source">Migrate billing</span>`);
  assertIncludes(html, '<span>Design defined</span>');
  assertIncludes(html, fmtDate('2026-09-01'));
  assertIncludes(html, `<button class="row-icon-btn" onclick="openL1PickModal('${it.id}','${m.id}')"`);
  assertIncludes(html, 'fa-link');
});

test('renderL1UnlinkedItemsHtml shows an em dash for a milestone with no Due date set', function () {
  const it = addItem({ name: 'No date' });
  it.milestones.push(unlinkedMilestoneFixture({ name: 'M', dueDate: null }));
  assertIncludes(renderL1UnlinkedItemsHtml(), '—');
});

test('renderL1UnlinkedItemsHtml renders an inert placeholder, not a Link button, below Editor', function () {
  const it = addItem({ name: 'Migrate billing' });
  it.milestones.push(unlinkedMilestoneFixture());
  userRole = 'reviewer';
  const html = renderL1UnlinkedItemsHtml();
  assertNotIncludes(html, 'openL1PickModal');
});

test('renderL1UnlinkedItemsHtml labels an Unassigned item\'s row "Unassigned", not a blank/missing workstream name', function () {
  const it = addItem({ name: 'Orphan', workstreamId: null });
  it.milestones.push(unlinkedMilestoneFixture());
  assertIncludes(renderL1UnlinkedItemsHtml(), '<span class="l1-unlinked-source">Unassigned</span>');
});

test('renderL1UnlinkedItemsHtml shows an empty-state message when every milestone is linked', function () {
  const p = addL1Plan();
  const m = addL1Milestone(p.id);
  const it = addItem({ name: 'Fully traced' });
  it.milestones.push(unlinkedMilestoneFixture({ l1MilestoneIds: [m.id] }));
  const html = renderL1UnlinkedItemsHtml();
  assertIncludes(html, 'Every scope item milestone is linked to an L1 milestone.');
  assertNotIncludes(html, 'openL1PickModal');
});

test('renderL1UnlinkedItemsHtml shows the same empty-state message when there are no scope items at all', function () {
  assertIncludes(renderL1UnlinkedItemsHtml(), 'Every scope item milestone is linked to an L1 milestone.');
});

test('renderL1Plans() adds a third "Unlinked" sub-tab alongside Plans/Dashboard, and setL1PlansTab(\'unlinked\') switches to it', function () {
  mode = 'l1plans';
  setL1PlansTab('plans');
  render();
  let html = document.getElementById('l1PlansBody').innerHTML;
  assertIncludes(html, `onclick="setL1PlansTab('unlinked')"`);
  const it = addItem({ name: 'Untraced item' });
  it.milestones.push(unlinkedMilestoneFixture());
  setL1PlansTab('unlinked');
  assertEqual(l1PlansTab, 'unlinked');
  html = document.getElementById('l1PlansBody').innerHTML;
  assertIncludes(html, 'Not Linked to an L1 Milestone');
  assertIncludes(html, 'Untraced item');
  assertNotIncludes(html, 'No L1 Plans yet.', 'the Plans tab\'s own empty-state text should not leak into the Unlinked tab');
});

test('renderL1Plans() marks the Unlinked tab button active only while l1PlansTab is \'unlinked\'', function () {
  mode = 'l1plans';
  setL1PlansTab('unlinked');
  render();
  const html = document.getElementById('l1PlansBody').innerHTML;
  assertIncludes(html, `<button class="view-tab active" onclick="setL1PlansTab('unlinked')">`);
});

test('Import/Export/expand-all only render on the Plans tab, not on Unlinked either', function () {
  mode = 'l1plans';
  setL1PlansTab('unlinked');
  render();
  const html = document.getElementById('l1PlansBody').innerHTML;
  assertNotIncludes(html, 'triggerL1PlanImport');
  assertNotIncludes(html, 'exportL1PlansToExcel');
});

// ---------- The L1 milestone picker (l1PickModalBg) ----------
// The Unlinked tab's own Link icon — a later, explicit user request
// ("instead of the checkmark icon, add a link button wich opens a modal to
// select from the L1 milestones") — opens this modal to pick which L1
// milestone(s) one already-known workstream milestone should link to,
// via a checkbox per candidate — a further, explicit user request
// ("change the link item to a checkbox to allow linking to multiple l1
// milestones").

test('openL1PickModal sets the modal title from the milestone\'s own name and opens it', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture({ name: 'Design defined' });
  it.milestones.push(m);
  openL1PickModal(it.id, m.id);
  assertEqual(document.getElementById('l1PickModalTitle').textContent, 'Link "Design defined" to an L1 Milestone');
  assertTrue(document.getElementById('l1PickModalBg').classList.contains('open'));
});

test('openL1PickModal is blocked below Editor', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  userRole = 'reviewer';
  openL1PickModal(it.id, m.id);
  assertFalse(document.getElementById('l1PickModalBg').classList.contains('open'));
});

test('closeL1PickModal closes the modal and clears its own module state', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  openL1PickModal(it.id, m.id);
  closeL1PickModal();
  assertFalse(document.getElementById('l1PickModalBg').classList.contains('open'));
  assertEqual(l1PickItemId, null);
  assertEqual(l1PickMilestoneId, null);
});

test('renderL1PickList lists every L1 Plan\'s every milestone as a candidate, each with an unchecked checkbox', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  const p = addL1Plan('Digital Transformation');
  const l1m = addL1Milestone(p.id, 'Kickoff');
  openL1PickModal(it.id, m.id);
  const html = document.getElementById('l1PickList').innerHTML;
  assertIncludes(html, 'Digital Transformation');
  assertIncludes(html, 'Kickoff');
  assertIncludes(html, `onchange="toggleL1PickMilestoneLink('${p.id}','${l1m.id}', this.checked)"`);
  assertNotIncludes(html, 'checked>', 'nothing is linked yet, so no box should render pre-checked');
});

test('renderL1PickList pre-checks a candidate the milestone is already linked to', function () {
  const it = addItem({ name: 'Migrate billing' });
  const p = addL1Plan('Digital Transformation');
  const l1m = addL1Milestone(p.id, 'Kickoff');
  const m = unlinkedMilestoneFixture({ l1MilestoneIds: [l1m.id] });
  it.milestones.push(m);
  openL1PickModal(it.id, m.id);
  const html = document.getElementById('l1PickList').innerHTML;
  assertIncludes(html, `<input type="checkbox" checked onchange="toggleL1PickMilestoneLink('${p.id}','${l1m.id}', this.checked)">`);
});

test('renderL1PickList narrows candidates by the search box, matching either the L1 milestone or its plan\'s name', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  const p1 = addL1Plan('Digital Transformation');
  addL1Milestone(p1.id, 'Kickoff');
  const p2 = addL1Plan('Finance Programme');
  addL1Milestone(p2.id, 'Go-live');
  openL1PickModal(it.id, m.id);
  document.getElementById('l1PickSearchInput').value = 'finance';
  renderL1PickList();
  const html = document.getElementById('l1PickList').innerHTML;
  assertIncludes(html, 'Finance Programme');
  assertNotIncludes(html, 'Digital Transformation');
});

test('renderL1PickList shows a "no matching" message when nothing matches the search', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  const p = addL1Plan();
  addL1Milestone(p.id);
  openL1PickModal(it.id, m.id);
  document.getElementById('l1PickSearchInput').value = 'nonexistent query';
  renderL1PickList();
  assertIncludes(document.getElementById('l1PickList').innerHTML, 'No matching L1 milestones.');
});

test('toggleL1PickMilestoneLink(true) adds the id to the milestone\'s own l1MilestoneIds and re-renders the list, without closing the modal', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  const p = addL1Plan();
  const l1m = addL1Milestone(p.id);
  openL1PickModal(it.id, m.id);
  toggleL1PickMilestoneLink(p.id, l1m.id, true);
  assertDeepEqual(m.l1MilestoneIds, [l1m.id]);
  assertTrue(document.getElementById('l1PickModalBg').classList.contains('open'), 'checking a box commits immediately but leaves the modal open for more selections');
});

test('toggleL1PickMilestoneLink(false) removes the id, leaving any other links on the same milestone untouched', function () {
  const it = addItem({ name: 'Migrate billing' });
  const p1 = addL1Plan();
  const l1m1 = addL1Milestone(p1.id);
  const p2 = addL1Plan();
  const l1m2 = addL1Milestone(p2.id);
  const m = unlinkedMilestoneFixture({ l1MilestoneIds: [l1m1.id, l1m2.id] });
  it.milestones.push(m);
  openL1PickModal(it.id, m.id);
  toggleL1PickMilestoneLink(p1.id, l1m1.id, false);
  assertDeepEqual(m.l1MilestoneIds, [l1m2.id]);
});

test('checking multiple boxes links the same workstream milestone to multiple L1 milestones at once', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  const p1 = addL1Plan();
  const l1m1 = addL1Milestone(p1.id);
  const p2 = addL1Plan();
  const l1m2 = addL1Milestone(p2.id);
  openL1PickModal(it.id, m.id);
  toggleL1PickMilestoneLink(p1.id, l1m1.id, true);
  toggleL1PickMilestoneLink(p2.id, l1m2.id, true);
  assertDeepEqual(m.l1MilestoneIds, [l1m1.id, l1m2.id]);
});

test('toggleL1PickMilestoneLink is blocked below Editor', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  const p = addL1Plan();
  const l1m = addL1Milestone(p.id);
  openL1PickModal(it.id, m.id);
  userRole = 'reviewer';
  toggleL1PickMilestoneLink(p.id, l1m.id, true);
  assertDeepEqual(m.l1MilestoneIds, []);
});

test('a milestone linked via toggleL1PickMilestoneLink drops off the Unlinked tab\'s own list', function () {
  const it = addItem({ name: 'Migrate billing' });
  const m = unlinkedMilestoneFixture();
  it.milestones.push(m);
  const p = addL1Plan();
  const l1m = addL1Milestone(p.id);
  assertEqual(unlinkedMilestones().length, 1);
  openL1PickModal(it.id, m.id);
  toggleL1PickMilestoneLink(p.id, l1m.id, true);
  assertEqual(unlinkedMilestones().length, 0);
});
