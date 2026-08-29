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

// deleteWorkstreamFromModal() no longer cascades to its items at all (see
// workstreams.test.js for the full "moved to Unassigned, not deleted"
// coverage) — this only tombstones the workstream id itself, and only that
// tombstone needs undoing.
test('deleteWorkstreamFromModal tombstones only the workstream itself (its items are moved, never tombstoned), and undo restores it', function () {
  const wsId = workstreams[0].id;
  items.push({ id: genId(), workstreamId: wsId, categoryId: categories[0].id, name: 'A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() });
  editingWsId = wsId;
  deleteWorkstreamFromModal();
  confirmModalAction();
  assertEqual(workstreams.length, 0);
  assertEqual(items.length, 1, 'the item itself must survive');
  assertEqual(items[0].workstreamId, null);
  assertTrue(deletedWorkstreamIds.some(x => x.id === wsId));
  assertEqual(deletedItemIds.length, 0, 'items are never tombstoned by this action any more');
  triggerToastUndo();
  assertEqual(workstreams.length, 1);
  assertEqual(items[0].workstreamId, wsId);
  assertEqual(deletedWorkstreamIds.length, 0);
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

// ---------- Scope items now get the same proactive sweep action items
// got — a user-reported parallel to the same bug. Every test above this
// point only ever covered the "incoming copy resurrects a deletion"
// direction; none of them cover a device that already had its own local
// copy of an item *before* the deletion ever reached it — that copy was
// never dropped, since the merge loop only ever acted on what was
// actually incoming.

test('mergeData proactively sweeps a locally-existing item once its tombstone merges in, even though data.items simply omits it', function () {
  const local = { id: 'stale-item', workstreamId: workstreams[0].id, name: 'Deleted elsewhere', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 1000 };
  items.push(local);
  const { changed } = mergeData({ workstreams: [], items: [], deletedItemIds: [{ id: 'stale-item', deletedAt: 2000 }] });
  assertTrue(changed);
  assertEqual(items.length, 0, 'a locally-existing item whose tombstone just merged in must be swept, not just protected against being re-added');
});

test('mergeData does not sweep a locally-existing item whose own edit is newer than the incoming tombstone', function () {
  const local = { id: 'edited-after-item', workstreamId: workstreams[0].id, name: 'Edited after the delete', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 3000 };
  items.push(local);
  mergeData({ workstreams: [], items: [], deletedItemIds: [{ id: 'edited-after-item', deletedAt: 2000 }] });
  assertEqual(items.length, 1, 'a locally-newer edit must survive an older/stale tombstone');
});

test('mergeData with respectTombstones:false never sweeps a locally-existing item', function () {
  const local = { id: 'kept-item', workstreamId: workstreams[0].id, name: 'Kept regardless', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 1000 };
  items.push(local);
  mergeData({ workstreams: [], items: [], deletedItemIds: [{ id: 'kept-item', deletedAt: 9999999999999 }] }, { respectTombstones: false });
  assertEqual(items.length, 1);
});

test('mergeData sweeps a locally-existing Unassigned item (workstreamId:null) the exact same way as a workstream-scoped one — no special-casing needed', function () {
  const unassigned = { id: 'stale-unassigned', workstreamId: null, categoryId: null, itemType: 'scope', name: 'Deleted elsewhere', owner: '', status: 'not-started', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 1000 };
  items.push(unassigned);
  mergeData({ workstreams: [], items: [], deletedItemIds: [{ id: 'stale-unassigned', deletedAt: 2000 }] });
  assertEqual(items.length, 0, 'the sweep works on all of `items` regardless of workstreamId and never needs to know or care about it');
});

test('the actual fix for the reported bug: a device that already had its own local copy of a scope item drops it once the deleting device\'s tombstone merges in', function () {
  const local = { id: 'race-item', workstreamId: workstreams[0].id, name: 'Already deleted on device A', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: 1000 };
  items.push(local);
  // Device A's own recombined data (index + its own workstream file) simply
  // no longer lists the item at all — its own tombstone, now merged in
  // here, is what actually drives the removal.
  mergeData({
    workstreams: [{ id: workstreams[0].id, name: workstreams[0].name, color: workstreams[0].color, order: 0, updatedAt: 0, actionLog: [], decisionLog: [] }],
    items: [],
    deletedItemIds: [{ id: 'race-item', deletedAt: 2000 }]
  });
  assertFalse(items.some(it => it.id === 'race-item'), 'this device\'s own copy must be dropped, so its own next write can no longer resurrect it');
});

// ---------- Per-milestone merge ----------
// A milestone-bearing item's milestones merge by id independently of the
// item's own scalar fields (name/owner/status/dates) — see mergeData()'s and
// mergeMilestonesArray()'s own comments for why: two people editing
// *different* parts of the same item should both keep their edit, not have
// one whole item snapshot silently replace the other.

function addMergeTestItem(overrides) {
  const it = Object.assign({
    id: 'merge-item-1', workstreamId: workstreams[0].id, categoryId: categories[0].id,
    name: 'Shared item', owner: '', status: 'green', startDate: todayStr(), dueDate: todayStr(),
    updatedAt: 1000,
    milestones: [
      { id: 'ms-a', name: 'Milestone A', dueDate: todayStr(), status: 'not-started', actualDate: null, updatedAt: 1000 },
      { id: 'ms-b', name: 'Milestone B', dueDate: todayStr(), status: 'not-started', actualDate: null, updatedAt: 1000 }
    ]
  }, overrides || {});
  items.push(it);
  return it;
}

test('mergeData merges two different milestones on the same item independently — both edits survive', function () {
  const local = addMergeTestItem();
  // Local edited milestone A only; milestone B is untouched in both copies.
  local.milestones[0] = { ...local.milestones[0], status: 'complete', updatedAt: 2000 };
  // Incoming (the file/other device) edited milestone B only; its copy of
  // milestone A is still the original, unedited version.
  const incoming = {
    ...local,
    updatedAt: 1000, // the item's own scalar fields did not change on the incoming side
    milestones: [
      { id: 'ms-a', name: 'Milestone A', dueDate: todayStr(), status: 'not-started', actualDate: null, updatedAt: 1000 },
      { ...local.milestones[1], status: 'complete', updatedAt: 2500 }
    ]
  };
  const { updated } = mergeData({ workstreams: [], items: [incoming] });
  assertEqual(updated, 1);
  assertEqual(items[0].milestones.find(m => m.id === 'ms-a').status, 'complete', 'the local edit to milestone A should survive');
  assertEqual(items[0].milestones.find(m => m.id === 'ms-b').status, 'complete', 'the incoming edit to milestone B should also be adopted');
});

test('mergeData keeps a tombstoned milestone deleted when the incoming copy is stale, and lets it back in when newer', function () {
  const local = addMergeTestItem();
  local.milestones = local.milestones.filter(m => m.id !== 'ms-b');
  tombstone(deletedMilestoneIds, 'ms-b');
  const deletedAt = deletedMilestoneIds[0].deletedAt;
  let incoming = { ...local, milestones: [local.milestones[0], { id: 'ms-b', name: 'Milestone B', dueDate: todayStr(), status: 'not-started', actualDate: null, updatedAt: deletedAt - 1000 }] };
  mergeData({ workstreams: [], items: [incoming] });
  assertFalse(items[0].milestones.some(m => m.id === 'ms-b'), 'a stale incoming copy should not resurrect a tombstoned milestone');

  incoming = { ...local, milestones: [local.milestones[0], { id: 'ms-b', name: 'Milestone B', dueDate: todayStr(), status: 'not-started', actualDate: null, updatedAt: deletedAt + 1000 }] };
  mergeData({ workstreams: [], items: [incoming] });
  assertTrue(items[0].milestones.some(m => m.id === 'ms-b'), 'an incoming edit newer than the deletion should let the milestone back in');
  assertFalse(deletedMilestoneIds.some(x => x.id === 'ms-b'), 'the stale tombstone should be cleared');
});

// The test above starts from a local copy that already lacks ms-b *before*
// it's ever tombstoned — it only ever exercises "does a stale/fresh
// incoming copy get let back in", the pre-existing protection. These cover
// the other direction: this device's own local item still genuinely has
// the milestone, and only learns it was deleted elsewhere via the
// tombstone merging in — the incoming item's own milestones list simply
// never mentions it at all, the ordinary shape of "the other side already
// deleted it."

test('mergeData proactively sweeps a locally-existing milestone once its tombstone merges in, even though the incoming item\'s own milestones list simply omits it', function () {
  const local = addMergeTestItem(); // still has both ms-a and ms-b locally
  const incoming = { ...local, updatedAt: 1000, milestones: [{ ...local.milestones[0] }] }; // no ms-b at all
  const { updated } = mergeData({ workstreams: [], items: [incoming], deletedMilestoneIds: [{ id: 'ms-b', deletedAt: 2000 }] });
  assertTrue(updated >= 1);
  assertFalse(items[0].milestones.some(m => m.id === 'ms-b'), 'a locally-existing milestone whose tombstone just merged in must be swept, not just protected against being re-added');
  assertEqual(items[0].milestones.length, 1);
});

test('mergeData does not sweep a locally-existing milestone whose own edit is newer than the incoming tombstone', function () {
  const local = addMergeTestItem();
  local.milestones[1].updatedAt = Date.now() + 100000; // ms-b edited locally after the tombstone below
  const incoming = { ...local, updatedAt: 1000, milestones: [{ ...local.milestones[0] }] };
  mergeData({ workstreams: [], items: [incoming], deletedMilestoneIds: [{ id: 'ms-b', deletedAt: Date.now() }] });
  assertTrue(items[0].milestones.some(m => m.id === 'ms-b'), 'a locally-newer edit must survive an older/stale tombstone');
});

test('mergeData with respectTombstones:false never sweeps a locally-existing milestone', function () {
  const local = addMergeTestItem();
  const incoming = { ...local, updatedAt: 1000, milestones: [{ ...local.milestones[0] }] };
  mergeData({ workstreams: [], items: [incoming], deletedMilestoneIds: [{ id: 'ms-b', deletedAt: 9999999999999 }] }, { respectTombstones: false });
  assertTrue(items[0].milestones.some(m => m.id === 'ms-b'));
});

test('mergeData reports a conflict when the same milestone was edited on both sides since the last sync', function () {
  const local = addMergeTestItem();
  lastSyncedAt = 5000; // pretend this browser and the file last agreed at t=5000
  local.milestones[0] = { ...local.milestones[0], status: 'amber', updatedAt: 6000 }; // edited locally after that
  const incoming = { ...local, milestones: [{ ...local.milestones[0], status: 'complete', updatedAt: 7000 }, local.milestones[1]] };
  const { conflicts } = mergeData({ workstreams: [], items: [incoming] });
  assertEqual(conflicts.length, 1);
  assertTrue(conflicts[0].note.includes('Milestone A'));
  assertEqual(items[0].milestones.find(m => m.id === 'ms-a').status, 'complete', 'the newer (incoming) edit should still win despite the conflict');
});

test('mergeData does not report a conflict when two *different* milestones changed on each side', function () {
  const local = addMergeTestItem();
  lastSyncedAt = 5000;
  local.milestones[0] = { ...local.milestones[0], status: 'amber', updatedAt: 6000 }; // local touched A only
  // incoming's own copy of milestone A is still the original, untouched version.
  const incoming = {
    ...local,
    milestones: [
      { id: 'ms-a', name: 'Milestone A', dueDate: todayStr(), status: 'not-started', actualDate: null, updatedAt: 1000 },
      { ...local.milestones[1], status: 'complete', updatedAt: 6500 } // incoming touched B only
    ]
  };
  const { conflicts } = mergeData({ workstreams: [], items: [incoming] });
  assertEqual(conflicts.length, 0, 'two independently-edited milestones merging cleanly is not a conflict');
});

test('mergeData does not report a conflict on the very first merge (lastSyncedAt still 0)', function () {
  const local = addMergeTestItem();
  assertEqual(lastSyncedAt, 0, 'a fresh session with no prior sync');
  local.milestones[0] = { ...local.milestones[0], status: 'amber', updatedAt: 6000 };
  const incoming = { ...local, milestones: [{ ...local.milestones[0], status: 'complete', updatedAt: 7000 }, local.milestones[1]] };
  const { conflicts } = mergeData({ workstreams: [], items: [incoming] });
  assertEqual(conflicts.length, 0, 'nothing has "since the last sync" meaning yet on a first-ever merge');
});

test('mergeData reports a conflict when an item\'s own scalar fields were edited on both sides since the last sync', function () {
  const local = addMergeTestItem({ milestones: [] });
  lastSyncedAt = 5000;
  local.name = 'Local Name'; local.updatedAt = 6000;
  const incoming = { ...local, name: 'Incoming Name', updatedAt: 7000, milestones: [] };
  const { conflicts } = mergeData({ workstreams: [], items: [incoming] });
  assertEqual(conflicts.length, 1);
  assertEqual(items[0].name, 'Incoming Name', 'the newer edit should still win');
});

test('showToast defaults its action button label to "Undo" when no custom label is given', function () {
  showToast('Something happened', false, () => {});
  assertEqual(document.getElementById('toastUndoBtn').textContent, 'Undo');
});

test('reportSyncConflicts appends to syncConflictLog and shows a "Review" toast action', function () {
  syncConflictLog = [];
  reportSyncConflicts([{ itemName: 'X', milestoneName: null, note: 'Test conflict' }]);
  assertEqual(syncConflictLog.length, 1);
  assertEqual(document.getElementById('toastUndoBtn').textContent, 'Review');
  assertTrue(!!toastUndoAction, 'the Review button should be wired up to open the conflicts modal');
});

test('reportSyncConflicts is a no-op when there are no conflicts', function () {
  syncConflictLog = [];
  reportSyncConflicts([]);
  assertEqual(syncConflictLog.length, 0);
});

test('clearSyncConflictLog empties the log', function () {
  syncConflictLog = [{ itemName: 'X', milestoneName: null, note: 'Test', at: Date.now() }];
  clearSyncConflictLog();
  assertEqual(syncConflictLog.length, 0);
});

// Sync conflict info (badge/toast/modal) is Editor+ only — an explicit
// user request. syncConflictLog itself still accumulates regardless of
// role (a conflict can happen while a lower role is looking, and
// shouldn't be silently lost), only the *display* is gated.

test('reportSyncConflicts still logs the conflict below Editor, but shows no toast', function () {
  syncConflictLog = [];
  userRole = 'reviewer';
  document.getElementById('toastUndoBtn').textContent = '';
  toastUndoAction = null;
  reportSyncConflicts([{ itemName: 'X', milestoneName: null, note: 'Test conflict' }]);
  assertEqual(syncConflictLog.length, 1, 'the conflict must still be recorded regardless of role');
  assertEqual(document.getElementById('toastUndoBtn').textContent, '', 'no "Review" toast should show below Editor');
});

test('updateSyncConflictsUI hides the badge below Editor even with unreviewed conflicts, and shows it at Editor+', function () {
  syncConflictLog = [{ itemName: 'X', milestoneName: null, note: 'Test', at: Date.now() }];
  userRole = 'reviewer';
  updateSyncConflictsUI();
  assertEqual(document.getElementById('syncConflictIndicator').innerHTML, '', 'badge must be hidden below Editor');
  userRole = 'editor';
  updateSyncConflictsUI();
  assertTrue(document.getElementById('syncConflictIndicator').innerHTML.indexOf('1 conflict') !== -1, 'badge must show at Editor+');
});

test('openSyncConflictsModal is blocked below Editor', function () {
  userRole = 'reviewer';
  openSyncConflictsModal();
  assertFalse(document.getElementById('syncConflictsModalBg').classList.contains('open'));
  userRole = 'editor';
  openSyncConflictsModal();
  assertTrue(document.getElementById('syncConflictsModalBg').classList.contains('open'));
});

test('render() refreshes the sync-conflict badge immediately on a role switch, not just on the next conflict/clear', function () {
  syncConflictLog = [{ itemName: 'X', milestoneName: null, note: 'Test', at: Date.now() }];
  userRole = 'editor';
  render();
  assertTrue(document.getElementById('syncConflictIndicator').innerHTML.indexOf('1 conflict') !== -1);
  userRole = 'reviewer';
  render();
  assertEqual(document.getElementById('syncConflictIndicator').innerHTML, '', 'switching to a role below Editor must hide the badge right away');
});

test('normalizeData backfills a missing milestone.updatedAt from the parent item\'s own updatedAt', function () {
  items.push({
    id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X', owner: '',
    status: 'green', startDate: todayStr(), dueDate: todayStr(), updatedAt: 12345,
    milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started', actualDate: null }]
  });
  normalizeData();
  assertEqual(items[0].milestones[0].updatedAt, 12345);
});

// ---------- Export / Import ----------

test('exportProgramme downloads a JSON blob containing the current workstreams and items', function () {
  exportProgramme();
  assertTrue(!!globalThis.__lastBlob, 'a Blob should have been created');
  const payload = JSON.parse(globalThis.__lastBlob.parts[0]);
  assertEqual(payload.workstreams.length, workstreams.length);
  assertDeepEqual(payload.programme, programme);
});

// exportToExcelReport()'s actual sheet-building only ever runs against a
// real ExcelJS.Workbook (loaded from a CDN <script>, not part of this
// zero-dependency JXA harness) — this only exercises the guard that keeps a
// missing/blocked library a clear, visible toast rather than a crash.
test('exportToExcelReport shows a clear toast instead of throwing when ExcelJS hasn\'t loaded', async function () {
  assertEqual(typeof globalThis.ExcelJS, 'undefined', 'this harness never loads the real library');
  await exportToExcelReport();
  assertIncludes(document.getElementById('toastMsg').textContent, 'Excel export needs an internet connection');
});

// milestoneExcelSummaryLine() — a later, explicit user request ("move the
// milestones of a scope item into column so that every scope item has only
// one line") collapsed the Scope Items sheet's old one-row-per-milestone
// shape into a single "Milestones" cell, one line per milestone, built by
// this function. Unlike buildScopeItemsSheet() itself, this is plain string
// logic with no ExcelJS dependency, so it's directly testable.

test('milestoneExcelSummaryLine prefers the milestone\'s own actual date over its due date', function () {
  const m = { name: 'Design Defined', dueDate: '2026-05-12', actualDate: '2026-05-10', status: 'complete', notApplicable: false };
  assertEqual(milestoneExcelSummaryLine(m), `Design Defined: ${fmtDateY('2026-05-10')} (Completed)`);
});

test('milestoneExcelSummaryLine falls back to the due date when there is no actual date yet', function () {
  const m = { name: 'Requirements Defined', dueDate: '2026-05-12', actualDate: null, status: 'not-started', notApplicable: false };
  assertEqual(milestoneExcelSummaryLine(m), `Requirements Defined: ${fmtDateY('2026-05-12')} (Not Started)`);
});

test('milestoneExcelSummaryLine shows an em dash when neither date is set', function () {
  const m = { name: 'Scope Item Confirmed', dueDate: null, actualDate: null, status: 'pending', notApplicable: false };
  assertEqual(milestoneExcelSummaryLine(m), 'Scope Item Confirmed: — (Pending)');
});

test('milestoneExcelSummaryLine shows a plain "N/A" line, no date, for a Not Applicable milestone', function () {
  const m = { name: 'Skipped Step', dueDate: '2026-01-01', actualDate: '2026-01-05', status: 'green', notApplicable: true };
  assertEqual(milestoneExcelSummaryLine(m), 'Skipped Step: N/A');
});

test('milestoneExcelSummaryLine reads "Completed Late" the same way the live status board does', function () {
  const m = { name: 'Late Finish', dueDate: '2026-01-01', actualDate: '2026-01-10', status: 'complete', notApplicable: false };
  assertEqual(milestoneExcelSummaryLine(m), `Late Finish: ${fmtDateY('2026-01-10')} (Completed Late)`);
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
// linkFolder()/reconnectFolder()/initFileSync() all gate on window.showDirectoryPicker,
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

// ---------- Daily backups to a separately-chosen folder ----------
// A second, independent copy of every live-sync write, dated and dropped
// directly into a separately-chosen folder (backupDirHandle, no nested
// "Backup" subfolder) — see writeBackupCopy()/chooseBackupFolder() in
// pulse.html. Its on/off state
// is surfaced only via the topbar's #backupSyncIndicator (updateBackupSyncUI(),
// tested below) — there's no longer a matching row in the "Sync to a folder"
// modal, removed once the topbar indicator made it redundant. Most of this
// is gated behind window.showDirectoryPicker/indexedDB, neither of which the
// JXA harness provides, so (matching unlinkFolder()'s own documented
// exception) chooseBackupFolder()/unlinkBackupFolder() and the IndexedDB-
// touching half of initFileSync() are not exercised here. What's tested
// directly is the pure logic: the filename builder and writeBackupCopy()'s
// early-return guards (both of which fire before ever touching
// backupDirHandle's own methods, so they're safe to exercise even with a
// plain fake object standing in for a real FileSystemDirectoryHandle).

test('backupFileName builds a dated pulse-backup-<date>.json name', function () {
  assertEqual(backupFileName('2026-07-30'), 'pulse-backup-2026-07-30.json');
});

test('writeBackupCopy is a no-op when no backup folder has been chosen', async function () {
  backupDirHandle = null;
  lastBackupWrittenDate = null;
  await writeBackupCopy({ workstreams: [] });
  assertEqual(lastBackupWrittenDate, null, 'nothing to write to, so nothing should be recorded as written');
});

test('writeBackupCopy is a no-op once today\'s backup has already been written', async function () {
  const today = todayStr();
  // A plain object stands in for a real FileSystemDirectoryHandle — safe
  // here because the "already written today" guard returns before this
  // function ever calls any method on backupDirHandle.
  backupDirHandle = { name: 'Fake Folder' };
  lastBackupWrittenDate = today;
  await writeBackupCopy({ workstreams: [] });
  assertEqual(lastBackupWrittenDate, today, 'should still just be today\'s date, unchanged — no attempt to write again');
});

test('updateBackupSyncUI hides the topbar indicator when the browser has no showDirectoryPicker support (matching the JXA harness itself)', function () {
  backupDirHandle = { name: 'Fake Folder' };
  updateBackupSyncUI();
  assertEqual(document.getElementById('backupSyncIndicator').style.display, 'none');
});

// ---------- Daily backups are Editor+ only ----------
// An explicit user request ("offer backup link only for editor and admin
// role. disable it (grey) for all other roles") — unlike linking the main
// file, which stays available (and is now mandatory) at every role. Both
// guards run before either function ever touches window.showDirectoryPicker,
// so — unlike the rest of this feature — they're safely testable here even
// though the JXA harness has no such API to provide.

test('chooseBackupFolder is blocked below Editor, and never touches backupDirHandle', async function () {
  userRole = 'reviewer';
  backupDirHandle = null;
  await chooseBackupFolder();
  assertEqual(backupDirHandle, null);
});

test('chooseBackupFolder is reachable at Editor and Admin (falls through to the missing-API guard in this harness, not the role one)', async function () {
  userRole = 'editor';
  backupDirHandle = null;
  await chooseBackupFolder();
  assertIncludes(document.getElementById('toastMsg').textContent, 'Daily backups require Chrome or Edge');
});

test('unlinkBackupFolder is blocked below Editor, and leaves an existing backupDirHandle untouched', async function () {
  userRole = 'visitor';
  backupDirHandle = { name: 'Existing Folder' };
  await unlinkBackupFolder();
  assertEqual(backupDirHandle.name, 'Existing Folder');
});

test('unlinkBackupFolder proceeds at Editor+', async function () {
  userRole = 'admin';
  backupDirHandle = { name: 'Existing Folder' };
  await unlinkBackupFolder();
  assertEqual(backupDirHandle, null);
});

// ---------- Review cycles now merge field-by-field, not as an opaque whole ----------
// A review cycle used to merge as one unit — mergeData() skipped an incoming
// cycle entirely once its id was known locally, so a concurrent edit on two
// devices (e.g. two reviewers confirming different items in the same active
// cycle) would silently discard whichever side's write reached the shared
// file last. mergeReviewCycle() replaces that with the same per-field
// merge items/milestones already get.

function addCycleForMerge(overrides) {
  const cycle = Object.assign({
    id: 'cycle-1', workstreamId: workstreams[0].id, startedAt: 1000, completedAt: null, cancelledAt: null,
    confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null
  }, overrides || {});
  reviewCycles.push(cycle);
  return cycle;
}

test('mergeData merges two different item confirmations on the same cycle independently — both survive', function () {
  const local = addCycleForMerge({ confirmations: [{ itemId: 'item-a', confirmed: true, updatedAt: 1000 }] });
  const incoming = { id: 'cycle-1', workstreamId: workstreams[0].id, startedAt: 1000, completedAt: null, cancelledAt: null,
    confirmations: [{ itemId: 'item-b', confirmed: true, updatedAt: 1500 }], milestoneConfirmations: [], changeLog: [], minutes: null };
  const { changed } = mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertTrue(changed, 'a review-cycle-only merge should still report changed:true');
  assertEqual(local.confirmations.length, 2);
  assertTrue(local.confirmations.find(c => c.itemId === 'item-a').confirmed, 'the local confirmation should survive');
  assertTrue(local.confirmations.find(c => c.itemId === 'item-b').confirmed, 'the incoming confirmation should also be adopted');
});

test('mergeData resolves a concurrently-toggled confirmation on the same item by newer updatedAt, not by whichever write lands last', function () {
  const local = addCycleForMerge({ confirmations: [{ itemId: 'item-a', confirmed: true, updatedAt: 1000 }] });
  // Incoming un-confirmed the same item, but at an OLDER timestamp than the
  // local confirm — the local (newer) state must win.
  let incoming = { id: 'cycle-1', workstreamId: workstreams[0].id, confirmations: [{ itemId: 'item-a', confirmed: false, updatedAt: 500 }], milestoneConfirmations: [], changeLog: [], minutes: null };
  mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertTrue(local.confirmations.find(c => c.itemId === 'item-a').confirmed, 'the older incoming un-confirm should not overwrite the newer local confirm');
  // A genuinely newer incoming edit should win.
  incoming = { id: 'cycle-1', workstreamId: workstreams[0].id, confirmations: [{ itemId: 'item-a', confirmed: false, updatedAt: 2000 }], milestoneConfirmations: [], changeLog: [], minutes: null };
  mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertFalse(local.confirmations.find(c => c.itemId === 'item-a').confirmed, 'a genuinely newer incoming edit should win');
});

test('mergeData merges milestoneConfirmations the same way, independently of confirmations', function () {
  const local = addCycleForMerge({ milestoneConfirmations: [{ milestoneId: 'ms-a', confirmed: true, updatedAt: 1000 }] });
  const incoming = { id: 'cycle-1', workstreamId: workstreams[0].id, confirmations: [], milestoneConfirmations: [{ milestoneId: 'ms-b', confirmed: true, updatedAt: 1200 }], changeLog: [], minutes: null };
  mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertEqual(local.milestoneConfirmations.length, 2);
});

test('mergeData unions changeLog entries by id and re-sorts by changedAt, rather than keeping only one side', function () {
  const local = addCycleForMerge({ changeLog: [{ id: 'e1', itemName: 'A', milestoneName: null, change: 'First', changedAt: 3000 }] });
  const incoming = { id: 'cycle-1', workstreamId: workstreams[0].id, confirmations: [], milestoneConfirmations: [],
    changeLog: [{ id: 'e1', itemName: 'A', milestoneName: null, change: 'First', changedAt: 3000 }, { id: 'e2', itemName: 'B', milestoneName: null, change: 'Second', changedAt: 1000 }],
    minutes: null };
  mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertEqual(local.changeLog.length, 2, 'the shared entry (same id) should not be duplicated');
  assertEqual(local.changeLog[0].id, 'e2', 'merged changeLog should be re-sorted by changedAt, not left in append order');
  assertEqual(local.changeLog[1].id, 'e1');
});

test('mergeData merges minutes as one whole unit, newer updatedAt wins', function () {
  const local = addCycleForMerge({ minutes: { summary: 'Local summary', decisions: '', nextSteps: '', actionItems: [], importedAt: 1000, updatedAt: 1000 } });
  let incoming = { id: 'cycle-1', workstreamId: workstreams[0].id, confirmations: [], milestoneConfirmations: [], changeLog: [],
    minutes: { summary: 'Stale incoming', decisions: '', nextSteps: '', actionItems: [], importedAt: 500, updatedAt: 500 } };
  mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertEqual(local.minutes.summary, 'Local summary', 'an older incoming minutes edit should not overwrite the newer local one');
  incoming = { id: 'cycle-1', workstreamId: workstreams[0].id, confirmations: [], milestoneConfirmations: [], changeLog: [],
    minutes: { summary: 'Fresh incoming', decisions: '', nextSteps: '', actionItems: [], importedAt: 2000, updatedAt: 2000 } };
  mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertEqual(local.minutes.summary, 'Fresh incoming');
});

test('mergeData adopts an incoming completedAt when the local copy of the cycle is still active', function () {
  const local = addCycleForMerge({});
  const incoming = { id: 'cycle-1', workstreamId: workstreams[0].id, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null,
    completedAt: 5000, itemCountAtClose: 3, confirmedCountAtClose: 3 };
  mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertEqual(local.completedAt, 5000);
  assertEqual(local.itemCountAtClose, 3);
  assertEqual(local.confirmedCountAtClose, 3);
});

test('mergeData reports changed:false when a merge genuinely brings in nothing new', function () {
  addCycleForMerge({ confirmations: [{ itemId: 'item-a', confirmed: true, updatedAt: 1000 }] });
  const { changed } = mergeData({ workstreams: [], items: [], reviewCycles: [{ id: 'cycle-1', workstreamId: workstreams[0].id, confirmations: [{ itemId: 'item-a', confirmed: true, updatedAt: 1000 }], milestoneConfirmations: [], changeLog: [], minutes: null }] });
  assertFalse(changed, 'an identical incoming copy should not report a change');
});

// ---------- A cancelled review cycle now sweeps too, the same as items/milestones/actionLog/decisionLog ----------
// A user-reported gap: "how will the app react if someone started a review
// and is actively working on it, and a second user cancelled the review?"
// Before this fix, cancelReviewCycle() spliced the cycle out locally with no
// tombstone at all, and mergeData()'s reviewCycles loop was purely additive
// (only ever looked at what was present in incoming data) — so a device
// still actively working on the exact same cycle never noticed the
// cancellation, and that device's own next save could resurrect the
// "cancelled" cycle right back into the shared file. Fixed the same way the
// other four entity types already were: a real tombstone (deletedReviewCycleIds)
// plus a sweep in mergeData(), gated by reviewCycleLastTouchedAt() (a review
// cycle has no single updatedAt, unlike an item, so this reduces over every
// place activity on a cycle gets timestamped instead).

test('reviewCycleLastTouchedAt reduces over every timestamped field on a cycle, not just startedAt', function () {
  const cycle = {
    startedAt: 1000,
    confirmations: [{ itemId: 'a', confirmed: true, updatedAt: 3000 }],
    milestoneConfirmations: [{ milestoneId: 'm', confirmed: true, updatedAt: 2000 }],
    changeLog: [{ id: 'e1', changedAt: 4000 }],
    minutes: { updatedAt: 2500 },
    completedAt: null
  };
  assertEqual(reviewCycleLastTouchedAt(cycle), 4000, 'the latest of startedAt/confirmations/milestoneConfirmations/changeLog/minutes.updatedAt/completedAt wins');
});

test('reviewCycleLastTouchedAt falls back to startedAt when nothing else on the cycle has any activity', function () {
  const cycle = { startedAt: 1000, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null, completedAt: null };
  assertEqual(reviewCycleLastTouchedAt(cycle), 1000);
});

test('mergeData sweeps a locally-existing review cycle once its tombstone merges in, when nothing has touched it since the cancellation', function () {
  const local = addCycleForMerge({ id: 'stale-cycle', startedAt: 1000 });
  const { changed } = mergeData({ workstreams: [], items: [], reviewCycles: [], deletedReviewCycleIds: [{ id: 'stale-cycle', deletedAt: 2000 }] });
  assertTrue(changed);
  assertEqual(reviewCycles.find(c => c.id === 'stale-cycle'), undefined, 'a cancelled-elsewhere cycle nobody is still working on must be swept locally too');
});

test('mergeData does NOT sweep a review cycle someone is still actively working on — a confirmation timestamped after the cancellation wins, the same escape hatch items/milestones already have', function () {
  const local = addCycleForMerge({ id: 'active-cycle', startedAt: 1000,
    milestoneConfirmations: [{ milestoneId: 'm1', confirmed: true, updatedAt: 5000 }] });
  mergeData({ workstreams: [], items: [], reviewCycles: [], deletedReviewCycleIds: [{ id: 'active-cycle', deletedAt: 2000 }] });
  assertTrue(!!reviewCycles.find(c => c.id === 'active-cycle'), 'genuine activity after the cancellation must survive it, exactly like an item edited after its own deletion');
});

test('mergeData with respectTombstones:false never sweeps a locally-existing review cycle (applyImport merge mode)', function () {
  addCycleForMerge({ id: 'kept-cycle', startedAt: 1000 });
  mergeData({ workstreams: [], items: [], reviewCycles: [], deletedReviewCycleIds: [{ id: 'kept-cycle', deletedAt: 9999999999999 }] }, { respectTombstones: false });
  assertTrue(!!reviewCycles.find(c => c.id === 'kept-cycle'));
});

test('mergeData refuses to re-add an incoming review cycle that matches a local cancellation tombstone newer than the incoming copy\'s own activity', function () {
  const wsId = workstreams[0].id;
  const incoming = { id: 'reappearing-cycle', workstreamId: wsId, startedAt: 1000, completedAt: null, cancelledAt: null,
    confirmations: [], milestoneConfirmations: [{ milestoneId: 'm', confirmed: true, updatedAt: 1500 }], changeLog: [], minutes: null };
  const { changed } = mergeData({ workstreams: [], items: [], reviewCycles: [incoming], deletedReviewCycleIds: [{ id: 'reappearing-cycle', deletedAt: 2000 }] });
  assertFalse(changed);
  assertEqual(reviewCycles.find(c => c.id === 'reappearing-cycle'), undefined, 'a third party\'s stale incoming copy must not resurrect an already-cancelled cycle');
});

test('mergeData lets an incoming review cycle back in when its own activity is genuinely newer than a local cancellation tombstone', function () {
  const wsId = workstreams[0].id;
  deletedReviewCycleIds.push({ id: 'revived-cycle', deletedAt: 1000 });
  const incoming = { id: 'revived-cycle', workstreamId: wsId, startedAt: 500, completedAt: null, cancelledAt: null,
    confirmations: [], milestoneConfirmations: [{ milestoneId: 'm', confirmed: true, updatedAt: 5000 }], changeLog: [], minutes: null };
  mergeData({ workstreams: [], items: [], reviewCycles: [incoming] });
  assertTrue(!!reviewCycles.find(c => c.id === 'revived-cycle'), 'activity newer than the tombstone is a genuine edit made elsewhere after the cancellation, not a stale resurrection');
});

test('the exact reported scenario: Device 2 cancels a review, Device 1 (mid-review) confirms a milestone — the cancellation sticks once Device 1\'s own activity is accounted for as having happened before the cancel', function () {
  const wsId = workstreams[0].id;
  // Device 1's own local state: an active cycle, no activity yet.
  const local = addCycleForMerge({ id: 'shared-cycle', workstreamId: wsId, startedAt: 1000 });
  // Device 2 cancels at t=2000 — its own incoming data has no confirmations
  // newer than that, so Device 1's merge (still at t=1000) correctly sweeps it.
  mergeData({ workstreams: [], items: [], reviewCycles: [], deletedReviewCycleIds: [{ id: 'shared-cycle', deletedAt: 2000 }] });
  assertEqual(reviewCycles.find(c => c.id === 'shared-cycle'), undefined, 'with no activity since the cancel, Device 1 correctly picks up the cancellation');
});

// ---------- Duplicate active review cycles get reconciled, not silently orphaned ----------
// Two people clicking "Start review cycle" for the same workstream before
// either side had synced the other's write used to leave two distinct
// "active" cycles — activeReviewCycle() only ever finds the first match, so
// the second one's confirmations/changeLog would sit invisibly in
// reviewCycles forever. reconcileDuplicateActiveCycles() (called from
// normalizeData()) folds the newer one into the older and drops the
// duplicate.

test('reconcileDuplicateActiveCycles folds a later-started duplicate active cycle for the same workstream into the earlier one', function () {
  const wsId = workstreams[0].id;
  reviewCycles.push({ id: 'early', workstreamId: wsId, startedAt: 1000, completedAt: null, cancelledAt: null,
    confirmations: [{ itemId: 'item-a', confirmed: true, updatedAt: 1000 }], milestoneConfirmations: [], changeLog: [], minutes: null });
  reviewCycles.push({ id: 'late', workstreamId: wsId, startedAt: 2000, completedAt: null, cancelledAt: null,
    confirmations: [{ itemId: 'item-b', confirmed: true, updatedAt: 2000 }], milestoneConfirmations: [], changeLog: [], minutes: null });
  normalizeData();
  assertEqual(reviewCycles.filter(c => c.workstreamId === wsId).length, 1, 'only one cycle should remain for this workstream');
  assertEqual(reviewCycles[0].id, 'early', 'the earlier-started cycle should be the one kept');
  assertEqual(reviewCycles[0].confirmations.length, 2, 'confirmations from both should be merged in, not lost');
});

test('reconcileDuplicateActiveCycles leaves a completed and an active cycle for the same workstream alone', function () {
  const wsId = workstreams[0].id;
  reviewCycles.push({ id: 'done', workstreamId: wsId, startedAt: 1000, completedAt: 1500, cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null });
  reviewCycles.push({ id: 'active', workstreamId: wsId, startedAt: 2000, completedAt: null, cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null });
  normalizeData();
  assertEqual(reviewCycles.length, 2, 'a completed cycle is history, not a duplicate of the active one');
});

test('reconcileDuplicateActiveCycles never folds active cycles that belong to different workstreams', function () {
  const w2 = { id: 'ws-2', name: 'Second', color: 'teal', order: 1 };
  workstreams.push(w2);
  reviewCycles.push({ id: 'c1', workstreamId: workstreams[0].id, startedAt: 1000, completedAt: null, cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null });
  reviewCycles.push({ id: 'c2', workstreamId: w2.id, startedAt: 1000, completedAt: null, cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null });
  normalizeData();
  assertEqual(reviewCycles.length, 2);
});

// ---------- mergeKeyedRecords() proactively sweeps a stale local record, not just protects against re-adding one ----------
// A user-reported bug: this function used to be purely additive — the loop
// over incomingList only ever adds/updates a record actually present there,
// so a record already sitting in existingList but simply *absent* from
// incomingList (the ordinary shape of "someone else already deleted it")
// was never even considered for removal. Concretely: device A deletes a
// review cycle's meeting minutes, correctly tombstoning and shrinking its
// own actionLog — but a second device that had already synced in its own
// copy of that action item beforehand never dropped it, and its own next
// write (any unrelated edit at all) could republish that still-stale,
// longer array right back into the shared file.

test('mergeKeyedRecords proactively removes an existing record whose tombstone is at least as new as its own updatedAt, even when incomingList is empty', function () {
  const existing = [{ id: 'a', updatedAt: 1000 }];
  const tombstones = [{ id: 'a', deletedAt: 2000 }];
  const { merged, changed } = mergeKeyedRecords(existing, [], 'id', tombstones, true);
  assertEqual(merged.length, 0);
  assertTrue(changed);
});

test('mergeKeyedRecords leaves an existing record alone when its own updatedAt is newer than the tombstone — a genuine edit made after the delete wins', function () {
  const existing = [{ id: 'a', updatedAt: 3000 }];
  const tombstones = [{ id: 'a', deletedAt: 2000 }];
  const { merged, changed } = mergeKeyedRecords(existing, [], 'id', tombstones, true);
  assertEqual(merged.length, 1);
  assertFalse(changed);
});

test('mergeKeyedRecords skips the sweep entirely when respectTombstones is false (applyImport merge mode\'s own opt-out)', function () {
  const existing = [{ id: 'a', updatedAt: 1000 }];
  const tombstones = [{ id: 'a', deletedAt: 9999 }];
  const { merged, changed } = mergeKeyedRecords(existing, [], 'id', tombstones, false);
  assertEqual(merged.length, 1);
  assertFalse(changed);
});

test('mergeKeyedRecords skips the sweep entirely when no tombstones list is given at all — the two confirmation arrays\' own shape, which are never removed, only flipped', function () {
  const existing = [{ id: 'a', updatedAt: 1000, confirmed: true }];
  const { merged, changed } = mergeKeyedRecords(existing, [], 'id', null, true);
  assertEqual(merged.length, 1);
  assertFalse(changed);
});

test('mergeData proactively drops a locally-existing action item once its tombstone merges in, even though the incoming actionLog simply omits it rather than listing it — the second-device scenario above', function () {
  const w = workstreams[0];
  w.actionLog = [{ id: 'stale-a', text: 'Already deleted elsewhere', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  const incoming = {
    workstreams: [{ id: w.id, name: w.name, color: w.color, order: 0, updatedAt: 0, actionLog: [], decisionLog: [] }],
    items: [],
    deletedActionLogIds: [{ id: 'stale-a', deletedAt: 2000 }]
  };
  const { changed } = mergeData(incoming);
  assertTrue(changed);
  assertEqual(w.actionLog.length, 0, 'a locally-existing record whose tombstone just merged in must be swept, not just protected against being re-added');
});

test('mergeData does the identical sweep for decisionLog', function () {
  const w = workstreams[0];
  w.decisionLog = [{ id: 'stale-d', text: 'Already deleted elsewhere', cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  const incoming = {
    workstreams: [{ id: w.id, name: w.name, color: w.color, order: 0, updatedAt: 0, actionLog: [], decisionLog: [] }],
    items: [],
    deletedDecisionLogIds: [{ id: 'stale-d', deletedAt: 2000 }]
  };
  mergeData(incoming);
  assertEqual(w.decisionLog.length, 0);
});

test('mergeData does not sweep a locally-existing action item whose own edit is newer than the incoming tombstone', function () {
  const w = workstreams[0];
  w.actionLog = [{ id: 'edited-after', text: 'Edited after the delete', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c1', addedAt: 1000, updatedAt: 3000, flagged: false }];
  const incoming = {
    workstreams: [{ id: w.id, name: w.name, color: w.color, order: 0, updatedAt: 0, actionLog: [], decisionLog: [] }],
    items: [],
    deletedActionLogIds: [{ id: 'edited-after', deletedAt: 2000 }] // older than the local edit
  };
  mergeData(incoming);
  assertEqual(w.actionLog.length, 1, 'a locally-newer edit must survive an older/stale tombstone');
});

test('mergeData with respectTombstones:false (applyImport merge mode) never sweeps a locally-existing action item', function () {
  const w = workstreams[0];
  w.actionLog = [{ id: 'kept', text: 'Kept regardless', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  const incoming = {
    workstreams: [{ id: w.id, name: w.name, color: w.color, order: 0, updatedAt: 0, actionLog: [], decisionLog: [] }],
    items: [],
    deletedActionLogIds: [{ id: 'kept', deletedAt: 9999 }]
  };
  mergeData(incoming, { respectTombstones: false });
  assertEqual(w.actionLog.length, 1, 'respectTombstones:false must leave the local copy untouched, matching the existing incoming-side opt-out');
});

// ---------- programme now merges field-by-field too, not never at all ----------
// mergeData() used to never touch data.programme at all — the only path
// that ever applied an incoming programme object was replaceFromFileData(),
// gated by isFreshLocalState(), which only ever fires for a genuinely
// untouched, brand-new install. A role password (or a rename) changed on
// one device would otherwise never reach a second device that already had
// any real data of its own — a user-reported bug.

test('mergeData merges an incoming programme rename when the incoming updatedAt is newer', function () {
  programme.name = 'Old Name';
  programme.updatedAt = 1000;
  const { changed } = mergeData({ programme: { name: 'New Name', updatedAt: 2000, rolePasswords: {}, rolePasswordsUpdatedAt: {} }, workstreams: [], items: [] });
  assertTrue(changed);
  assertEqual(programme.name, 'New Name');
  assertEqual(programme.updatedAt, 2000);
});

test('mergeData does not let a stale incoming programme rename overwrite a newer local one', function () {
  programme.name = 'Fresh Local Name';
  programme.updatedAt = 5000;
  const { changed } = mergeData({ programme: { name: 'Stale Incoming Name', updatedAt: 1000, rolePasswords: {}, rolePasswordsUpdatedAt: {} }, workstreams: [], items: [] });
  assertFalse(changed);
  assertEqual(programme.name, 'Fresh Local Name');
});

test('mergeData merges rolePasswords per-role via rolePasswordsUpdatedAt — one role\'s newer change never touches a different role\'s own, independently-set entry', async function () {
  const localEditorHash = await hashRolePassword('local-editor-pass');
  programme.rolePasswords = { reviewer: null, editor: localEditorHash, admin: null };
  programme.rolePasswordsUpdatedAt = { reviewer: 0, editor: 5000, admin: 0 };

  const incomingReviewerHash = await hashRolePassword('incoming-reviewer-pass');
  const staleIncomingEditorHash = await hashRolePassword('stale-incoming-editor-pass');
  const { changed } = mergeData({
    programme: {
      name: programme.name, updatedAt: 0, rolePasswords: { reviewer: incomingReviewerHash, editor: staleIncomingEditorHash, admin: null },
      rolePasswordsUpdatedAt: { reviewer: 3000, editor: 1000, admin: 0 } // reviewer is newer, editor is older than local
    },
    workstreams: [], items: []
  });

  assertTrue(changed);
  assertDeepEqual(programme.rolePasswords.reviewer, incomingReviewerHash, 'reviewer had no local entry — the incoming (newer) one wins');
  assertDeepEqual(programme.rolePasswords.editor, localEditorHash, 'editor\'s own local change is newer than the incoming one — must survive');
  assertEqual(programme.rolePasswordsUpdatedAt.editor, 5000, 'the local timestamp must stay too, not just the value');
});

test('mergeData can merge a role password being cleared (set back to null) via a newer incoming rolePasswordsUpdatedAt', function () {
  programme.rolePasswords = { reviewer: { salt: 'x', hash: 'y' }, editor: null, admin: null };
  programme.rolePasswordsUpdatedAt = { reviewer: 1000, editor: 0, admin: 0 };
  mergeData({
    programme: {
      name: programme.name, updatedAt: 0, rolePasswords: { reviewer: null, editor: null, admin: null },
      rolePasswordsUpdatedAt: { reviewer: 2000, editor: 0, admin: 0 }
    },
    workstreams: [], items: []
  });
  assertEqual(programme.rolePasswords.reviewer, null, 'a genuinely newer "cleared" state must win, the same as a genuinely newer set one would');
});

test('mergeData reports changed:false when the incoming programme has nothing newer at all', function () {
  programme.name = 'Steady Name';
  programme.updatedAt = 5000;
  programme.rolePasswords = { reviewer: null, editor: null, admin: null };
  programme.rolePasswordsUpdatedAt = { reviewer: 0, editor: 0, admin: 0 };
  const { changed } = mergeData({ programme: { name: 'Steady Name', updatedAt: 1000, rolePasswords: {}, rolePasswordsUpdatedAt: {} }, workstreams: [], items: [] });
  assertFalse(changed);
});

// lastSeenAppVersion (see updateOutdatedVersionBanner() and APP_VERSION in
// the inline script) merges by plain Math.max, unlike rolePasswords — a
// bare integer already has a total order, so "highest wins" needs no
// companion updatedAt timestamp the way a nullable {salt,hash} value does.
test('mergeData merges a higher incoming programme.lastSeenAppVersion (max-wins)', function () {
  programme.lastSeenAppVersion = APP_VERSION;
  const { changed } = mergeData({ programme: { name: programme.name, updatedAt: 0, lastSeenAppVersion: APP_VERSION + 3 }, workstreams: [], items: [] });
  assertTrue(changed);
  assertEqual(programme.lastSeenAppVersion, APP_VERSION + 3);
});

test('mergeData never lets a lower/stale incoming programme.lastSeenAppVersion pull the local (higher) stamp back down', function () {
  programme.lastSeenAppVersion = APP_VERSION + 5;
  const { changed } = mergeData({ programme: { name: programme.name, updatedAt: 0, lastSeenAppVersion: APP_VERSION }, workstreams: [], items: [] });
  assertFalse(changed);
  assertEqual(programme.lastSeenAppVersion, APP_VERSION + 5);
});

test('save() stamps programme.lastSeenAppVersion up to at least APP_VERSION, but never regresses an already-higher (teammate\'s newer) stamp', function () {
  programme.lastSeenAppVersion = APP_VERSION - 1;
  save();
  assertEqual(programme.lastSeenAppVersion, APP_VERSION, 'a lower/legacy stamp is bumped up to this device\'s own running version');

  programme.lastSeenAppVersion = APP_VERSION + 4;
  save();
  assertEqual(programme.lastSeenAppVersion, APP_VERSION + 4, 'saving from an older build must never regress a teammate\'s newer stamp');
});

test('updateOutdatedVersionBanner shows the banner (and names both versions) only when programme.lastSeenAppVersion is ahead of this device\'s own APP_VERSION', function () {
  programme.lastSeenAppVersion = APP_VERSION;
  updateOutdatedVersionBanner();
  assertEqual(document.getElementById('outdatedVersionBanner').style.display, 'none', 'same version — nothing to warn about');

  programme.lastSeenAppVersion = APP_VERSION + 2;
  updateOutdatedVersionBanner();
  assertEqual(document.getElementById('outdatedVersionBanner').style.display, 'flex');
  const text = document.getElementById('outdatedVersionBannerText').textContent;
  assertIncludes(text, `v${APP_VERSION}`, 'names this device\'s own version');
  assertIncludes(text, `v${APP_VERSION + 2}`, 'names the newer version a teammate is on');
});

test('mergeData works even when the incoming data has no programme field at all (e.g. a stray workstream-only file)', function () {
  const before = programme.name;
  const { changed } = mergeData({ workstreams: [], items: [] });
  assertFalse(changed);
  assertEqual(programme.name, before);
});

test('the actual fix for the reported bug: a device with real data of its own (isFreshLocalState() false) still picks up an incoming role password change through the ordinary merge path, not just through a fresh-install replace', async function () {
  // Renaming the programme alone is enough to make isFreshLocalState() false
  // (see its own tests above) — the whole point being that mergeData(), not
  // just replaceFromFileData(), must be what carries the change through
  // from here on, once this device has any real data of its own.
  programme.name = 'A Real Programme, Not a Fresh Install';
  assertFalse(isFreshLocalState());
  programme.rolePasswords = { reviewer: null, editor: null, admin: null };
  programme.rolePasswordsUpdatedAt = { reviewer: 0, editor: 0, admin: 0 };

  const newHash = await hashRolePassword('set-on-another-device');
  const { changed } = mergeData({
    programme: {
      name: programme.name, updatedAt: 0, rolePasswords: { reviewer: null, editor: newHash, admin: null },
      rolePasswordsUpdatedAt: { reviewer: 0, editor: Date.now(), admin: 0 }
    },
    workstreams: [], items: []
  });
  assertTrue(changed);
  assertDeepEqual(programme.rolePasswords.editor, newHash);
});

// ---------- Workstreams now merge field-by-field too (actionLog/decisionLog/name/color) ----------
// mergeWorkstreamFields() extends the identical fix one level up: a
// workstream used to be skipped outright once its id was known locally,
// which meant its actionLog/decisionLog (action items/decisions synced in
// from a parallel review's meeting minutes) could stomp each other the same
// way unmerged review cycles could.

test('mergeData merges a workstream\'s actionLog by entry id when the workstream itself already exists locally', function () {
  const w = workstreams[0];
  w.actionLog = [{ id: 'a1', text: 'Local action', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  const incoming = { id: w.id, name: w.name, color: w.color, order: 0, updatedAt: 0,
    actionLog: [{ id: 'a2', text: 'Incoming action', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c1', addedAt: 1500, updatedAt: 1500, flagged: false }], decisionLog: [] };
  const { changed } = mergeData({ workstreams: [incoming], items: [] });
  assertTrue(changed, 'a workstream-only merge should still report changed:true');
  assertEqual(w.actionLog.length, 2);
  assertTrue(w.actionLog.some(a => a.id === 'a1'));
  assertTrue(w.actionLog.some(a => a.id === 'a2'));
});

test('mergeData merges a workstream\'s decisionLog the same way, and merges name/color as plain scalars by updatedAt', function () {
  const w = workstreams[0];
  w.updatedAt = 1000;
  w.decisionLog = [{ id: 'd1', text: 'Local decision', cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  const incoming = { id: w.id, name: 'Renamed Elsewhere', color: 'pink', order: 0, updatedAt: 2000,
    actionLog: [], decisionLog: [{ id: 'd2', text: 'Incoming decision', cycleId: 'c1', addedAt: 1500, updatedAt: 1500, flagged: false }] };
  mergeData({ workstreams: [incoming], items: [] });
  assertEqual(w.decisionLog.length, 2);
  assertEqual(w.name, 'Renamed Elsewhere', 'a newer incoming updatedAt should win the name/color scalar merge');
  assertEqual(w.color, 'pink');
});

test('mergeData does not let a stale incoming workstream name/color overwrite a newer local edit', function () {
  const w = workstreams[0];
  w.name = 'Local Fresh Name'; w.updatedAt = 5000;
  const incoming = { id: w.id, name: 'Stale Incoming Name', color: 'red', order: 0, updatedAt: 1000, actionLog: [], decisionLog: [] };
  mergeData({ workstreams: [incoming], items: [] });
  assertEqual(w.name, 'Local Fresh Name');
});

test('deleteActionLogItem tombstones the entry, and a later merge with a stale incoming copy does not resurrect it', function () {
  const w = workstreams[0];
  w.actionLog = [{ id: 'gone-a', text: 'To delete', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  deleteActionLogItem(w.id, 'gone-a');
  confirmModalAction();
  assertEqual(w.actionLog.length, 0);
  assertTrue(deletedActionLogIds.some(x => x.id === 'gone-a'));
  const staleIncoming = { id: w.id, name: w.name, color: w.color, order: 0, updatedAt: 0,
    actionLog: [{ id: 'gone-a', text: 'To delete', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }], decisionLog: [] };
  mergeData({ workstreams: [staleIncoming], items: [] });
  assertEqual(w.actionLog.length, 0, 'a stale incoming copy must not resurrect a deleted action item');
  triggerToastUndo();
  assertEqual(w.actionLog.length, 1, 'undo should still restore it locally');
  assertFalse(deletedActionLogIds.some(x => x.id === 'gone-a'), 'undo should clear the tombstone');
});

test('deleteDecisionLogItem tombstones the entry the same way', function () {
  const w = workstreams[0];
  w.decisionLog = [{ id: 'gone-d', text: 'To delete', cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  deleteDecisionLogItem(w.id, 'gone-d');
  confirmModalAction();
  assertTrue(deletedDecisionLogIds.some(x => x.id === 'gone-d'));
  triggerToastUndo();
  assertFalse(deletedDecisionLogIds.some(x => x.id === 'gone-d'));
});

test('syncDecisionLogFromMinutes tombstones a decision dropped by re-saving minutes, so a stale merge cannot resurrect it', function () {
  const w = workstreams[0];
  const cycle = { id: 'c1', workstreamId: w.id, startedAt: 1000, completedAt: null, cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null };
  reviewCycles.push(cycle);
  syncDecisionLogFromMinutes(cycle, 'First decision.\nSecond decision.');
  assertEqual(w.decisionLog.length, 2);
  const firstId = w.decisionLog.find(d => d.text === 'First decision.').id;
  // Re-saving with only the second decision drops the first — it must be
  // tombstoned, not just filtered out, or a later merge could bring it back.
  syncDecisionLogFromMinutes(cycle, 'Second decision.');
  assertEqual(w.decisionLog.length, 1);
  assertTrue(deletedDecisionLogIds.some(x => x.id === firstId));
});

test('removeActionLogForCycle/removeDecisionLogForCycle tombstone what they remove', function () {
  const w = workstreams[0];
  const cycle = { id: 'c1', workstreamId: w.id, startedAt: 1000, completedAt: null, cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null };
  reviewCycles.push(cycle);
  w.actionLog = [{ id: 'a1', text: 'X', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  w.decisionLog = [{ id: 'd1', text: 'Y', cycleId: 'c1', addedAt: 1000, updatedAt: 1000, flagged: false }];
  removeActionLogForCycle(cycle);
  removeDecisionLogForCycle(cycle);
  assertEqual(w.actionLog.length, 0);
  assertEqual(w.decisionLog.length, 0);
  assertTrue(deletedActionLogIds.some(x => x.id === 'a1'));
  assertTrue(deletedDecisionLogIds.some(x => x.id === 'd1'));
});

test('normalizeData migrates the old {itemId, confirmedAt} confirmation shape to {confirmed, updatedAt}', function () {
  reviewCycles.push({ id: 'legacy', workstreamId: workstreams[0].id, startedAt: 1000, completedAt: null, cancelledAt: null,
    confirmations: [{ itemId: 'item-a', confirmedAt: 1234 }], milestoneConfirmations: [{ milestoneId: 'ms-a', confirmedAt: 5678 }], changeLog: [], minutes: null });
  normalizeData();
  const c = reviewCycles.find(x => x.id === 'legacy');
  assertTrue(c.confirmations[0].confirmed);
  assertEqual(c.confirmations[0].updatedAt, 1234);
  assertTrue(c.milestoneConfirmations[0].confirmed);
  assertEqual(c.milestoneConfirmations[0].updatedAt, 5678);
});

test('normalizeData backfills a stable id onto a legacy changeLog entry with none', function () {
  reviewCycles.push({ id: 'legacy2', workstreamId: workstreams[0].id, startedAt: 1000, completedAt: null, cancelledAt: null,
    confirmations: [], milestoneConfirmations: [], changeLog: [{ itemName: 'A', milestoneName: null, change: 'Something', changedAt: 1000 }], minutes: null });
  normalizeData();
  assertTrue(isSafeId(reviewCycles.find(c => c.id === 'legacy2').changeLog[0].id));
});
