// ---------- tombstone / untombstone ----------

test('tombstone adds a new entry, and updates deletedAt if the id is already tombstoned', function () {
  const list = [];
  tombstone(list, 'a');
  assertEqual(list.length, 1);
  assertEqual(list[0].id, 'a');
  const firstStamp = list[0].deletedAt;
  tombstone(list, 'a');
  assertEqual(list.length, 1, 'tombstoning the same id twice should not duplicate the entry');
  assertTrue(list[0].deletedAt >= firstStamp);
});

test('untombstone removes the matching entry only', function () {
  const list = [{ id: 'a', deletedAt: 1 }, { id: 'b', deletedAt: 2 }];
  untombstone(list, 'a');
  assertEqual(list.length, 1);
  assertEqual(list[0].id, 'b');
});

// ---------- isSafeId regeneration ----------

test('normalizeData regenerates a workstream id that could break out of an HTML attribute', function () {
  workstreams.push({ id: `bad"onclick="alert(1)`, name: 'Malicious', color: 'red', order: 5 });
  normalizeData();
  workstreams.forEach(w => assertTrue(isSafeId(w.id), `workstream id ${w.id} should be safe`));
});

test('normalizeData regenerates an item id and a milestone id that look unsafe', function () {
  items.push({
    id: `evil');alert(1);('`, workstreamId: workstreams[0].id, name: 'X', dueDate: todayStr(), startDate: todayStr(),
    milestones: [{ id: `m"><script>`, name: 'M', dueDate: todayStr(), status: 'not-started' }]
  });
  normalizeData();
  assertTrue(isSafeId(items[0].id));
  assertTrue(isSafeId(items[0].milestones[0].id));
});

// ---------- undo-delete ----------

test('deleteItem tombstones the item and shows an undo toast that restores it', function () {
  const it = { id: genId(), workstreamId: workstreams[0].id, name: 'To delete', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);
  deleteItem(it.id);
  confirmModalAction(); // simulate clicking "Delete" in the confirm modal
  assertEqual(items.length, 0);
  assertTrue(deletedItemIds.some(x => x.id === it.id), 'deleted item should be tombstoned');
  assertTrue(!!toastUndoAction, 'an undo action should be armed after deleting');
  triggerToastUndo();
  assertEqual(items.length, 1);
  assertEqual(items[0].id, it.id);
  assertFalse(deletedItemIds.some(x => x.id === it.id), 'undoing should clear the tombstone');
});

test('deleteWorkstreamFromModal cascades tombstones to its items, and undo restores both', function () {
  const wsId = workstreams[0].id;
  items.push({ id: genId(), workstreamId: wsId, name: 'A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() });
  items.push({ id: genId(), workstreamId: wsId, name: 'B', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() });
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction();
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 0);
  assertTrue(deletedWorkstreamIds.some(x => x.id === wsId));
  assertEqual(deletedItemIds.length, 2);
  triggerToastUndo();
  assertEqual(workstreams.length, 1);
  assertEqual(items.length, 2);
  assertEqual(deletedWorkstreamIds.length, 0);
  assertEqual(deletedItemIds.length, 0);
});

// ---------- mergeData ----------

test('mergeData adds a workstream not present locally, deduping by id or name', function () {
  const added = mergeData({ workstreams: [{ id: 'w-remote', name: 'Remote Stream', color: 'teal', order: 9 }], items: [] });
  assertEqual(workstreams.length, 2);
  assertTrue(workstreams.some(w => w.id === 'w-remote'));
});

test('mergeData skips a workstream whose name already exists locally', function () {
  mergeData({ workstreams: [{ id: 'w-dup', name: workstreams[0].name.toUpperCase(), color: 'teal', order: 9 }], items: [] });
  assertEqual(workstreams.length, 1);
});

test('mergeData adds a new item and reports it in the added count', function () {
  const remoteItem = { id: 'item-remote', workstreamId: workstreams[0].id, name: 'Remote item', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  const { added, updated } = mergeData({ workstreams: [], items: [remoteItem] });
  assertEqual(added, 1);
  assertEqual(updated, 0);
  assertEqual(items.length, 1);
});

test('mergeData updates an existing item only when the incoming copy is newer', function () {
  const local = { id: 'item-1', workstreamId: workstreams[0].id, name: 'Local name', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 1000 };
  items.push(local);
  let result = mergeData({ workstreams: [], items: [{ ...local, name: 'Stale incoming', updatedAt: 500 }] });
  assertEqual(result.updated, 0);
  assertEqual(items[0].name, 'Local name', 'an older incoming copy should not overwrite the newer local one');
  result = mergeData({ workstreams: [], items: [{ ...local, name: 'Fresh incoming', updatedAt: 2000 }] });
  assertEqual(result.updated, 1);
  assertEqual(items[0].name, 'Fresh incoming');
});

test('mergeData keeps a tombstoned item deleted when the incoming copy is stale', function () {
  tombstone(deletedItemIds, 'gone-1');
  const staleIncoming = { id: 'gone-1', workstreamId: workstreams[0].id, name: 'Should stay deleted', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: deletedItemIds[0].deletedAt - 1000 };
  const { added } = mergeData({ workstreams: [], items: [staleIncoming] });
  assertEqual(added, 0);
  assertEqual(items.length, 0);
});

test('mergeData lets a tombstoned item back in when the incoming edit is newer than the deletion', function () {
  tombstone(deletedItemIds, 'gone-2');
  const deletedAt = deletedItemIds[0].deletedAt;
  const freshIncoming = { id: 'gone-2', workstreamId: workstreams[0].id, name: 'Edited after delete', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: deletedAt + 1000 };
  const { added } = mergeData({ workstreams: [], items: [freshIncoming] });
  assertEqual(added, 1);
  assertEqual(items.length, 1);
  assertFalse(deletedItemIds.some(x => x.id === 'gone-2'), 'the stale tombstone should be cleared');
});

test('mergeData with respectTombstones:false lets a tombstoned item back in regardless of dates', function () {
  tombstone(deletedItemIds, 'gone-3');
  const staleIncoming = { id: 'gone-3', workstreamId: workstreams[0].id, name: 'Manually reimported', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 1 };
  const { added } = mergeData({ workstreams: [], items: [staleIncoming] }, { respectTombstones: false });
  assertEqual(added, 1);
  assertEqual(items.length, 1);
});

// ---------- Export / Import ----------

test('exportProgramme downloads a JSON blob containing the current workstreams and items', function () {
  exportProgramme();
  assertTrue(!!globalThis.__lastBlob, 'a Blob should have been created');
  const payload = JSON.parse(globalThis.__lastBlob.parts[0]);
  assertEqual(payload.workstreams.length, workstreams.length);
  assertDeepEqual(payload.programme, programme);
});

test('applyImport merge mode adds new data and ignores tombstones (manual import intent)', function () {
  tombstone(deletedItemIds, 'import-1');
  pendingImportData = {
    workstreams: [], deletedWorkstreamIds: [], deletedItemIds: [],
    items: [{ id: 'import-1', workstreamId: workstreams[0].id, name: 'From file', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 1 }]
  };
  applyImport('merge');
  assertEqual(items.length, 1);
  assertEqual(items[0].name, 'From file');
});

test('applyImport replace mode backs up current data first, then overwrites everything', function () {
  const originalWsName = workstreams[0].name;
  pendingImportData = {
    programme: { name: 'Imported Programme' },
    workstreams: [{ id: 'w-new', name: 'Only Stream', color: 'blue', order: 0 }],
    items: []
  };
  applyImport('replace');
  assertTrue(!!globalThis.__lastBlob, 'replace should download a safety backup first');
  assertEqual(programme.name, 'Imported Programme');
  assertEqual(workstreams.length, 1);
  assertEqual(workstreams[0].name, 'Only Stream');
  assertFalse(workstreams.some(w => w.name === originalWsName));
});

// ---------- isFreshLocalState / replaceFromFileData ----------
// linkFile()/reconnectFile()/initFileSync() all gate on window.showOpenFilePicker,
// which the test harness's fake window doesn't have (see "Testing caveat" in
// CLAUDE.md), so those three functions themselves can't be exercised here.
// isFreshLocalState()/replaceFromFileData() are pure logic against the
// global state, though, so they're testable directly.

test('isFreshLocalState is true right after seedDefaults, and false once there\'s any real customization', function () {
  assertTrue(isFreshLocalState(), 'a freshly-seeded programme has nothing to lose');
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X', owner: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [] });
  assertFalse(isFreshLocalState(), 'a single real item means there is something to lose');
});

test('isFreshLocalState is false once the programme has been renamed, even with no items yet', function () {
  programme.name = 'Core Banking Modernization';
  assertFalse(isFreshLocalState());
});

test('isFreshLocalState is false once a second workstream or category exists, even with no items yet', function () {
  workstreams.push({ id: genId(), name: 'Second', color: 'teal', order: 1 });
  assertFalse(isFreshLocalState(), 'a second workstream is a sign of real setup work worth preserving');
});

test('replaceFromFileData wholesale-replaces programme/workstreams/items/categories/reviewCycles from the given data', function () {
  const data = {
    programme: { name: 'Restored Programme' },
    workstreams: [{ id: 'w-restored', name: 'Restored WS', color: 'blue', order: 0 }],
    items: [{ id: 'i-restored', workstreamId: 'w-restored', name: 'Restored Item', owner: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [] }],
    categories: [{ id: 'c-restored', name: 'Restored Category', milestones: ['Step 1'], order: 0 }],
    reviewCycles: []
  };
  replaceFromFileData(data);
  assertEqual(programme.name, 'Restored Programme');
  assertEqual(workstreams.length, 1);
  assertEqual(workstreams[0].name, 'Restored WS');
  assertEqual(items.length, 1);
  assertEqual(items[0].name, 'Restored Item');
  assertEqual(categories[0].name, 'Restored Category');
});

// ---------- Local backups ----------

test('maybeSnapshotBackup takes at most one backup per day', function () {
  maybeSnapshotBackup();
  const first = getBackups().length;
  maybeSnapshotBackup();
  assertEqual(getBackups().length, first, 'a second save the same day should not add another backup');
});

test('maybeSnapshotBackup keeps only the last MAX_BACKUPS entries', function () {
  const backups = [];
  for (let i = 0; i < MAX_BACKUPS + 3; i++) {
    backups.push({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, savedAt: i, programme, workstreams, items });
  }
  localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
  maybeSnapshotBackup();
  assertTrue(getBackups().length <= MAX_BACKUPS);
});

test('restoreBackup replaces current data with the snapshot after confirmation', function () {
  localStorage.setItem(BACKUPS_KEY, JSON.stringify([
    { date: '2026-01-01', savedAt: 1, programme: { name: 'Old Programme' }, workstreams: [{ id: 'w-old', name: 'Old Stream', color: 'grey', order: 0 }], items: [] }
  ]));
  restoreBackup('2026-01-01');
  assertEqual(document.getElementById('confirmModalActionBtn').textContent, 'Restore');
  confirmModalAction();
  assertEqual(programme.name, 'Old Programme');
  assertEqual(workstreams.length, 1);
  assertEqual(workstreams[0].name, 'Old Stream');
});
