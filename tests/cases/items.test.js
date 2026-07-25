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

test('saveItem creates a scope item with start and due dates', function () {
  setItemType('scope');
  fillItemForm({});
  saveItem();
  assertEqual(items.length, 1);
  const it = items[0];
  assertEqual(it.type, 'scope');
  assertEqual(it.name, 'Ship schema v1');
  assertEqual(it.owner, 'Jamie');
  assertEqual(it.startDate, '2026-08-01');
  assertEqual(it.dueDate, '2026-08-15');
  assertEqual(it.status, 'amber');
  assertEqual(it.workstreamId, workstreams[0].id);
});

test('saveItem creates a milestone without a start date', function () {
  setItemType('milestone');
  fillItemForm({ name: 'Go-live decision', due: '2026-09-01' });
  saveItem();
  assertEqual(items.length, 1);
  assertEqual(items[0].type, 'milestone');
  assertFalse(items[0].startDate, 'milestone should have no startDate');
});

test('saveItem rejects an empty name', function () {
  setItemType('scope');
  fillItemForm({ name: '   ' });
  saveItem();
  assertEqual(items.length, 0);
});

test('editing an item updates it in place, not a new entry', function () {
  setItemType('scope');
  fillItemForm({});
  saveItem();
  const id = items[0].id;
  openItemModal(id);
  document.getElementById('itemNameInput').value = 'Renamed item';
  document.getElementById('itemStatusSelect').value = 'green';
  saveItem();
  assertEqual(items.length, 1);
  assertEqual(items[0].id, id);
  assertEqual(items[0].name, 'Renamed item');
  assertEqual(items[0].status, 'green');
});

test('deleteItemFromModal removes the item being edited', function () {
  setItemType('scope');
  fillItemForm({});
  saveItem();
  editingItemId = items[0].id;
  deleteItemFromModal();
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
