// ---------- Journeys ----------
// A Journey is not a separate top-level data shape — it's a plain item (see
// "Data model" in CLAUDE.md) with itemType:'journey', forced into the
// reserved Journey category (journeyCategory()/isJourneyCategory()) seeded
// with JOURNEY_DEFAULT_MILESTONES. A Journey is deliberately never assigned
// to a workstream at all (workstreamId is always null — an explicit user
// correction: "Journey should not be assigned to workstreams. They are
// overarching"), which is also why it gets its own sidebar-less
// #journeysBody container and its own topbar button outside the shared
// .view-tabs pill, mirroring Admin mode's own "not workstream-scoped"
// treatment. Marking a Journey's last milestone (JOURNEY_MAPPED_MILESTONE)
// Complete auto-opens a modal to decompose it into one or more linked scope
// items (journeyId) — each row in that modal picks its own workstream,
// since the Journey has none to inherit.

function addJourney(name) {
  openItemModal(null, null, 'journey');
  document.getElementById('itemNameInput').value = name || 'New Journey';
  saveItem();
  return items[items.length - 1];
}

function completeJourneyMappedMilestone(it) {
  const m = it.milestones.find(m => m.name === 'Journey Mapped');
  while (m.status !== 'complete') cycleMilestoneStatus(it.id, m.id);
}

// ---------- Reserved category ----------

test('journeyCategory/isJourneyCategory find the one category flagged journey:true', function () {
  const cat = journeyCategory();
  assertTrue(cat.journey);
  assertEqual(cat.name, 'Journey');
  assertTrue(isJourneyCategory(cat.id));
  assertFalse(isJourneyCategory(categories.find(c => c.pending).id));
});

test('the reserved Journey category is seeded with the 4 fixed milestones, in order', function () {
  assertDeepEqual(journeyCategory().milestones, ['Journey Defined', 'Journey Approved', 'High-level Architecture Approved', 'Journey Mapped']);
});

// ---------- Creating a Journey ----------

test('openItemModal(null, null, "journey") seeds a new Journey from the reserved category, with no workstream field shown', function () {
  openItemModal(null, null, 'journey');
  assertEqual(document.getElementById('itemModalTitle').textContent, 'New Journey');
  assertEqual(editingItemType, 'journey');
  assertDeepEqual(editingMilestones.map(m => m.name), JOURNEY_DEFAULT_MILESTONES);
  assertEqual(document.getElementById('itemWorkstreamField').style.display, 'none', 'a Journey is never assigned to a workstream, so the field is hidden outright');
  const catHtml = document.getElementById('itemCategorySelect').innerHTML;
  assertIncludes(catHtml, `value="${journeyCategory().id}"`);
  assertNotIncludes(catHtml, `value="${categories.find(c => c.name === 'Development').id}"`, 'no real category should be offered for a Journey');
  assertTrue(document.getElementById('itemCategorySelect').disabled, 'a Journey\'s category is always locked, not just below Editor');
});

test('saveItem creates a new Journey with itemType, the reserved category, no workstream, and its milestone checklist', function () {
  const it = addJourney('Customer Onboarding');
  assertEqual(it.itemType, 'journey');
  assertEqual(it.categoryId, journeyCategory().id);
  assertEqual(it.workstreamId, null, 'a Journey is overarching — never assigned to a workstream');
  assertEqual(it.journeyId, null);
  assertDeepEqual(it.milestones.map(m => m.name), JOURNEY_DEFAULT_MILESTONES);
  it.milestones.forEach(m => assertEqual(m.status, 'not-started'));
});

test('a plain new item never picks up itemType:"journey" and still shows the Workstream field — openItemModal with no third argument defaults to a scope item', function () {
  openItemModal(null, workstreams[0].id);
  assertEqual(editingItemType, 'scope');
  assertFalse(document.getElementById('itemWorkstreamField').style.display === 'none');
  document.getElementById('itemNameInput').value = 'Ordinary item';
  // The fake <select>'s innerHTML "selected" marker doesn't sync .value the
  // way a real browser would (documented mock limitation) — set directly,
  // same convention as every other test that saves a select's value.
  document.getElementById('itemWorkstreamSelect').value = workstreams[0].id;
  saveItem();
  const it = items[items.length - 1];
  assertEqual(it.itemType, 'scope');
  assertEqual(it.workstreamId, workstreams[0].id);
  assertFalse(document.getElementById('itemCategorySelect').disabled);
});

test('editing an existing Journey keeps its title, locked category, hidden workstream field, and itemType', function () {
  const it = addJourney('Vendor Integration');
  openItemModal(it.id);
  assertEqual(document.getElementById('itemModalTitle').textContent, 'Edit Journey');
  assertEqual(editingItemType, 'journey');
  assertTrue(document.getElementById('itemCategorySelect').disabled);
  assertEqual(document.getElementById('itemWorkstreamField').style.display, 'none');
  document.getElementById('itemNameInput').value = 'Vendor Integration (renamed)';
  saveItem();
  assertEqual(it.name, 'Vendor Integration (renamed)');
  assertEqual(it.itemType, 'journey', 'itemType must never change via a plain re-save');
  assertEqual(it.categoryId, journeyCategory().id);
  assertEqual(it.workstreamId, null);
});

test('closeItemModal resets editingItemType back to "scope"', function () {
  openItemModal(null, null, 'journey');
  closeItemModal();
  assertEqual(editingItemType, 'scope');
});

test('creating a Journey is blocked below Editor', function () {
  userRole = 'reviewer';
  openItemModal(null, null, 'journey');
  assertEqual(document.getElementById('itemSaveBtn').style.display, 'none');
});

// ---------- populateCategorySelect ----------

test('populateCategorySelect(id, true) offers only the Journey category', function () {
  populateCategorySelect(journeyCategory().id, true);
  const html = document.getElementById('itemCategorySelect').innerHTML;
  assertIncludes(html, `value="${journeyCategory().id}"`);
  categories.filter(c => !c.journey).forEach(c => assertNotIncludes(html, `value="${c.id}"`));
});

test('populateCategorySelect(id) (falsy journeyOnly) excludes the Journey category', function () {
  populateCategorySelect(categories[0].id);
  const html = document.getElementById('itemCategorySelect').innerHTML;
  assertNotIncludes(html, `value="${journeyCategory().id}"`);
  categories.filter(c => !c.journey).forEach(c => assertIncludes(html, `value="${c.id}"`));
});

// ---------- Row badge ----------

test('itemRowHtml shows a Journey badge icon in the name cell for a Journey, not for a scope item', function () {
  const journey = addJourney('Onboarding Journey');
  const scope = addItem({ name: 'Ordinary scope item' });
  assertIncludes(itemRowHtml(journey), 'journey-type-badge');
  assertNotIncludes(itemRowHtml(scope), 'journey-type-badge');
});

// ---------- isJourneyMapped / the decompose trigger ----------

test('isJourneyMapped is false until the "Journey Mapped" milestone is specifically Complete', function () {
  const it = addJourney();
  assertFalse(isJourneyMapped(it));
  const other = it.milestones.find(m => m.name === 'Journey Defined');
  cycleMilestoneStatus(it.id, other.id); // -> green, still not the right milestone
  assertFalse(isJourneyMapped(it));
});

test('isJourneyMapped is false for a plain scope item even if it happens to have a same-named milestone', function () {
  const it = addItem({ name: 'Coincidence', milestones: [{ id: 'm1', name: 'Journey Mapped', dueDate: todayStr(), status: 'complete', actualDate: null }] });
  assertFalse(isJourneyMapped(it));
});

test('completing the "Journey Mapped" milestone via cycleMilestoneStatus auto-opens the decompose modal', function () {
  const it = addJourney();
  journeyDecomposeItemId = null;
  completeJourneyMappedMilestone(it);
  assertTrue(isJourneyMapped(it));
  assertEqual(journeyDecomposeItemId, it.id);
  assertTrue(document.getElementById('journeyDecomposeModalBg').classList.contains('open'));
});

test('completing an unrelated milestone on a Journey never triggers the decompose modal', function () {
  const it = addJourney();
  journeyDecomposeItemId = null; // module-level state, not reset between tests by resetState() — same convention pending.test.js uses for scopeAssignItemId
  const defined = it.milestones.find(m => m.name === 'Journey Defined');
  cycleMilestoneStatus(it.id, defined.id); cycleMilestoneStatus(it.id, defined.id);
  cycleMilestoneStatus(it.id, defined.id); cycleMilestoneStatus(it.id, defined.id); // -> complete
  assertEqual(journeyDecomposeItemId, null);
});

test('the decompose modal does not re-open on an unrelated save once "Journey Mapped" is already Complete', function () {
  const it = addJourney();
  completeJourneyMappedMilestone(it);
  closeJourneyDecomposeModal();
  const defined = it.milestones.find(m => m.name === 'Journey Defined');
  cycleMilestoneStatus(it.id, defined.id); // an unrelated milestone change
  assertEqual(journeyDecomposeItemId, null, 'should not re-trigger just because some other milestone changed');
});

test('cycling some other milestone on a Journey whose "Journey Mapped" is already complete does not re-open the modal (regression: prevJourneyMappedStatus must key off the right milestone, not the one being cycled)', function () {
  const it = addJourney();
  completeJourneyMappedMilestone(it);
  closeJourneyDecomposeModal();
  journeyDecomposeItemId = null;
  const approved = it.milestones.find(m => m.name === 'Journey Approved');
  cycleMilestoneStatus(it.id, approved.id);
  assertEqual(journeyDecomposeItemId, null);
});

test('marking "Journey Mapped" Complete via the full item modal\'s dropdown also triggers the decompose modal', function () {
  const it = addJourney();
  openItemModal(it.id);
  const idx = editingMilestones.findIndex(m => m.name === 'Journey Mapped');
  editingMilestones[idx].status = 'complete';
  journeyDecomposeItemId = null;
  saveItem();
  assertEqual(journeyDecomposeItemId, it.id);
  assertTrue(document.getElementById('journeyDecomposeModalBg').classList.contains('open'));
});

test('itemRowHtml routes a mapped Journey\'s status badge to openJourneyDecomposeModal instead of openItemModal', function () {
  const it = addJourney();
  completeJourneyMappedMilestone(it);
  closeJourneyDecomposeModal();
  const html = itemRowHtml(it);
  assertIncludes(html, `onclick="openJourneyDecomposeModal('${it.id}')"`);
});

test('itemRowHtml uses the normal openItemModal status badge for a not-yet-mapped Journey', function () {
  const it = addJourney();
  const html = itemRowHtml(it);
  assertIncludes(html, `onclick="openItemModal('${it.id}')"`);
  assertNotIncludes(html, 'openJourneyDecomposeModal');
});

// ---------- The decompose modal itself ----------

test('openJourneyDecomposeModal seeds one blank row (defaulting to the first workstream) and sets the modal title to the Journey\'s name', function () {
  const it = addJourney('Supplier Onboarding');
  openJourneyDecomposeModal(it.id);
  assertEqual(editingDecomposeItems.length, 1);
  assertEqual(editingDecomposeItems[0].name, '');
  assertEqual(editingDecomposeItems[0].workstreamId, workstreams[0].id);
  assertEqual(document.getElementById('journeyDecomposeModalTitle').textContent, 'Decompose "Supplier Onboarding"');
});

test('addJourneyDecomposeRow/removeJourneyDecomposeRow grow and shrink the working rows array', function () {
  const it = addJourney();
  openJourneyDecomposeModal(it.id);
  addJourneyDecomposeRow();
  assertEqual(editingDecomposeItems.length, 2);
  removeJourneyDecomposeRow(0);
  assertEqual(editingDecomposeItems.length, 1);
});

test('renderJourneyDecomposeRows offers every real workstream, and never offers Pending or Journey as a row\'s category choice', function () {
  const it = addJourney();
  openJourneyDecomposeModal(it.id);
  const html = document.getElementById('journeyDecomposeRows').innerHTML;
  assertIncludes(html, `value="${workstreams[0].id}"`);
  assertNotIncludes(html, `value="${categories.find(c => c.pending).id}"`);
  assertNotIncludes(html, `value="${journeyCategory().id}"`);
});

test('applyJourneyDecompose creates one linked scope item per non-blank row, using each row\'s own workstream', function () {
  const secondWs = { id: genId(), name: 'Second', color: 'teal', order: 1 };
  workstreams.push(secondWs);
  const it = addJourney('Onboarding');
  const devCat = categories.find(c => c.name === 'Development');
  openJourneyDecomposeModal(it.id);
  editingDecomposeItems[0].name = 'Design the intake form';
  editingDecomposeItems[0].workstreamId = workstreams[0].id;
  editingDecomposeItems[0].categoryId = devCat.id;
  addJourneyDecomposeRow();
  editingDecomposeItems[1].name = 'Build the API';
  editingDecomposeItems[1].workstreamId = secondWs.id;
  const before = items.length;
  applyJourneyDecompose();
  assertEqual(items.length, before + 2);
  const created = items.slice(-2);
  created.forEach(ci => {
    assertEqual(ci.itemType, 'scope');
    assertEqual(ci.journeyId, it.id);
  });
  assertEqual(created[0].name, 'Design the intake form');
  assertEqual(created[0].workstreamId, workstreams[0].id);
  assertEqual(created[0].categoryId, devCat.id);
  assertEqual(created[1].workstreamId, secondWs.id);
  assertDeepEqual(created[1].milestones.map(m => m.name), DEFAULT_CATEGORY_MILESTONES);
  assertFalse(document.getElementById('journeyDecomposeModalBg').classList.contains('open'));
});

test('applyJourneyDecompose skips blank rows and refuses to save with nothing to add', function () {
  const it = addJourney();
  openJourneyDecomposeModal(it.id);
  addJourneyDecomposeRow();
  editingDecomposeItems[1].name = '   '; // still blank after trimming
  const before = items.length;
  applyJourneyDecompose();
  assertEqual(items.length, before, 'a modal with only blank rows should add nothing');
  assertTrue(document.getElementById('journeyDecomposeModalBg').classList.contains('open'), 'the modal should stay open so the user can actually type something');
});

test('closeJourneyDecomposeModal ("Later") discards the working rows without creating anything', function () {
  const it = addJourney();
  openJourneyDecomposeModal(it.id);
  editingDecomposeItems[0].name = 'Abandoned row';
  const before = items.length;
  closeJourneyDecomposeModal();
  assertEqual(items.length, before);
  assertEqual(journeyDecomposeItemId, null);
  assertEqual(editingDecomposeItems.length, 0);
});

test('applyJourneyDecompose is blocked below Editor', function () {
  const it = addJourney();
  userRole = 'reviewer';
  openJourneyDecomposeModal(it.id); // returns immediately, requireRole guarded
  assertFalse(document.getElementById('journeyDecomposeModalBg').classList.contains('open'));
});

// ---------- The "From Journey" backlink in the item modal ----------

test('openItemModal shows a read-only "From Journey" line for a scope item created via decompose', function () {
  const journey = addJourney('Payments Revamp');
  openJourneyDecomposeModal(journey.id);
  editingDecomposeItems[0].name = 'Integrate gateway';
  applyJourneyDecompose();
  const created = items[items.length - 1];
  openItemModal(created.id);
  assertEqual(document.getElementById('itemJourneyLinkField').style.display, '');
  assertEqual(document.getElementById('itemJourneyLinkBadge').textContent, 'Payments Revamp');
});

test('openItemModal hides the "From Journey" line for an ordinary scope item', function () {
  const it = addItem({ name: 'No journey here' });
  openItemModal(it.id);
  assertEqual(document.getElementById('itemJourneyLinkField').style.display, 'none');
});

// ---------- normalizeData backfill ----------

test('normalizeData backfills a missing itemType to "scope"', function () {
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'Legacy', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].itemType, 'scope');
});

test('normalizeData resets an unrecognized itemType value back to "scope"', function () {
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, itemType: 'bogus', name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].itemType, 'scope');
});

test('normalizeData backfills a missing journeyId to null', function () {
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].journeyId, null);
});

test('normalizeData clears a journeyId that points at a deleted/non-existent item', function () {
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, journeyId: 'does-not-exist', name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].journeyId, null);
});

test('normalizeData clears a journeyId pointing at an item that exists but is no longer itemType:"journey"', function () {
  const notAJourney = addItem({ name: 'Now just a scope item' });
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, journeyId: notAJourney.id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[1].journeyId, null);
});

test('normalizeData preserves a journeyId that legitimately points at an existing Journey', function () {
  const journey = addJourney();
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, journeyId: journey.id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[items.length - 1].journeyId, journey.id);
});

test('normalizeData never resets a Journey\'s own workstreamId to anything other than null (it has none to reassign)', function () {
  const it = addJourney();
  normalizeData();
  assertEqual(it.workstreamId, null);
});

// ---------- unassignedItemsSorted excludes Journeys ----------

test('unassignedItemsSorted never includes a Journey, even though both share workstreamId:null', function () {
  addJourney('Should not appear here');
  items.push({ id: genId(), workstreamId: null, categoryId: categories.find(c => c.pending).id, itemType: 'scope', name: 'Genuinely unassigned', dueDate: todayStr(), startDate: todayStr(), milestones: [], order: 0 });
  const names = unassignedItemsSorted().map(it => it.name);
  assertDeepEqual(names, ['Genuinely unassigned']);
});

// ---------- Journeys mode ----------

test('setMode("journeys") is a valid mode, renders the sidebar-less journeysBody, and hides scopedBody/adminBody', function () {
  setMode('journeys');
  assertEqual(mode, 'journeys');
  assertEqual(document.getElementById('scopedBody').style.display, 'none', 'Journeys is not workstream-scoped, so the shared sidebar shell is hidden, same treatment as Admin');
  assertEqual(document.getElementById('adminBody').style.display, 'none');
  assertEqual(document.getElementById('journeysBody').style.display, '');
});

test('allJourneys returns only itemType:"journey" items, sorted by order, regardless of any workstream', function () {
  addItem({ name: 'Scope item, not a journey' });
  const j1 = addJourney('First Journey');
  const j2 = addJourney('Second Journey');
  const names = allJourneys().map(j => j.name);
  assertDeepEqual(names, ['First Journey', 'Second Journey']);
});

test('renderJourneys lists every journey in one flat list with a single Add-Journey button, and excludes scope items', function () {
  addItem({ name: 'A plain scope item' });
  addJourney('The Journey');
  setMode('journeys');
  const html = document.getElementById('journeysBody').innerHTML;
  assertIncludes(html, 'The Journey');
  assertNotIncludes(html, 'A plain scope item');
  assertIncludes(html, `onclick="openItemModal(null,null,'journey')"`);
});

test('renderJourneys shows "No journeys yet" when there are none', function () {
  setMode('journeys');
  const html = document.getElementById('journeysBody').innerHTML;
  assertIncludes(html, 'No journeys yet.');
});

test('renderJourneys omits the Add-Journey button below Editor', function () {
  addJourney('Existing Journey');
  userRole = 'reviewer';
  setMode('journeys');
  const html = document.getElementById('journeysBody').innerHTML;
  assertIncludes(html, 'Existing Journey');
  assertNotIncludes(html, 'Add Journey');
});

test('renderJourneys ignores the shared filterWorkstreamId selector entirely — it always shows every journey', function () {
  const secondWs = { id: genId(), name: 'Second', color: 'teal', order: 1 };
  workstreams.push(secondWs);
  addJourney('Journey A');
  addJourney('Journey B');
  setFilterWorkstream(secondWs.id);
  setMode('journeys');
  const html = document.getElementById('journeysBody').innerHTML;
  assertIncludes(html, 'Journey A');
  assertIncludes(html, 'Journey B');
});

test('renderJourneys works even with zero workstreams (a Journey needs none to exist)', function () {
  workstreams = []; items = [];
  addJourney('Standalone Journey');
  setMode('journeys');
  const html = document.getElementById('journeysBody').innerHTML;
  assertIncludes(html, 'Standalone Journey');
});

// ---------- Reserved-category protections (deletion, pickers) already
// covered in categories.test.js/pending.test.js — see:
//  - "deleteCategoryFromModal refuses to delete the reserved Journey category..."
//  - "deleteCategoryFromModal refuses to delete the last remaining non-Pending, non-Journey category"
//  - "openScopeAssignModal ... offers every category except Pending and Journey"
