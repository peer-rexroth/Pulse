// ---------- Multi-file sync: partition/recombine ----------
// A linked *folder* (see "File System Access API sync" in CLAUDE.md) holds
// one pulse-index.json plus one readable pulse-ws-<slug>-<id-suffix>.json
// per real workstream, so that concurrent edits to *different* workstreams
// never collide on the same file the way a single linked file always did.
// slugify()/wsFileName()/wsNameLookup()/buildIndexPayload()/
// buildWorkstreamPayload()/buildAllSyncPayloads()/recombineSyncData() are
// the pure functions this whole feature is built on — no DOM, no I/O — so
// unlike linkFolder()/reconnectFolder()/doFileSyncWrite()/pollFileSync()
// (which are gated behind window.showDirectoryPicker/indexedDB and can't be
// exercised in this harness, matching the rest of file sync's own
// documented testing caveat), these are fully testable directly against
// live global state.

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

test('wsFileName builds a readable pulse-ws-<slug>-<id-suffix>.json name, not a bare cryptic id', function () {
  assertEqual(wsFileName('abcdef123456', 'Marketing Launch'), 'pulse-ws-marketing-launch-123456.json');
});

test('slugify lowercases, collapses non-alphanumeric runs to a single dash, and trims the edges', function () {
  assertEqual(slugify('Marketing Launch'), 'marketing-launch');
  assertEqual(slugify('  Q1 / Q2  Rollout!! '), 'q1-q2-rollout');
  assertEqual(slugify('--already--dashed--'), 'already-dashed');
});

test('slugify falls back to "workstream" for a name with nothing slug-safe in it (blank, or symbols/emoji only)', function () {
  assertEqual(slugify(''), 'workstream');
  assertEqual(slugify('   '), 'workstream');
  assertEqual(slugify('★彡🚀'), 'workstream');
  assertEqual(slugify(null), 'workstream');
});

test('slugify caps at 40 characters and never leaves a trailing dash from the cut', function () {
  const long = 'A'.repeat(50) + ' Extra Words That Get Cut Off Here';
  const s = slugify(long);
  assertTrue(s.length <= 40, `expected <= 40 chars, got ${s.length}`);
  assertFalse(s.endsWith('-'), 'must not end on a dash left over from truncation');
});

test('wsFileName stays unique for two workstreams that slugify to the exact same string, via the id suffix', function () {
  const nameA = wsFileName('id0000001111aa', 'Migration!!!');
  const nameB = wsFileName('id0000002222bb', 'Migration???'); // same slug, "migration", different id
  assertTrue(nameA !== nameB, `expected distinct filenames, got ${nameA} and ${nameB}`);
});

test('buildAllSyncPayloads() computes each workstream\'s current filename via wsFileNames, keyed by id like wsTexts', function () {
  const { wsA, wsB } = seedMultiFileFixture();
  const { wsFileNames } = buildAllSyncPayloads();
  assertEqual(wsFileNames[wsA.id], wsFileName(wsA.id, wsA.name));
  assertEqual(wsFileNames[wsB.id], wsFileName(wsB.id, wsB.name));
  assertTrue(wsFileNames[wsA.id].includes(slugify(wsA.name)), 'the workstream\'s own current name must be reflected in its filename');
});

test('buildAllSyncPayloads() recomputes the filename fresh from the current name — renaming a workstream changes which file it writes to next, without needing any special rename-handling code', function () {
  const { wsA } = seedMultiFileFixture();
  const before = buildAllSyncPayloads().wsFileNames[wsA.id];
  wsA.name = 'Renamed Workstream';
  const after = buildAllSyncPayloads().wsFileNames[wsA.id];
  assertTrue(before !== after, 'the computed filename must reflect the rename on the very next call, with no caching');
  assertTrue(after.includes('renamed-workstream'), `expected the new slug in ${after}`);
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

test('buildIndexPayload() carries programme/categories and all tombstone lists', function () {
  seedMultiFileFixture();
  programme.name = 'Test Programme';
  const idx = buildIndexPayload();
  assertEqual(idx.programme.name, 'Test Programme');
  assertDeepEqual(idsOf(idx.categories), idsOf(categories));
  assertDeepEqual(idx.deletedItemIds, deletedItemIds);
  assertDeepEqual(idx.deletedMilestoneIds, deletedMilestoneIds);
  assertDeepEqual(idx.deletedWorkstreamIds, deletedWorkstreamIds);
  assertDeepEqual(idx.deletedActionLogIds, deletedActionLogIds);
  assertDeepEqual(idx.deletedDecisionLogIds, deletedDecisionLogIds);
});

test('buildIndexPayload() never includes mode/theme/colorScheme/filterWorkstreamId — nothing reads them back from a synced file, so they must not trigger a write on every navigation', function () {
  seedMultiFileFixture();
  const idx = buildIndexPayload();
  assertFalse('mode' in idx, 'mode must not be part of the index payload');
  assertFalse('theme' in idx, 'theme must not be part of the index payload');
  assertFalse('colorScheme' in idx, 'colorScheme must not be part of the index payload');
  assertFalse('filterWorkstreamId' in idx, 'filterWorkstreamId must not be part of the index payload');
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

test('wsNameLookup() prefers the freshly-read index\'s own name over a locally-cached one for the same id', function () {
  const { wsA } = seedMultiFileFixture();
  const staleLocalName = wsA.name;
  const map = wsNameLookup([{ id: wsA.id, name: 'Renamed Elsewhere' }]);
  assertEqual(map[wsA.id], 'Renamed Elsewhere', 'the index is the best signal for what the file on disk was actually named under');
  assertTrue(map[wsA.id] !== staleLocalName);
});

test('wsNameLookup() falls back to the local name for an id the index doesn\'t know about yet', function () {
  const { wsA } = seedMultiFileFixture();
  const map = wsNameLookup([]); // e.g. a workstream created locally, not yet synced out
  assertEqual(map[wsA.id], wsA.name);
});

// ---------- Stray sync-conflict-copy detection & absorption ----------
// isStrayFileName()/strayMergedFileName() are pure, no DOM/FS dependency —
// tested directly, same split as the rest of this file.
// scanAndMergeStrayFiles()/renameStrayFile() take a dirHandle as a plain
// parameter rather than reading the syncDirHandle global, so unlike
// linkFolder()/reconnectFolder()/pollFileSync() (real entry points, gated
// behind window.showDirectoryPicker and thus unreachable here) these are
// exercisable directly against a minimal in-memory fake standing in for a
// real FileSystemDirectoryHandle — the same "substitute a minimal fake, not
// the real DOM/FS mock" technique already used for backupDirHandle in this
// project's own test history (see writeBackupCopy()'s own tests).
function makeFakeDir(initialFiles) {
  const files = Object.assign({}, initialFiles || {});
  return {
    files,
    async getFileHandle(name, opts) {
      if (!(name in files)) {
        if (opts && opts.create) { files[name] = ''; }
        else { const e = new Error('NotFoundError'); e.name = 'NotFoundError'; throw e; }
      }
      return {
        async getFile() { return { async text() { return files[name]; } }; },
        async createWritable() { return { async write(text) { files[name] = text; }, async close() {} }; }
      };
    },
    async removeEntry(name) { delete files[name]; },
    values() { return Object.keys(files).map(n => ({ kind: 'file', name: n })); }
  };
}

test('isStrayFileName matches a file sharing the real file\'s base name but not its exact name', function () {
  assertTrue(isStrayFileName('pulse-ws-alpha-abc123-JOHNS-MAC.json', 'pulse-ws-alpha-abc123', 'pulse-ws-alpha-abc123.json'));
  assertFalse(isStrayFileName('pulse-ws-alpha-abc123.json', 'pulse-ws-alpha-abc123', 'pulse-ws-alpha-abc123.json'), 'the exact canonical name itself is never its own stray');
  assertFalse(isStrayFileName('pulse-ws-beta-def456.json', 'pulse-ws-alpha-abc123', 'pulse-ws-alpha-abc123.json'), 'a different workstream\'s own file must never match');
});

test('isStrayFileName ignores non-.json files and a file already renamed merged_... by a previous scan', function () {
  assertFalse(isStrayFileName('pulse-ws-alpha-abc123-JOHNS-MAC.txt', 'pulse-ws-alpha-abc123', 'pulse-ws-alpha-abc123.json'));
  assertFalse(isStrayFileName('merged_pulse-ws-alpha-abc123-JOHNS-MAC.json', 'pulse-ws-alpha-abc123', 'pulse-ws-alpha-abc123.json'), 'already absorbed on a prior scan — must not be re-treated as a fresh stray');
});

test('strayMergedFileName prefixes with merged_ (not a trailing suffix), and disambiguates with a number when that name is already taken', function () {
  assertEqual(strayMergedFileName('pulse-ws-alpha-abc123-JOHNS-MAC.json', 1), 'merged_pulse-ws-alpha-abc123-JOHNS-MAC.json');
  assertEqual(strayMergedFileName('pulse-ws-alpha-abc123-JOHNS-MAC.json', 2), 'merged_2_pulse-ws-alpha-abc123-JOHNS-MAC.json');
});

test('renameStrayFile writes the content under the disambiguated name and removes the original — a rename, not a delete', async function () {
  const strayName = 'pulse-ws-alpha-abc123-JOHNS-MAC.json';
  const collidingName = 'merged_pulse-ws-alpha-abc123-JOHNS-MAC.json';
  const dir = makeFakeDir({ [strayName]: '{"a":1}', [collidingName]: '{"already":"here"}' });
  const target = await renameStrayFile(dir, strayName, '{"a":1}');
  assertEqual(target, 'merged_2_pulse-ws-alpha-abc123-JOHNS-MAC.json', 'must not collide with the pre-existing merged_... name');
  assertFalse(strayName in dir.files, 'the original stray name must be gone');
  assertEqual(dir.files[collidingName], '{"already":"here"}', 'the pre-existing collision itself must be untouched');
  assertEqual(dir.files[target], '{"a":1}');
});

test('scanAndMergeStrayFiles finds a stray workstream-file conflict copy, merges its changes in, and renames (not deletes) it', async function () {
  const { wsA } = seedMultiFileFixture();
  const { indexText, wsTexts, wsFileNames } = buildAllSyncPayloads();
  const strayData = JSON.parse(wsTexts[wsA.id]);
  const strayEntryId = genId();
  strayData.actionLog.push({ id: strayEntryId, text: 'Only in the stray copy', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: 'c', addedAt: Date.now(), updatedAt: Date.now(), flagged: false });
  const strayText = JSON.stringify(strayData, null, 2);
  const strayName = wsFileNames[wsA.id].replace('.json', '-JOHNS-MAC.json');
  const mergedName = `merged_${strayName}`;

  const dir = makeFakeDir({
    [SYNC_INDEX_FILE]: indexText,
    [wsFileNames[wsA.id]]: wsTexts[wsA.id],
    [strayName]: strayText
  });

  const before = syncConflictLog.length;
  const mergedAny = await scanAndMergeStrayFiles(dir);

  assertTrue(mergedAny, 'the stray file carried a genuinely new action item, so this must report a real change');
  assertTrue(wsA.actionLog.some(a => a.id === strayEntryId), 'the stray copy\'s action item must actually land in memory');
  assertFalse(strayName in dir.files, 'the stray file itself must be gone from its original name');
  assertTrue(mergedName in dir.files, 'renamed, not deleted, per this app\'s own "never delete data we don\'t have to" convention');
  assertEqual(dir.files[mergedName], strayText, 'the renamed copy keeps the exact original content');
  assertTrue(syncConflictLog.length > before, 'must be logged through the same conflict-audit trail a field-level clash already uses');
});

test('scanAndMergeStrayFiles finds a stray index conflict copy and merges its changes in via recombineSyncData, so a brand-new item mentioned only there is picked up', async function () {
  const { wsA } = seedMultiFileFixture();
  const { indexText, wsTexts, wsFileNames } = buildAllSyncPayloads();
  const strayIndexData = JSON.parse(indexText);
  const strayItemId = genId();
  strayIndexData.items.push({ id: strayItemId, workstreamId: null, categoryId: pendingCategory().id, name: 'Only in the stray index', status: 'pending', startDate: todayStr(), dueDate: todayStr(), actualDate: null, updatedAt: Date.now(), milestones: [], itStatus: 'green', businessStatus: 'green', budgetStatus: 'green', order: 99, dependency: false, dependencySpoc: null, itemType: 'scope', journeyId: null });
  const strayText = JSON.stringify(strayIndexData, null, 2);
  const strayName = SYNC_INDEX_FILE.replace('.json', '-JOHNS-MAC.json');

  const dir = makeFakeDir({
    [SYNC_INDEX_FILE]: indexText,
    [wsFileNames[wsA.id]]: wsTexts[wsA.id],
    [strayName]: strayText
  });

  const mergedAny = await scanAndMergeStrayFiles(dir);

  assertTrue(mergedAny);
  assertTrue(items.some(it => it.id === strayItemId), 'the item only present in the stray index must be merged into memory');
  assertFalse(strayName in dir.files);
  assertTrue(`merged_${strayName}` in dir.files);
});

test('scanAndMergeStrayFiles is a no-op — returns false, renames nothing — when the folder has nothing stray in it', async function () {
  const { wsA } = seedMultiFileFixture();
  const { indexText, wsTexts, wsFileNames } = buildAllSyncPayloads();
  const dir = makeFakeDir({ [SYNC_INDEX_FILE]: indexText, [wsFileNames[wsA.id]]: wsTexts[wsA.id] });
  const namesBefore = Object.keys(dir.files).slice().sort();
  const mergedAny = await scanAndMergeStrayFiles(dir);
  assertFalse(mergedAny);
  assertDeepEqual(Object.keys(dir.files).slice().sort(), namesBefore, 'nothing in the folder should be touched');
});

test('a file already renamed merged_... by a previous scan is left alone on the next scan, not re-processed', async function () {
  const { wsA } = seedMultiFileFixture();
  const { indexText, wsTexts, wsFileNames } = buildAllSyncPayloads();
  const alreadyMergedName = `merged_${wsFileNames[wsA.id].replace('.json', '-JOHNS-MAC.json')}`;
  const dir = makeFakeDir({
    [SYNC_INDEX_FILE]: indexText,
    [wsFileNames[wsA.id]]: wsTexts[wsA.id],
    [alreadyMergedName]: wsTexts[wsA.id]
  });
  const mergedAny = await scanAndMergeStrayFiles(dir);
  assertFalse(mergedAny);
  assertTrue(alreadyMergedName in dir.files, 'must still be there, untouched — not re-read, not re-renamed');
});
