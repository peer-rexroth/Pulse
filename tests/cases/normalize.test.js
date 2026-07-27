test('normalizeData backfills missing fields on a hand-built item', function () {
  const wsId = workstreams[0].id;
  items.push({ id: 'x1', workstreamId: wsId });
  normalizeData();
  const it = items[0];
  assertEqual(it.name, 'Untitled');
  assertEqual(it.owner, '');
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

test('normalizeData backfills a missing/malformed reviewCycle.minutes to null', function () {
  reviewCycles.push({ id: 'rc1', workstreamId: workstreams[0].id });
  reviewCycles.push({ id: 'rc2', workstreamId: workstreams[0].id, minutes: 'not an object' });
  normalizeData();
  assertEqual(reviewCycles[0].minutes, null);
  assertEqual(reviewCycles[1].minutes, null, 'a malformed minutes value should be reset, not kept as-is');
});

test('normalizeData backfills a missing reviewCycle.minutes.openPoints to an empty string', function () {
  reviewCycles.push({ id: 'rc3b', workstreamId: workstreams[0].id, minutes: { summary: 'S', actionItems: [], nextSteps: '', decisions: '', importedAt: 123 } });
  normalizeData();
  assertEqual(reviewCycles[0].minutes.openPoints, '');
});

test('normalizeData leaves a well-formed reviewCycle.minutes alone', function () {
  reviewCycles.push({ id: 'rc3', workstreamId: workstreams[0].id, minutes: { summary: 'S', actionItems: [{ id: 'a1', text: 'Do X', owner: 'Alice', dueDate: '2026-08-01' }], decisions: '', openPoints: 'Pending Legal', nextSteps: '', importedAt: 123 } });
  normalizeData();
  assertEqual(reviewCycles[0].minutes.summary, 'S');
  assertEqual(reviewCycles[0].minutes.openPoints, 'Pending Legal');
  assertEqual(reviewCycles[0].minutes.actionItems.length, 1);
  assertEqual(reviewCycles[0].minutes.actionItems[0].owner, 'Alice');
});

test('normalizeData migrates a legacy free-text actionItems string into a one-row table', function () {
  reviewCycles.push({ id: 'rc4', workstreamId: workstreams[0].id, minutes: { summary: '', actionItems: 'Alice to update the runbook.', nextSteps: '', decisions: '', importedAt: 123 } });
  normalizeData();
  assertEqual(reviewCycles[0].minutes.actionItems.length, 1);
  assertEqual(reviewCycles[0].minutes.actionItems[0].text, 'Alice to update the runbook.');
  assertEqual(reviewCycles[0].minutes.actionItems[0].owner, '');
});

test('normalizeData migrates a blank legacy actionItems string to an empty table, not a blank row', function () {
  reviewCycles.push({ id: 'rc5', workstreamId: workstreams[0].id, minutes: { summary: 'S', actionItems: '   ', nextSteps: '', decisions: '', importedAt: 123 } });
  normalizeData();
  assertEqual(reviewCycles[0].minutes.actionItems.length, 0);
});

test('normalizeData backfills id/text/owner/dueDate on a hand-built action item row', function () {
  reviewCycles.push({ id: 'rc6', workstreamId: workstreams[0].id, minutes: { summary: 'S', actionItems: [{}], nextSteps: '', decisions: '', importedAt: 123 } });
  normalizeData();
  const a = reviewCycles[0].minutes.actionItems[0];
  assertTrue(isSafeId(a.id));
  assertEqual(a.text, '');
  assertEqual(a.owner, '');
  assertEqual(a.dueDate, null);
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

test('normalizeData backfills a missing actualDate to null on both an item and its milestone', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X',
    dueDate: todayStr(), startDate: todayStr(),
    milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started' }]
  });
  normalizeData();
  assertEqual(items[0].actualDate, null);
  assertEqual(items[0].milestones[0].actualDate, null);
});

test('normalizeData leaves an existing actualDate string alone', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X',
    dueDate: todayStr(), startDate: todayStr(), actualDate: '2026-01-05',
    milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started', actualDate: '2026-01-03' }]
  });
  normalizeData();
  assertEqual(items[0].actualDate, '2026-01-05');
  assertEqual(items[0].milestones[0].actualDate, '2026-01-03');
});

test('normalizeData overrides a stale hand-set status on an item that has milestones', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X',
    dueDate: todayStr(), startDate: todayStr(), status: 'green', // manually set, but should be ignored
    milestones: [
      { id: genId(), name: 'A', dueDate: todayStr(), status: 'not-started' },
      { id: genId(), name: 'B', dueDate: todayStr(), status: 'red' }
    ]
  });
  normalizeData();
  assertEqual(items[0].status, 'red', 'red is the weakest milestone and should win regardless of the saved manual value');
});

test('normalizeData overrides a stale hand-set plan date range on an item that has milestones', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X',
    startDate: '2020-01-01', dueDate: '2020-01-01', // manually set/stale, should be ignored
    milestones: [
      { id: genId(), name: 'A', dueDate: '2026-02-01', status: 'not-started', actualDate: null },
      { id: genId(), name: 'B', dueDate: '2026-05-01', status: 'not-started', actualDate: '2026-06-01' }
    ]
  });
  normalizeData();
  assertEqual(items[0].startDate, '2026-02-01');
  assertEqual(items[0].dueDate, '2026-06-01', 'the later actualDate should win over the later dueDate');
});

test('normalizeData leaves the plan date range as manually set on an item with no milestones', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X',
    startDate: '2026-03-01', dueDate: '2026-03-15', milestones: []
  });
  normalizeData();
  assertEqual(items[0].startDate, '2026-03-01');
  assertEqual(items[0].dueDate, '2026-03-15');
});

test('normalizeData backfills missing IT/Business/Budget tags to green, and rejects an invalid value', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X',
    dueDate: todayStr(), startDate: todayStr(), milestones: [], itStatus: 'not-a-color'
  });
  normalizeData();
  assertEqual(items[0].itStatus, 'green');
  assertEqual(items[0].businessStatus, 'green');
  assertEqual(items[0].budgetStatus, 'green');
});

test('normalizeData leaves an existing valid IT/Business/Budget tag alone', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X',
    dueDate: todayStr(), startDate: todayStr(), milestones: [],
    itStatus: 'red', businessStatus: 'amber', budgetStatus: 'green'
  });
  normalizeData();
  assertEqual(items[0].itStatus, 'red');
  assertEqual(items[0].businessStatus, 'amber');
  assertEqual(items[0].budgetStatus, 'green');
});

test('normalizeData leaves a manual status alone on an item with no milestones', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X',
    dueDate: todayStr(), startDate: todayStr(), status: 'amber', milestones: []
  });
  normalizeData();
  assertEqual(items[0].status, 'amber');
});
