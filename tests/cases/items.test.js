function fillItemForm(overrides) {
  const f = Object.assign({
    name: 'Ship schema v1', owner: 'Jamie', start: '2026-08-01', due: '2026-08-15', actual: '',
    status: 'amber', notes: 'depends on review'
  }, overrides || {});
  document.getElementById('itemNameInput').value = f.name;
  document.getElementById('itemOwnerInput').value = f.owner;
  document.getElementById('itemStartInput').value = f.start;
  document.getElementById('itemDueInput').value = f.due;
  document.getElementById('itemActualInput').value = f.actual;
  document.getElementById('itemStatusSelect').value = f.status;
  document.getElementById('itemNotesInput').value = f.notes;
  document.getElementById('itemWorkstreamSelect').value = f.workstreamId || workstreams[0].id;
}

test('opening a new item modal seeds the standard set of milestones', function () {
  openItemModal(null);
  assertEqual(editingMilestones.length, DEFAULT_CATEGORY_MILESTONES.length);
  assertEqual(editingMilestones[0].name, 'Requirements defined');
  assertEqual(editingMilestones[5].name, 'Deployment completed');
  editingMilestones.forEach(m => assertEqual(m.status, 'not-started'));
});

test('standard milestones default their date to the due date shown when the modal opened', function () {
  openItemModal(null);
  const due = document.getElementById('itemDueInput').value;
  assertTrue(!!due, 'due date field should be pre-filled for a new item');
  editingMilestones.forEach(m => assertEqual(m.dueDate, due));
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
  assertEqual(it.milestones[0].name, 'Requirements defined');
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

test('removeMilestoneRow removes one row from the in-progress edit without touching saved data yet', function () {
  openItemModal(null);
  assertEqual(editingMilestones.length, 6);
  removeMilestoneRow(2);
  assertEqual(editingMilestones.length, 5);
  assertEqual(editingMilestones[2].name, 'Ready for SIT');
  assertEqual(items.length, 0, 'nothing should be saved until Save is clicked');
});

test('addMilestoneRow appends a custom milestone beyond the standard set', function () {
  openItemModal(null);
  addMilestoneRow();
  assertEqual(editingMilestones.length, DEFAULT_CATEGORY_MILESTONES.length + 1);
  assertEqual(editingMilestones[6].name, 'New milestone');
  fillItemForm({});
  saveItem();
  assertEqual(items[0].milestones.length, 7);
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
