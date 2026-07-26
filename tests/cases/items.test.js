function fillItemForm(overrides) {
  const f = Object.assign({
    name: 'Ship schema v1', owner: 'Jamie', start: '2026-08-01', due: '2026-08-15',
    status: 'amber', notes: 'depends on review'
  }, overrides || {});
  document.getElementById('itemNameInput').value = f.name;
  document.getElementById('itemOwnerInput').value = f.owner;
  document.getElementById('itemStartInput').value = f.start;
  document.getElementById('itemDueInput').value = f.due;
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
  assertEqual(it.startDate, '2026-08-01');
  assertEqual(it.dueDate, '2026-08-15');
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
