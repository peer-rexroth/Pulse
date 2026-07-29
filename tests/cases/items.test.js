function fillItemForm(overrides) {
  const f = Object.assign({
    name: 'Ship schema v1', start: '2026-08-01', due: '2026-08-15', actual: '',
    status: 'amber'
  }, overrides || {});
  document.getElementById('itemNameInput').value = f.name;
  document.getElementById('itemStartInput').value = f.start;
  document.getElementById('itemDueInput').value = f.due;
  document.getElementById('itemActualInput').value = f.actual;
  document.getElementById('itemStatusSelect').value = f.status;
  document.getElementById('itemWorkstreamSelect').value = f.workstreamId || workstreams[0].id;
}

test('opening a new item modal seeds the standard set of milestones', function () {
  openItemModal(null);
  assertEqual(editingMilestones.length, DEFAULT_CATEGORY_MILESTONES.length);
  assertEqual(editingMilestones[0].name, 'Requirements Defined');
  assertEqual(editingMilestones[editingMilestones.length - 1].name, 'Deployment Completed');
  editingMilestones.forEach(m => assertEqual(m.status, 'not-started'));
});

test('standard milestones default their date to the due date shown when the modal opened', function () {
  openItemModal(null);
  const due = document.getElementById('itemDueInput').value;
  assertTrue(!!due, 'due date field should be pre-filled for a new item');
  editingMilestones.forEach(m => assertEqual(m.dueDate, due));
});

// ---------- Editing an Unassigned item keeps it Unassigned ----------
// A user-reported bug: opening an Unassigned (workstreamId: null) item's
// full edit modal and saving *anything* — even just a due date, never
// touching the Workstream field at all — silently moved it into the first
// real workstream. Root cause: populateWorkstreamSelect() only ever built
// <option>s for real workstreams, so a null selectedId never matched any of
// them, and the browser defaulted the select to its first option regardless
// of what the item's own workstreamId actually was. saveItem() then read
// that default straight out of the select and wrote it back as if the user
// had chosen it.

test('opening an Unassigned item\'s modal adds a matching, selected "Unassigned" option to the Workstream select', function () {
  const it = { id: genId(), workstreamId: null, categoryId: categories[0].id, name: 'Unassigned item', owner: '', status: 'not-started', actualDate: null, startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);
  openItemModal(it.id);
  const html = document.getElementById('itemWorkstreamSelect').innerHTML;
  assertIncludes(html, '<option value="" selected>Unassigned</option>');
  assertEqual(document.getElementById('itemWorkstreamSelect').value, '', 'the select itself should read as the Unassigned option, not silently default to the first real workstream');
});

test('opening a new item\'s modal never offers an Unassigned option — only editing an already-Unassigned item does', function () {
  openItemModal(null);
  assertNotIncludes(document.getElementById('itemWorkstreamSelect').innerHTML, 'Unassigned');
});

test('opening an already-assigned item\'s modal never offers an Unassigned option either', function () {
  const it = { id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'Assigned item', owner: '', status: 'not-started', actualDate: null, startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);
  openItemModal(it.id);
  assertNotIncludes(document.getElementById('itemWorkstreamSelect').innerHTML, 'Unassigned');
});

test('saveItem keeps an Unassigned item Unassigned when only an unrelated field (like Due) is edited', function () {
  const it = { id: genId(), workstreamId: null, categoryId: categories[0].id, name: 'Unassigned item', owner: '', status: 'not-started', actualDate: null, startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);
  openItemModal(it.id);
  document.getElementById('itemDueInput').value = '2026-09-01';
  saveItem();
  assertEqual(items[0].workstreamId, null, 'saving should never silently reassign an Unassigned item to whatever workstream the select happened to default to');
  assertEqual(items[0].dueDate, '2026-09-01');
});

test('saveItem still correctly assigns a real workstream when the user explicitly picks one for a previously-Unassigned item', function () {
  const it = { id: genId(), workstreamId: null, categoryId: categories[0].id, name: 'Unassigned item', owner: '', status: 'not-started', actualDate: null, startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);
  openItemModal(it.id);
  document.getElementById('itemWorkstreamSelect').value = workstreams[0].id;
  saveItem();
  assertEqual(items[0].workstreamId, workstreams[0].id);
});

test('saveItem creates a scope item carrying the standard milestones through', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  assertEqual(items.length, 1);
  const it = items[0];
  assertEqual(it.name, 'Ship schema v1');
  // Start/Due are computed from the milestones (all seeded to today's date
  // at modal-open time, before fillItemForm's manual dates were entered) —
  // see "Item date range roll-up" in CLAUDE.md for why the manual Start/Due
  // fields in fillItemForm() are ignored once an item has milestones.
  assertEqual(it.startDate, todayStr());
  assertEqual(it.dueDate, todayStr());
  assertEqual(it.milestones.length, DEFAULT_CATEGORY_MILESTONES.length);
  assertEqual(it.milestones[0].name, 'Requirements Defined');
});

// ---------- Owner was removed as a concept — an explicit user request ----------
test('saveItem never writes an owner field onto a saved item', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  assertFalse(Object.prototype.hasOwnProperty.call(items[0], 'owner'), 'owner should no longer be part of the saved item shape at all');
});

test('itemRowHtml never shows an owner icon/name, even for a legacy item that still has one from before the field was removed', function () {
  const it = addItem({ name: 'Legacy item', owner: 'Someone', milestones: [] });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'fa-user', 'the owner icon must never render, regardless of leftover legacy data');
  assertNotIncludes(html, 'Someone');
});

test('saveItem rejects an empty name', function () {
  openItemModal(null);
  fillItemForm({ name: '   ' });
  saveItem();
  assertEqual(items.length, 0);
});

test('editing an item preserves its existing milestones, not the standard set', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const id = items[0].id;
  // hand-edit one milestone directly on the saved item, as if from a prior session
  items[0].milestones[0].status = 'complete';
  items[0].milestones = items[0].milestones.slice(0, 2); // simulate user having removed some
  openItemModal(id);
  assertEqual(editingMilestones.length, 2);
  assertEqual(editingMilestones[0].status, 'complete');
  saveItem();
  assertEqual(items[0].milestones.length, 2);
});

// ---------- Per-milestone updatedAt on save (see mergeData()'s per-milestone merge) ----------

test('saveItem only bumps a milestone\'s updatedAt when its content actually changed', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const id = items[0].id;
  items[0].milestones.forEach(m => { m.updatedAt = 1000; }); // sentinel: "last touched long ago"
  openItemModal(id);
  editingMilestones[0].status = 'complete'; // only touch the first milestone
  saveItem();
  assertTrue(items[0].milestones[0].updatedAt > 1000, 'the changed milestone should get a fresh updatedAt');
  assertEqual(items[0].milestones[1].updatedAt, 1000, 'an untouched milestone must keep its prior updatedAt exactly — a future merge treats a bumped timestamp as "edited here"');
});

test('saveItem tombstones a milestone that was removed via the modal', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const id = items[0].id;
  const removedId = items[0].milestones[1].id;
  openItemModal(id);
  editingMilestones.splice(1, 1);
  saveItem();
  assertFalse(items[0].milestones.some(m => m.id === removedId));
  assertTrue(deletedMilestoneIds.some(x => x.id === removedId), 'a merge must be able to tell this milestone was deleted, not just never seen');
});

test('removeMilestoneRow removes one row from the in-progress edit without touching saved data yet', function () {
  openItemModal(null);
  assertEqual(editingMilestones.length, DEFAULT_CATEGORY_MILESTONES.length);
  removeMilestoneRow(2); // removes "Design Defined"
  assertEqual(editingMilestones.length, DEFAULT_CATEGORY_MILESTONES.length - 1);
  assertEqual(editingMilestones[2].name, 'Build Completed');
  assertEqual(items.length, 0, 'nothing should be saved until Save is clicked');
});

test('a milestone with a blanked-out name falls back to a placeholder on save', function () {
  openItemModal(null);
  editingMilestones[0].name = '   ';
  fillItemForm({});
  saveItem();
  assertEqual(items[0].milestones[0].name, 'Untitled milestone');
});

test('cycleMilestoneStatus advances through the STATUSES list and wraps around', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  const mId = it.milestones[0].id;
  assertEqual(it.milestones[0].status, 'not-started');
  cycleMilestoneStatus(it.id, mId);
  assertEqual(items[0].milestones[0].status, 'green');
  cycleMilestoneStatus(it.id, mId);
  assertEqual(items[0].milestones[0].status, 'amber');
  cycleMilestoneStatus(it.id, mId);
  assertEqual(items[0].milestones[0].status, 'red');
  cycleMilestoneStatus(it.id, mId);
  assertEqual(items[0].milestones[0].status, 'complete');
  cycleMilestoneStatus(it.id, mId);
  assertEqual(items[0].milestones[0].status, 'not-started');
});

test('deleteItemFromModal removes the item and all its nested milestones', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  editingItemId = items[0].id;
  deleteItemFromModal();
  confirmModalAction(); // simulate clicking "Delete" in the confirm modal
  assertEqual(items.length, 0);
});

test('opening a new item modal preselects the given workstream', function () {
  document.getElementById('wsNameInput').value = 'Second Stream';
  wsColorChoice = 'amber';
  saveWorkstream();
  const secondId = workstreams[1].id;
  openItemModal(null, secondId);
  assertIncludes(document.getElementById('itemWorkstreamSelect').innerHTML, `value="${secondId}" selected`);
});

// ---------- Actual completion date (manual, item + milestone) ----------

test('a new item has no actual completion date by default', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  assertEqual(items[0].actualDate, null);
});

test('saveItem persists a manually-entered actual completion date', function () {
  openItemModal(null);
  fillItemForm({ actual: '2026-08-20' });
  saveItem();
  assertEqual(items[0].actualDate, '2026-08-20');
});

test('setting status to Complete does not auto-fill the actual date — it stays manual', function () {
  openItemModal(null);
  fillItemForm({ status: 'complete' });
  saveItem();
  assertEqual(items[0].actualDate, null, 'actual date must be entered by hand, not inferred from status');
});

test('editing an item preserves and can update its actual completion date', function () {
  openItemModal(null);
  fillItemForm({ actual: '2026-08-20' });
  saveItem();
  const id = items[0].id;
  openItemModal(id);
  assertEqual(document.getElementById('itemActualInput').value, '2026-08-20');
  fillItemForm({ actual: '2026-08-22' });
  saveItem();
  assertEqual(items[0].actualDate, '2026-08-22');
});

test('clearing the actual date field back out saves it as null, not an empty string', function () {
  openItemModal(null);
  fillItemForm({ actual: '2026-08-20' });
  saveItem();
  const id = items[0].id;
  openItemModal(id);
  document.getElementById('itemActualInput').value = '';
  fillItemForm({ actual: '' });
  saveItem();
  assertEqual(items[0].actualDate, null);
});

test('a milestone has no actual completion date by default, and one can be set on it', function () {
  openItemModal(null);
  fillItemForm({});
  assertEqual(editingMilestones[0].actualDate, null);
  editingMilestones[0].actualDate = '2026-08-10';
  saveItem();
  assertEqual(items[0].milestones[0].actualDate, '2026-08-10');
});

test('removing a milestone\'s actual date via the editor saves it back to null', function () {
  openItemModal(null);
  fillItemForm({});
  editingMilestones[0].actualDate = '2026-08-10';
  saveItem();
  const id = items[0].id;
  openItemModal(id);
  assertEqual(editingMilestones[0].actualDate, '2026-08-10');
  editingMilestones[0].actualDate = '';
  saveItem();
  assertEqual(items[0].milestones[0].actualDate, null);
});

// ---------- Item status computed from the weakest milestone ----------

test('computedStatusFromMilestones picks the worst status: Red > Amber > Green > Not Started > Complete', function () {
  assertEqual(computedStatusFromMilestones([{ status: 'green' }, { status: 'red' }, { status: 'amber' }]), 'red');
  assertEqual(computedStatusFromMilestones([{ status: 'green' }, { status: 'amber' }]), 'amber');
  assertEqual(computedStatusFromMilestones([{ status: 'green' }, { status: 'not-started' }]), 'green');
  assertEqual(computedStatusFromMilestones([{ status: 'not-started' }, { status: 'complete' }]), 'not-started');
  assertEqual(computedStatusFromMilestones([{ status: 'complete' }, { status: 'complete' }]), 'complete');
  assertEqual(computedStatusFromMilestones([]), null);
});

test('saveItem computes the item status from its milestones, ignoring the Status select', function () {
  openItemModal(null);
  editingMilestones[0].status = 'red'; // one bad milestone among the rest ('not-started')
  fillItemForm({ status: 'green' }); // manual selection should be ignored
  saveItem();
  assertEqual(items[0].status, 'red');
});

test('saveItem uses the manual Status select when the item has no milestones', function () {
  openItemModal(null);
  editingMilestones = [];
  renderMilestonesEditor();
  fillItemForm({ status: 'amber' });
  saveItem();
  assertEqual(items[0].status, 'amber');
});

test('cycleMilestoneStatus recomputes the parent item status after each change', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  assertEqual(it.status, 'not-started'); // all milestones start not-started
  cycleMilestoneStatus(it.id, it.milestones[1].id); // -> green, which outranks (is weaker than) not-started
  assertEqual(items[0].status, 'green', 'green is weaker than not-started under this severity order');
  cycleMilestoneStatus(it.id, it.milestones[2].id);
  cycleMilestoneStatus(it.id, it.milestones[2].id); // -> amber
  assertEqual(items[0].status, 'amber');
  cycleMilestoneStatus(it.id, it.milestones[3].id);
  cycleMilestoneStatus(it.id, it.milestones[3].id);
  cycleMilestoneStatus(it.id, it.milestones[3].id); // -> red
  assertEqual(items[0].status, 'red', 'red should now outrank amber');
});

test('the item modal shows a read-only computed badge when milestones exist, and an editable select when they don\'t', function () {
  openItemModal(null);
  assertEqual(document.getElementById('itemStatusSelect').style.display, 'none');
  assertEqual(document.getElementById('itemStatusComputed').style.display, '');
  editingMilestones = [];
  renderMilestonesEditor();
  assertEqual(document.getElementById('itemStatusSelect').style.display, '');
  assertEqual(document.getElementById('itemStatusComputed').style.display, 'none');
});

test('the computed status badge updates live when a milestone\'s status changes in the editor', function () {
  openItemModal(null);
  editingMilestones[0].status = 'red';
  updateItemStatusFieldMode();
  assertEqual(document.getElementById('itemStatusComputedBadge').textContent, 'Off Track');
});

// ---------- Item plan date range computed from the earliest/latest milestone date ----------

test('computedDateRangeFromMilestones spans the earliest to the latest date, considering both due and actual dates', function () {
  assertDeepEqual(
    computedDateRangeFromMilestones([{ dueDate: '2026-03-10', actualDate: null }, { dueDate: '2026-03-05', actualDate: null }]),
    { startDate: '2026-03-05', dueDate: '2026-03-10' }
  );
  // An actual date earlier or later than every dueDate should widen the range.
  assertDeepEqual(
    computedDateRangeFromMilestones([{ dueDate: '2026-03-10', actualDate: '2026-03-20' }, { dueDate: '2026-03-05', actualDate: null }]),
    { startDate: '2026-03-05', dueDate: '2026-03-20' }
  );
  assertEqual(computedDateRangeFromMilestones([]), null);
});

test('saveItem computes the item\'s plan date range from its milestones, ignoring the manual Start/Due inputs', function () {
  openItemModal(null);
  editingMilestones.forEach(m => { m.dueDate = '2026-05-15'; }); // control every seeded milestone, not just some
  editingMilestones[0].dueDate = '2026-05-01';
  editingMilestones[1].dueDate = '2026-06-15';
  fillItemForm({ start: '2099-01-01', due: '2099-01-01' }); // should be ignored — milestones exist
  saveItem();
  assertEqual(items[0].startDate, '2026-05-01');
  assertEqual(items[0].dueDate, '2026-06-15');
});

test('saveItem uses the manual Start/Due inputs when the item has no milestones', function () {
  openItemModal(null);
  editingMilestones = [];
  renderMilestonesEditor();
  fillItemForm({ start: '2026-04-01', due: '2026-04-20' });
  saveItem();
  assertEqual(items[0].startDate, '2026-04-01');
  assertEqual(items[0].dueDate, '2026-04-20');
});

test('updateMilestoneDateField recomputes the parent item\'s plan date range immediately', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  updateMilestoneDateField(it.id, it.milestones[0].id, 'dueDate', '2099-12-31');
  assertEqual(items[0].dueDate, '2099-12-31', 'a milestone pushed further out should widen the item\'s computed due date');
});

test('the item modal shows a read-only computed date range when milestones exist, and editable Start/Due inputs when they don\'t', function () {
  openItemModal(null);
  assertEqual(document.getElementById('itemDatesManual').style.display, 'none');
  assertEqual(document.getElementById('itemDatesComputed').style.display, '');
  editingMilestones = [];
  renderMilestonesEditor();
  assertEqual(document.getElementById('itemDatesManual').style.display, '');
  assertEqual(document.getElementById('itemDatesComputed').style.display, 'none');
});

test('the computed date range preview updates live when a milestone\'s date changes in the editor, and stays in sync on the hidden inputs', function () {
  openItemModal(null);
  editingMilestones[0].dueDate = '2026-07-04';
  updateItemStatusFieldMode();
  assertIncludes(document.getElementById('itemDatesComputedBadge').textContent, '→');
  assertEqual(document.getElementById('itemDueInput').value, editingMilestones.reduce((max, m) => m.dueDate > max ? m.dueDate : max, editingMilestones[0].dueDate));
});

// ---------- Not Applicable milestones ----------
// A milestone marked notApplicable is excluded from every roll-up it would
// otherwise feed into — the item's computed status, its computed plan date
// range, the "X/Y milestones" badge, Dashboard completion %/Overdue/
// Upcoming, and a review cycle's per-milestone confirmation requirement
// (see review.test.js/dashboard.test.js for those) — without touching its
// own status value, so un-marking it restores whatever status it had.

test('computedStatusFromMilestones excludes notApplicable milestones from the weakest-link comparison', function () {
  assertEqual(computedStatusFromMilestones([{ status: 'green' }, { status: 'red', notApplicable: true }]), 'green', 'the notApplicable red milestone must not drag the result down to red');
  assertEqual(computedStatusFromMilestones([{ status: 'complete', notApplicable: true }, { status: 'amber' }]), 'amber');
});

test('computedStatusFromMilestones falls back to "not-started" when every milestone is notApplicable — not null, since the item still has milestones', function () {
  assertEqual(computedStatusFromMilestones([{ status: 'red', notApplicable: true }, { status: 'complete', notApplicable: true }]), 'not-started');
});

test('computedStatusFromMilestones still returns null for a genuinely empty list, same as before notApplicable existed', function () {
  assertEqual(computedStatusFromMilestones([]), null);
});

test('computedDateRangeFromMilestones excludes notApplicable milestones\' dates from the range', function () {
  assertDeepEqual(
    computedDateRangeFromMilestones([
      { dueDate: '2026-03-10', actualDate: null },
      { dueDate: '2099-01-01', actualDate: null, notApplicable: true } // would otherwise blow the range out to 2099
    ]),
    { startDate: '2026-03-10', dueDate: '2026-03-10' }
  );
});

test('computedDateRangeFromMilestones returns null when every milestone is notApplicable, leaving the item\'s existing plan dates untouched by its callers', function () {
  assertEqual(computedDateRangeFromMilestones([{ dueDate: '2026-03-10', actualDate: null, notApplicable: true }]), null);
});

test('toggleMilestoneNotApplicable flips the flag without touching the milestone\'s own status, and recomputes the item\'s rolled-up status/dates', function () {
  openItemModal(null);
  editingMilestones[0].status = 'red';
  editingMilestones[1].dueDate = '2099-12-31'; // would otherwise be the item's computed due date
  fillItemForm({});
  saveItem();
  const it = items[0];
  assertEqual(it.status, 'red', 'sanity check');

  toggleMilestoneNotApplicable(it.id, it.milestones[0].id);
  assertEqual(items[0].milestones[0].notApplicable, true);
  assertEqual(items[0].milestones[0].status, 'red', 'status itself must be untouched — only excluded from the roll-up');
  assertTrue(items[0].status !== 'red', 'the item\'s own computed status should no longer be dragged down by the now-excluded milestone');

  toggleMilestoneNotApplicable(it.id, it.milestones[1].id);
  assertTrue(items[0].dueDate !== '2099-12-31', 'the item\'s computed due date should no longer include the now-excluded milestone\'s date');

  toggleMilestoneNotApplicable(it.id, it.milestones[0].id); // un-mark
  assertEqual(items[0].milestones[0].notApplicable, false);
  assertEqual(items[0].status, 'red', 'un-marking should restore the milestone\'s own preserved status to the roll-up');
});

test('toggleMilestoneNotApplicable clears both Due and Actual dates, and leaves them cleared when un-marked', function () {
  openItemModal(null);
  editingMilestones[0].actualDate = '2026-06-01';
  fillItemForm({});
  saveItem();
  const it = items[0];
  assertTrue(!!it.milestones[0].dueDate, 'sanity check — a milestone always starts with a due date');
  assertEqual(it.milestones[0].actualDate, '2026-06-01', 'sanity check');

  toggleMilestoneNotApplicable(it.id, it.milestones[0].id);
  assertEqual(items[0].milestones[0].dueDate, null);
  assertEqual(items[0].milestones[0].actualDate, null);

  toggleMilestoneNotApplicable(it.id, it.milestones[0].id); // un-mark
  assertEqual(items[0].milestones[0].dueDate, null, 'un-marking does not try to restore the old date — it stays blank');
  assertEqual(items[0].milestones[0].actualDate, null);
});

test('normalizeData does not refill a notApplicable milestone\'s cleared due date from the parent item', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  toggleMilestoneNotApplicable(it.id, it.milestones[0].id);
  assertEqual(items[0].milestones[0].dueDate, null, 'sanity check');
  normalizeData();
  assertEqual(items[0].milestones[0].dueDate, null, 'the backfill-from-parent-item rule must not undo a deliberate clear');
});

test('toggleMilestoneNotApplicable is blocked below Editor', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  userRole = 'reviewer';
  toggleMilestoneNotApplicable(it.id, it.milestones[0].id);
  assertEqual(items[0].milestones[0].notApplicable, false, 'toggling must have been blocked below Editor');
});

test('toggleMilestoneNotApplicable logs a plain-text review change entry', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  startReviewCycle(it.workstreamId);
  toggleMilestoneNotApplicable(it.id, it.milestones[0].id);
  const cycle = activeReviewCycle(it.workstreamId);
  const entry = cycle.changeLog[cycle.changeLog.length - 1];
  assertEqual(entry.change, 'Marked as Not Applicable');
  toggleMilestoneNotApplicable(it.id, it.milestones[0].id);
  const cycle2 = activeReviewCycle(it.workstreamId);
  assertEqual(cycle2.changeLog[cycle2.changeLog.length - 1].change, 'Marked as Applicable again');
});

test('saveItem carries notApplicable through from the editor, both true and false', function () {
  openItemModal(null);
  editingMilestones[0].notApplicable = true;
  fillItemForm({});
  saveItem();
  assertEqual(items[0].milestones[0].notApplicable, true);
  assertEqual(items[0].milestones[1].notApplicable, false);
});

test('renderMilestonesEditor freezes the status field to a plain "N/A" label and disables Due/Actual while notApplicable, and restores them when un-marked', function () {
  openItemModal(null);
  editingMilestones[0].notApplicable = true;
  renderMilestonesEditor();
  let html = document.getElementById('milestonesEditor').innerHTML;
  const firstIdx = html.indexOf('milestone-row');
  const secondIdx = html.indexOf('milestone-row', firstIdx + 1);
  const firstRow = html.slice(firstIdx, secondIdx === -1 ? undefined : secondIdx);
  assertIncludes(firstRow, '>N/A<');
  assertNotIncludes(firstRow, '<select', 'the real status <select> must not render for a notApplicable row');
  assertIncludes(firstRow, 'disabled', 'Due/Actual should be disabled while notApplicable');

  editingMilestones[0].notApplicable = false;
  renderMilestonesEditor();
  html = document.getElementById('milestonesEditor').innerHTML;
  assertIncludes(html, '<select', 'the real status <select> should be back once un-marked');
});

test('the item modal\'s Not Applicable toggle is wired to toggleEditingMilestoneNotApplicable and is blocked below Editor', function () {
  openItemModal(null);
  const html = document.getElementById('milestonesEditor').innerHTML;
  assertIncludes(html, 'toggleEditingMilestoneNotApplicable(0)');

  userRole = 'reviewer';
  openItemModal(null);
  toggleEditingMilestoneNotApplicable(0);
  assertEqual(editingMilestones[0].notApplicable, false, 'toggling must have been blocked below Editor');
});

test('toggleEditingMilestoneNotApplicable clears Due/Actual in the editor\'s working copy, and saveItem does not refill Due from the manual Due input', function () {
  openItemModal(null);
  editingMilestones[0].actualDate = '2026-06-01';
  toggleEditingMilestoneNotApplicable(0);
  assertEqual(editingMilestones[0].dueDate, null);
  assertEqual(editingMilestones[0].actualDate, null);

  fillItemForm({ due: '2026-09-09' }); // the manual Due input — must not leak into the notApplicable milestone
  saveItem();
  assertEqual(items[0].milestones[0].dueDate, null, 'a notApplicable milestone must not fall back to the manual due date the way an applicable one does');
});

test('normalizeData backfills a missing/malformed milestone.notApplicable to false', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  delete it.milestones[0].notApplicable;
  it.milestones[1].notApplicable = 'yes'; // malformed — not a real boolean
  normalizeData();
  assertEqual(it.milestones[0].notApplicable, false);
  assertEqual(it.milestones[1].notApplicable, false);
});

test('stampChangedMilestones treats a notApplicable-only edit as a real change, bumping updatedAt', function () {
  const prev = [{ id: 'm1', name: 'X', dueDate: '2026-01-01', status: 'not-started', actualDate: null, notApplicable: false, updatedAt: 100 }];
  const same = [{ id: 'm1', name: 'X', dueDate: '2026-01-01', status: 'not-started', actualDate: null, notApplicable: false }];
  const changed = [{ id: 'm1', name: 'X', dueDate: '2026-01-01', status: 'not-started', actualDate: null, notApplicable: true }];
  const stampedSame = stampChangedMilestones(same, prev);
  assertEqual(stampedSame[0].updatedAt, 100, 'no real change — updatedAt should be carried over from prev, not bumped');
  const stampedChanged = stampChangedMilestones(changed, prev);
  assertTrue(stampedChanged[0].updatedAt !== 100, 'a notApplicable-only change should still count as a real change');
});

// ---------- IT/Business/Budget tags ----------

test('a new item defaults its IT/Business/Budget tags to green', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  assertEqual(items[0].itStatus, 'green');
  assertEqual(items[0].businessStatus, 'green');
  assertEqual(items[0].budgetStatus, 'green');
});

test('cycleItemAttr advances a single tag field through green -> amber -> red -> green, leaving the others untouched', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  cycleItemAttr(it.id, 'itStatus');
  assertEqual(items[0].itStatus, 'amber');
  assertEqual(items[0].businessStatus, 'green', 'businessStatus should be untouched by cycling itStatus');
  cycleItemAttr(it.id, 'itStatus');
  assertEqual(items[0].itStatus, 'red');
  cycleItemAttr(it.id, 'itStatus');
  assertEqual(items[0].itStatus, 'green', 'cycling should wrap back around to green');
});

test('editing an existing item via the modal does not reset its IT/Business/Budget tags', function () {
  openItemModal(null);
  fillItemForm({});
  saveItem();
  const it = items[0];
  cycleItemAttr(it.id, 'budgetStatus');
  assertEqual(items[0].budgetStatus, 'amber');
  openItemModal(it.id);
  fillItemForm({ name: 'Renamed' });
  saveItem();
  assertEqual(items[0].budgetStatus, 'amber', 'saving the modal again should not clobber a tag it never edits');
});

// ---------- Scope item order: bottom-of-list creation + drag reordering ----------

test('a new item is added at the bottom of its workstream\'s list, regardless of due date', function () {
  openItemModal(null);
  fillItemForm({ name: 'First', due: '2026-12-31' });
  saveItem();
  openItemModal(null);
  fillItemForm({ name: 'Second', due: '2026-01-01' }); // due much earlier than "First"
  saveItem();
  assertEqual(items[0].order, 0);
  assertEqual(items[1].order, 1);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertTrue(html.indexOf('First') < html.indexOf('Second'), 'display order should follow creation order, not the earlier due date of "Second"');
});

test('renderReview shows scope items in the same order as Planning\'s status board, not its own date-based sort', function () {
  openItemModal(null); fillItemForm({ name: 'First', due: '2026-12-31' }); saveItem();
  openItemModal(null); fillItemForm({ name: 'Second', due: '2026-01-01' }); saveItem();
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  renderReview();
  const html = document.getElementById('main').innerHTML;
  assertTrue(html.indexOf('First') < html.indexOf('Second'), 'Review must reflect the same manual order as Planning, not re-sort by due date');
});

test('reorderItem moves an item to a new position and reassigns contiguous order values', function () {
  openItemModal(null); fillItemForm({ name: 'A' }); saveItem();
  openItemModal(null); fillItemForm({ name: 'B' }); saveItem();
  openItemModal(null); fillItemForm({ name: 'C' }); saveItem();
  const [a, b, c] = items;
  reorderItem(a.id, c.id); // move A to where C is
  const byOrder = items.slice().sort((x, y) => x.order - y.order).map(i => i.name);
  assertDeepEqual(byOrder, ['B', 'C', 'A'], 'A should now sit where C was, pushing B and C up');
});

test('reorderItem is a no-op across two different workstreams', function () {
  document.getElementById('wsNameInput').value = 'Second WS';
  wsColorChoice = 'teal';
  saveWorkstream();
  const secondWs = workstreams[1].id;
  openItemModal(null); fillItemForm({ name: 'A' }); saveItem();
  openItemModal(null); fillItemForm({ name: 'B', workstreamId: secondWs }); saveItem();
  const before = items.map(i => i.order);
  reorderItem(items[0].id, items[1].id);
  assertDeepEqual(items.map(i => i.order), before, 'nothing should change when dragging across workstreams');
});

test('dragStartItem/dropOnItem wires a row drag-and-drop to reorderItem', function () {
  openItemModal(null); fillItemForm({ name: 'A' }); saveItem();
  openItemModal(null); fillItemForm({ name: 'B' }); saveItem();
  const [a, b] = items;
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  dragStartItem(fakeEvent, b.id);
  dropOnItem(fakeEvent, a.id);
  assertEqual(items.find(i => i.id === b.id).order, 0, 'B should have moved to where A was');
  assertEqual(draggedItemId, null, 'the drag state should be cleared after a drop');
});

test('normalizeData backfills a missing order per workstream, preserving current array order', function () {
  const wsId = workstreams[0].id;
  items.push({ id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  items.push({ id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'Y', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].order, 0);
  assertEqual(items[1].order, 1);
});

test('the drag handle renders in Planning but not in Review mode', function () {
  const it = addItem({ name: 'Draggable' });
  renderMain();
  assertIncludes(document.getElementById('main').innerHTML, 'drag-handle');
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  startReviewCycle(workstreams[0].id);
  renderReview();
  assertNotIncludes(document.getElementById('main').innerHTML, 'drag-handle', 'restructuring order isn\'t a review action');
});
