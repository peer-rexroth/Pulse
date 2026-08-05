// ---------- Multi-file sync: partition/recombine ----------
// A linked *folder* (see "File System Access API sync" in CLAUDE.md) holds
// one pulse-index.json plus one pulse-ws-<id>.json per real workstream, so
// that concurrent edits to *different* workstreams never collide on the
// same file the way a single linked file always did. wsFileName()/
// buildIndexPayload()/buildWorkstreamPayload()/buildAllSyncPayloads()/
// recombineSyncData() are the pure functions this whole feature is built
// on — no DOM, no I/O — so unlike linkFolder()/reconnectFolder()/
// doFileSyncWrite()/pollFileSync() (which are gated behind
// window.showDirectoryPicker/indexedDB and can't be exercised in this
// harness, matching the rest of file sync's own documented testing
// caveat), these are fully testable directly against live global state.

function idsOf(list) { return list.map(x => x.id).sort(); }
function byId(list) { const m = {}; list.forEach(x => m[x.id] = x); return m; }

// Seeds a second real workstream (workstreams[0] already exists from
// resetState()) plus one item/one review cycle/one actionLog entry/one
// decisionLog entry on each of the two real workstreams, one Unassigned
// scope item, and one Journey + one Sub Journey (both itemType-based,
// always workstreamId:null) — enough of a spread across "belongs to
// workstream A", "belongs to workstream B", and "belongs to neither" to
// exercise the actual partitioning this feature exists to get right.
function seedMultiFileFixture() {
  const wsA = workstreams[0];
  const wsB = { id: genId(), name: 'Workstream B', color: 'green', order: 1, updatedAt: Date.now(), actionLog: [], decisionLog: [] };
  workstreams.push(wsB);

  wsA.actionLog = [{ id: genId(), text: 'A action', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c', addedAt: Date.now(), flagged: false }];
  wsA.decisionLog = [{ id: genId(), text: 'A decision', cycleId: 'c', addedAt: Date.now(), flagged: false }];
  wsB.actionLog = [{ id: genId(), text: 'B action', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c', addedAt: Date.now(), flagged: false }];
  wsB.decisionLog = [{ id: genId(), text: 'B decision', cycleId: 'c', addedAt: Date.now(), flagged: false }];

  const itemA = { id: genId(), workstreamId: wsA.id, categoryId: categories[0].id, name: 'Item A', status: 'green', startDate: todayStr(), dueDate: todayStr(), actualDate: null, updatedAt: Date.now(), milestones: [], itStatus: 'green', businessStatus: 'green', budgetStatus: 'green', order: 0, dependency: false, dependencySpoc: null, itemType: 'scope', journeyId: null };
  const itemB = { id: genId(), workstreamId: wsB.id, categoryId: categories[0].id, name: 'Item B', status: 'green', startDate: todayStr(), dueDate: todayStr(), actualDate: null, updatedAt: Date.now(), milestones: [], itStatus: 'green', businessStatus: 'green', budgetStatus: 'green', order: 0, dependency: false, dependencySpoc: null, itemType: 'scope', journeyId: null };
  const itemUnassigned = { id: genId(), workstreamId: null, categoryId: pendingCategory().id, name: 'Unassigned Item', status: 'pending', startDate: todayStr(), dueDate: todayStr(), actualDate: null, updatedAt: Date.now(), milestones: [], itStatus: 'green', businessStatus: 'green', budgetStatus: 'green', order: 0, dependency: false, dependencySpoc: null, itemType: 'scope', journeyId: null };
  const journey = { id: genId(), workstreamId: null, categoryId: null, name: 'A Journey', status: 'not-started', startDate: todayStr(), dueDate: todayStr(), actualDate: null, updatedAt: Date.now(), milestones: [], itStatus: 'green', businessStatus: 'green', budgetStatus: 'green', order: 0, dependency: false, dependencySpoc: null, itemType: 'journey', journeyId: null };
  const subJourney = { id: genId(), workstreamId: null, categoryId: null, name: 'A Sub Journey', status: 'not-started', startDate: todayStr(), dueDate: todayStr(), actualDate: null, updatedAt: Date.now(), milestones: [], itStatus: 'green', businessStatus: 'green', budgetStatus: 'green', order: 0, dependency: false, dependencySpoc: null, itemType: 'subjourney', journeyId: null, parentJourneyId: journey.id };
  items.push(itemA, itemB, itemUnassigned, journey, subJourney);

  const cycleA = { id: genId(), workstreamId: wsA.id, startedAt: Date.now(), completedAt: null, cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null };
  const cycleB = { id: genId(), workstreamId: wsB.id, startedAt: Date.now(), completedAt: null, cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null };
  reviewCycles.push(cycleA, cycleB);

  deletedItemIds.push({ id: genId(), deletedAt: Date.now() });
  deletedMilestoneIds.push({ id: genId(), deletedAt: Date.now() });

  return { wsA, wsB, itemA, itemB, itemUnassigned, journey, subJourney, cycleA, cycleB };
}

test('wsFileName builds a pulse-ws-<id>.json name', function () {
  assertEqual(wsFileName('abc123'), 'pulse-ws-abc123.json');
});

test('buildIndexPayload() strips actionLog/decisionLog off each workstream, keeping only real metadata', function () {
  const { wsA } = seedMultiFileFixture();
  const idx = buildIndexPayload();
  const w = idx.workstreams.find(w => w.id === wsA.id);
  assertDeepEqual(Object.keys(w).sort(), ['color', 'id', 'name', 'order', 'updatedAt'].sort());
});

test('buildIndexPayload() includes only workstreamId:null items — Unassigned scope items and every Journey/Sub Journey', function () {
  const { itemA, itemB, itemUnassigned, journey, subJourney } = seedMultiFileFixture();
  const idx = buildIndexPayload();
  assertDeepEqual(idsOf(idx.items), idsOf([itemUnassigned, journey, subJourney]));
  assertFalse(idx.items.some(it => it.id === itemA.id), 'a real workstream\'s own item must not leak into the index');
  assertFalse(idx.items.some(it => it.id === itemB.id));
});

test('buildIndexPayload() carries programme/categories/mode/theme/colorScheme/filterWorkstreamId and all tombstone lists', function () {
  seedMultiFileFixture();
  programme.name = 'Test Programme';
  const idx = buildIndexPayload();
  assertEqual(idx.programme.name, 'Test Programme');
  assertDeepEqual(idsOf(idx.categories), idsOf(categories));
  assertEqual(idx.mode, mode);
  assertEqual(idx.theme, theme);
  assertEqual(idx.colorScheme, colorScheme);
  assertDeepEqual(idx.deletedItemIds, deletedItemIds);
  assertDeepEqual(idx.deletedMilestoneIds, deletedMilestoneIds);
  assertDeepEqual(idx.deletedWorkstreamIds, deletedWorkstreamIds);
  assertDeepEqual(idx.deletedActionLogIds, deletedActionLogIds);
  assertDeepEqual(idx.deletedDecisionLogIds, deletedDecisionLogIds);
});

test('buildWorkstreamPayload(id) includes only that workstream\'s own items, review cycles, actionLog, and decisionLog', function () {
  const { wsA, wsB, itemA, itemB, cycleA } = seedMultiFileFixture();
  const payloadA = buildWorkstreamPayload(wsA.id);
  assertEqual(payloadA.workstreamId, wsA.id);
  assertDeepEqual(idsOf(payloadA.items), [itemA.id]);
  assertDeepEqual(idsOf(payloadA.reviewCycles), [cycleA.id]);
  assertDeepEqual(payloadA.actionLog, wsA.actionLog);
  assertDeepEqual(payloadA.decisionLog, wsA.decisionLog);
  assertFalse(payloadA.items.some(it => it.id === itemB.id), 'workstream A\'s own file must never include workstream B\'s item');
});

test('buildWorkstreamPayload(id) for a workstream with nothing yet returns empty arrays, not undefined', function () {
  const freshWs = { id: genId(), name: 'Empty WS', color: 'grey', order: 2, updatedAt: Date.now(), actionLog: [], decisionLog: [] };
  workstreams.push(freshWs);
  const payload = buildWorkstreamPayload(freshWs.id);
  assertDeepEqual(payload.items, []);
  assertDeepEqual(payload.reviewCycles, []);
  assertDeepEqual(payload.actionLog, []);
  assertDeepEqual(payload.decisionLog, []);
});

test('buildAllSyncPayloads() produces valid JSON text for the index and exactly one entry per real workstream', function () {
  const { wsA, wsB } = seedMultiFileFixture();
  const { indexText, wsTexts } = buildAllSyncPayloads();
  const parsedIndex = JSON.parse(indexText);
  assertDeepEqual(parsedIndex, buildIndexPayload());
  assertDeepEqual(Object.keys(wsTexts).sort(), [wsA.id, wsB.id].sort());
  assertDeepEqual(JSON.parse(wsTexts[wsA.id]), buildWorkstreamPayload(wsA.id));
  assertDeepEqual(JSON.parse(wsTexts[wsB.id]), buildWorkstreamPayload(wsB.id));
});

test('every item appears in exactly one of the built payloads — the index, or exactly one workstream file, never zero or two', function () {
  const fixture = seedMultiFileFixture();
  const { indexText, wsTexts } = buildAllSyncPayloads();
  const indexItemIds = JSON.parse(indexText).items.map(it => it.id);
  const wsItemIdLists = Object.values(wsTexts).map(t => JSON.parse(t).items.map(it => it.id));
  items.forEach(it => {
    const inIndex = indexItemIds.includes(it.id);
    const inWsCount = wsItemIdLists.filter(list => list.includes(it.id)).length;
    assertTrue((inIndex ? 1 : 0) + inWsCount === 1, `item "${it.name}" (${it.id}) must appear in exactly one payload, found index=${inIndex} wsCount=${inWsCount}`);
  });
});

test('recombineSyncData() round-trips build->recombine back to the original flat state', function () {
  const fixture = seedMultiFileFixture();
  const { indexText, wsTexts } = buildAllSyncPayloads();
  const indexData = JSON.parse(indexText);
  const wsDataById = {}; Object.entries(wsTexts).forEach(([id, t]) => wsDataById[id] = JSON.parse(t));
  const recombined = recombineSyncData(indexData, wsDataById);

  assertDeepEqual(idsOf(recombined.workstreams), idsOf(workstreams));
  const recombinedWsById = byId(recombined.workstreams);
  assertDeepEqual(recombinedWsById[fixture.wsA.id].actionLog, fixture.wsA.actionLog);
  assertDeepEqual(recombinedWsById[fixture.wsA.id].decisionLog, fixture.wsA.decisionLog);
  assertDeepEqual(recombinedWsById[fixture.wsB.id].actionLog, fixture.wsB.actionLog);

  assertDeepEqual(idsOf(recombined.items), idsOf(items));
  assertDeepEqual(idsOf(recombined.reviewCycles), idsOf(reviewCycles));
  assertDeepEqual(idsOf(recombined.categories), idsOf(categories));
  assertEqual(recombined.programme.name, programme.name);
  assertDeepEqual(recombined.deletedItemIds, deletedItemIds);
  assertDeepEqual(recombined.deletedMilestoneIds, deletedMilestoneIds);

  // Full round-trip of one representative item's own content, not just its id.
  const originalItemA = byId(items)[fixture.itemA.id];
  const recombinedItemA = byId(recombined.items)[fixture.itemA.id];
  assertDeepEqual(recombinedItemA, originalItemA);
});

test('recombineSyncData() treats a workstream listed in the index but missing from wsDataById as empty, never throws', function () {
  const { wsA, wsB } = seedMultiFileFixture();
  const indexData = buildIndexPayload();
  const recombined = recombineSyncData(indexData, {}); // no workstream data supplied at all
  assertDeepEqual(idsOf(recombined.workstreams), idsOf(workstreams));
  const recombinedWsById = byId(recombined.workstreams);
  assertDeepEqual(recombinedWsById[wsA.id].actionLog, []);
  assertDeepEqual(recombinedWsById[wsA.id].decisionLog, []);
  // Only the index-level items (Unassigned/Journeys) survive — every real
  // workstream's own items/reviewCycles are gone, since nothing supplied them.
  assertDeepEqual(idsOf(recombined.items), idsOf(indexData.items));
  assertDeepEqual(recombined.reviewCycles, []);
});

test('buildIndexPayload()/buildWorkstreamPayload() are pure functions of live state — moving an item between workstreams is reflected on the very next call, with no caching', function () {
  const { wsA, wsB, itemA } = seedMultiFileFixture();
  assertTrue(buildWorkstreamPayload(wsA.id).items.some(it => it.id === itemA.id));
  assertFalse(buildWorkstreamPayload(wsB.id).items.some(it => it.id === itemA.id));

  itemA.workstreamId = wsB.id; // move it, the same way saveItem()'s own workstream-reassignment would

  assertFalse(buildWorkstreamPayload(wsA.id).items.some(it => it.id === itemA.id), 'must no longer show up in its old workstream\'s payload');
  assertTrue(buildWorkstreamPayload(wsB.id).items.some(it => it.id === itemA.id), 'must now show up in its new workstream\'s payload');
});
