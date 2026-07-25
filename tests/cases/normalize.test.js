test('normalizeData backfills missing fields on a hand-built item', function () {
  const wsId = workstreams[0].id;
  items.push({ id: 'x1', workstreamId: wsId });
  normalizeData();
  const it = items[0];
  assertEqual(it.name, 'Untitled');
  assertEqual(it.owner, '');
  assertEqual(it.notes, '');
  assertEqual(it.status, 'not-started');
  assertTrue(!!it.startDate, 'item should get a startDate default');
  assertTrue(!!it.dueDate, 'item should get a dueDate default');
  assertDeepEqual(it.milestones, [], 'item with no milestones field should get an empty array');
});

test('normalizeData backfills missing fields on a hand-built milestone', function () {
  const wsId = workstreams[0].id;
  items.push({ id: 'x1', workstreamId: wsId, dueDate: '2026-08-01', milestones: [{ id: 'm1' }] });
  normalizeData();
  const m = items[0].milestones[0];
  assertEqual(m.name, 'Untitled milestone');
  assertEqual(m.status, 'not-started');
  assertEqual(m.dueDate, '2026-08-01', 'a milestone missing its own date should fall back to the parent item due date');
});

test('normalizeData reassigns an item whose workstream no longer exists', function () {
  items.push({ id: 'x2', workstreamId: 'does-not-exist', name: 'Orphan', dueDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].workstreamId, workstreams[0].id);
});

test('normalizeData rejects an unknown status value on an item and on a milestone', function () {
  items.push({
    id: 'x3', workstreamId: workstreams[0].id, name: 'Bad status', status: 'purple-alert', dueDate: todayStr(),
    milestones: [{ id: 'm1', name: 'M', dueDate: todayStr(), status: 'purple-alert' }]
  });
  normalizeData();
  assertEqual(items[0].status, 'not-started');
  assertEqual(items[0].milestones[0].status, 'not-started');
});

test('normalizeData migrates a legacy standalone milestone item into its own single-milestone scope item', function () {
  items.push({ id: 'legacy1', workstreamId: workstreams[0].id, type: 'milestone', name: 'Go-live', status: 'green', dueDate: '2026-10-01' });
  normalizeData();
  assertEqual(items.length, 1);
  const it = items[0];
  assertEqual(it.type, undefined);
  assertEqual(it.name, 'Go-live');
  assertEqual(it.dueDate, '2026-10-01');
  assertEqual(it.startDate, '2026-10-01');
  assertEqual(it.milestones.length, 1);
  assertEqual(it.milestones[0].name, 'Go-live');
  assertEqual(it.milestones[0].status, 'green');
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
