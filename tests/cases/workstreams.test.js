test('seedDefaults starts with zero workstreams — a fresh programme has none until the user adds their own', function () {
  // resetState() (the test harness's own glue, not seedDefaults() itself)
  // pushes a "Workstream 1" back in purely for every other test's baseline
  // convenience — calling seedDefaults() directly here checks the real
  // product behavior underneath that shim.
  seedDefaults();
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 0);
  assertEqual(categories.length, 1);
  assertEqual(categories[0].name, 'Development');
});

test('saveWorkstream adds a new workstream with chosen name and color', function () {
  document.getElementById('wsNameInput').value = 'Data Migration';
  wsColorChoice = 'teal';
  saveWorkstream();
  assertEqual(workstreams.length, 2);
  const w = workstreams[1];
  assertEqual(w.name, 'Data Migration');
  assertEqual(w.color, 'teal');
});

test('saveWorkstream rejects an empty name', function () {
  const before = workstreams.length;
  document.getElementById('wsNameInput').value = '   ';
  saveWorkstream();
  assertEqual(workstreams.length, before);
});

test('editing an existing workstream updates it in place, not a new entry', function () {
  const id = workstreams[0].id;
  openWorkstreamModal(id);
  document.getElementById('wsNameInput').value = 'Renamed';
  wsColorChoice = 'purple';
  saveWorkstream();
  assertEqual(workstreams.length, 1);
  assertEqual(workstreams[0].id, id);
  assertEqual(workstreams[0].name, 'Renamed');
  assertEqual(workstreams[0].color, 'purple');
});

test('deleting a workstream also removes its items (cascade)', function () {
  const wsId = workstreams[0].id;
  items.push({ id: genId(), workstreamId: wsId, name: 'A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [] });
  items.push({ id: genId(), workstreamId: wsId, name: 'B', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [] });
  assertEqual(items.length, 2);
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction(); // simulate clicking "Delete" in the confirm modal
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 0);
});

test('deleting the currently-filtered workstream clears the filter', function () {
  const wsId = workstreams[0].id;
  filterWorkstreamId = wsId;
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction();
  assertEqual(filterWorkstreamId, null);
});
