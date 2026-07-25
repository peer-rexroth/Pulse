test('normalizeData backfills missing fields on a hand-built item', function () {
  const wsId = workstreams[0].id;
  items.push({ id: 'x1', workstreamId: wsId, type: 'scope' });
  normalizeData();
  const it = items[0];
  assertEqual(it.name, 'Untitled');
  assertEqual(it.owner, '');
  assertEqual(it.notes, '');
  assertEqual(it.status, 'not-started');
  assertTrue(!!it.startDate, 'scope item should get a startDate default');
  assertTrue(!!it.dueDate, 'scope item should get a dueDate default');
});

test('normalizeData reassigns an item whose workstream no longer exists', function () {
  items.push({ id: 'x2', workstreamId: 'does-not-exist', type: 'milestone', name: 'Orphan', dueDate: todayStr() });
  normalizeData();
  assertEqual(items[0].workstreamId, workstreams[0].id);
});

test('normalizeData rejects an unknown status value', function () {
  items.push({ id: 'x3', workstreamId: workstreams[0].id, type: 'scope', name: 'Bad status', status: 'purple-alert', dueDate: todayStr() });
  normalizeData();
  assertEqual(items[0].status, 'not-started');
});

test('normalizeData clears filterWorkstreamId if it points at a deleted workstream', function () {
  filterWorkstreamId = 'gone';
  normalizeData();
  assertEqual(filterWorkstreamId, null);
});

test('normalizeData assigns a fallback color to a workstream missing one', function () {
  workstreams.push({ id: 'w2', name: 'No color' });
  normalizeData();
  assertTrue(WS_COLORS.includes(workstreams[1].color));
});

test('normalizeData sorts workstreams by order', function () {
  workstreams[0].order = 5;
  workstreams.push({ id: 'w2', name: 'Should be first', color: 'red', order: 1 });
  normalizeData();
  assertEqual(workstreams[0].name, 'Should be first');
});
