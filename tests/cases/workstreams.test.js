test('seedDefaults creates one workstream with no items', function () {
  assertEqual(workstreams.length, 1);
  assertEqual(items.length, 0);
  assertEqual(workstreams[0].name, 'Workstream 1');
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
  items.push({ id: genId(), workstreamId: wsId, type: 'scope', name: 'A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr() });
  items.push({ id: genId(), workstreamId: wsId, type: 'milestone', name: 'B', owner: '', notes: '', status: 'green', dueDate: todayStr() });
  assertEqual(items.length, 2);
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 0);
});

test('deleting the currently-filtered workstream clears the filter', function () {
  const wsId = workstreams[0].id;
  filterWorkstreamId = wsId;
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  assertEqual(filterWorkstreamId, null);
});
