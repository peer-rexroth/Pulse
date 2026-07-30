// ---------- Journeys ----------
// A Journey is not a separate top-level data shape — it's a plain item (see
// "Data model" in CLAUDE.md) with itemType:'journey'. It has no category, no
// workstream, and no milestone checklist at all — an explicit user
// simplification ("do not add milestones to it... you can remove the
// Journey category completely"), removing what an earlier version of this
// feature had (a reserved category with a fixed 4-milestone template). A
// Journey is never assigned to a workstream (workstreamId is always null —
// it's overarching). Instead of decomposing into new scope items, a Journey
// *connects* to existing ones (item.journeyId, set/cleared via
// toggleJourneyConnection() in the "Connect scope items" modal) — and its
// own "end date" is computed live, at render time, from the latest
// milestone (due or actual) date across every connected item
// (computeJourneyDateRange()), never persisted or manually editable.

function addJourney(name) {
  openItemModal(null, null, 'journey');
  document.getElementById('itemNameInput').value = name || 'New Journey';
  saveItem();
  return items[items.length - 1];
}

// ---------- Creating a Journey ----------

test('openItemModal(null, null, "journey") seeds a new Journey with no milestones, no workstream field, and no category field', function () {
  openItemModal(null, null, 'journey');
  assertEqual(document.getElementById('itemModalTitle').textContent, 'New Journey');
  assertEqual(editingItemType, 'journey');
  assertDeepEqual(editingMilestones, []);
  assertEqual(document.getElementById('itemWorkstreamField').style.display, 'none', 'a Journey is never assigned to a workstream, so the field is hidden outright');
  assertEqual(document.getElementById('itemCategoryField').style.display, 'none', 'a Journey has no category at all, so the whole field is hidden');
  assertEqual(document.getElementById('itemMilestonesField').style.display, 'none', 'a Journey has no milestone checklist, so the whole field is hidden');
});

test('saveItem creates a new Journey with itemType, no category, no workstream, and zero milestones', function () {
  const it = addJourney('Customer Onboarding');
  assertEqual(it.itemType, 'journey');
  assertEqual(it.categoryId, null, 'a Journey has no category at all');
  assertEqual(it.workstreamId, null, 'a Journey is overarching — never assigned to a workstream');
  assertEqual(it.journeyId, null);
  assertDeepEqual(it.milestones, []);
});

test('a plain new item never picks up itemType:"journey" and still shows the Workstream/Category/Milestones fields', function () {
  openItemModal(null, workstreams[0].id);
  assertEqual(editingItemType, 'scope');
  assertFalse(document.getElementById('itemWorkstreamField').style.display === 'none');
  assertFalse(document.getElementById('itemCategoryField').style.display === 'none');
  assertFalse(document.getElementById('itemMilestonesField').style.display === 'none');
  document.getElementById('itemNameInput').value = 'Ordinary item';
  document.getElementById('itemWorkstreamSelect').value = workstreams[0].id;
  document.getElementById('itemCategorySelect').value = categories[0].id;
  saveItem();
  const it = items[items.length - 1];
  assertEqual(it.itemType, 'scope');
  assertEqual(it.workstreamId, workstreams[0].id);
  assertTrue(!!it.categoryId, 'a plain scope item still needs a real category');
});

test('editing an existing Journey keeps its title, hidden workstream/category/milestones fields, and itemType', function () {
  const it = addJourney('Vendor Integration');
  openItemModal(it.id);
  assertEqual(document.getElementById('itemModalTitle').textContent, 'Edit Journey');
  assertEqual(editingItemType, 'journey');
  assertEqual(document.getElementById('itemWorkstreamField').style.display, 'none');
  assertEqual(document.getElementById('itemCategoryField').style.display, 'none');
  assertEqual(document.getElementById('itemMilestonesField').style.display, 'none');
  document.getElementById('itemNameInput').value = 'Vendor Integration (renamed)';
  saveItem();
  assertEqual(it.name, 'Vendor Integration (renamed)');
  assertEqual(it.itemType, 'journey', 'itemType must never change via a plain re-save');
  assertEqual(it.categoryId, null);
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

// ---------- Journey quick-add (mirrors the Unassigned section's own
// inline "+ Add item", see pending.test.js) ----------

test('openJourneyQuickAdd/saveJourneyQuickAddItem creates a Journey with no workstream, no category, and zero milestones', function () {
  openJourneyQuickAdd();
  document.getElementById('journeyQuickAddInput').value = 'Onboarding Journey';
  saveJourneyQuickAddItem();
  assertEqual(items.length, 1);
  const it = items[0];
  assertEqual(it.name, 'Onboarding Journey');
  assertEqual(it.itemType, 'journey');
  assertEqual(it.workstreamId, null);
  assertEqual(it.categoryId, null);
  assertDeepEqual(it.milestones, []);
  assertEqual(it.status, 'not-started');
  assertFalse(journeyQuickAddOpen, 'the input should have closed back to the button after saving');
});

test('saveJourneyQuickAddItem closes the input without creating anything when the name is blank', function () {
  openJourneyQuickAdd();
  document.getElementById('journeyQuickAddInput').value = '   ';
  saveJourneyQuickAddItem();
  assertEqual(items.length, 0);
  assertFalse(journeyQuickAddOpen);
});

test('cancelJourneyQuickAdd (Escape) discards whatever was typed, closing the input', function () {
  openJourneyQuickAdd();
  document.getElementById('journeyQuickAddInput').value = 'Abandoned draft';
  cancelJourneyQuickAdd();
  assertEqual(items.length, 0);
  assertFalse(journeyQuickAddOpen);
});

test('saveJourneyQuickAddItem is a no-op if called again after it already closed things (Enter followed by the resulting blur)', function () {
  openJourneyQuickAdd();
  document.getElementById('journeyQuickAddInput').value = 'Typed once';
  saveJourneyQuickAddItem(); // e.g. Enter
  assertEqual(items.length, 1);
  saveJourneyQuickAddItem(); // e.g. the blur that same render() triggers by tearing out the focused input
  assertEqual(items.length, 1, 'a second call after the input already closed must not create a duplicate');
});

test('openJourneyQuickAdd is blocked below Editor', function () {
  userRole = 'reviewer';
  openJourneyQuickAdd();
  assertFalse(journeyQuickAddOpen);
});

test('renderJourneys shows the button by default, and swaps in the input once opened', function () {
  let html = document.getElementById('main').innerHTML;
  setMode('journeys');
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onclick="openJourneyQuickAdd()"`);
  assertNotIncludes(html, 'id="journeyQuickAddInput"');

  openJourneyQuickAdd();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'id="journeyQuickAddInput"');
});

test('renderJourneys omits the Add-Journey button (and the quick-add input) below Editor', function () {
  addJourney('Existing Journey');
  userRole = 'reviewer';
  setMode('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Existing Journey');
  assertNotIncludes(html, 'openJourneyQuickAdd');
  assertNotIncludes(html, 'id="journeyQuickAddInput"');
});

// ---------- Row badge ----------

test('itemRowHtml shows a Journey badge icon in the name cell for a Journey, not for a scope item', function () {
  const journey = addJourney('Onboarding Journey');
  const scope = addItem({ name: 'Ordinary scope item' });
  assertIncludes(itemRowHtml(journey), 'journey-type-badge');
  assertNotIncludes(itemRowHtml(scope), 'journey-type-badge');
});

test('itemRowHtml shows a "Connect scope items" icon for a Journey, not for a scope item', function () {
  const journey = addJourney();
  const scope = addItem({ name: 'Ordinary scope item' });
  assertIncludes(itemRowHtml(journey), `onclick="openJourneyConnectModal('${journey.id}')"`);
  assertNotIncludes(itemRowHtml(scope), 'openJourneyConnectModal');
});

test('the Connect-scope-items icon is omitted below Editor, same as Edit/Delete', function () {
  const journey = addJourney();
  userRole = 'reviewer';
  assertNotIncludes(itemRowHtml(journey), 'openJourneyConnectModal');
});

// ---------- Unfolding a Journey's connected scope items ----------

test('a Journey\'s chevron is clickable even with zero connected scope items', function () {
  const journey = addJourney();
  assertIncludes(itemRowHtml(journey), `onclick="toggleItemExpanded('${journey.id}')"`);
});

test('expanding a Journey with no connections shows the "No scope items connected yet" placeholder', function () {
  const journey = addJourney();
  toggleItemExpanded(journey.id);
  const html = itemRowHtml(journey);
  assertIncludes(html, 'No scope items connected yet.');
});

test('expanding a Journey lists each connected scope item as a real, viewOnly item row', function () {
  const journey = addJourney();
  const it = addItem({ name: 'Design the intake form', status: 'amber' });
  it.journeyId = journey.id;
  toggleItemExpanded(journey.id);
  const html = itemRowHtml(journey);
  assertIncludes(html, 'Design the intake form');
  assertIncludes(html, `onclick="openItemModal('${it.id}')"`, 'the status badge still opens the item\'s own modal — that\'s viewing, not editing');
  assertIncludes(html, 'At Risk'); // statusLabel('amber')
});

test('a connected item\'s own row renders viewOnly — no drag handle, Edit, or Delete', function () {
  const journey = addJourney();
  const it = addItem({ name: 'Design the intake form' });
  it.journeyId = journey.id;
  toggleItemExpanded(journey.id);
  const html = itemRowHtml(journey);
  assertNotIncludes(html, `dragStartItem(event,'${it.id}')`);
  assertNotIncludes(html, `onclick="openItemModal('${it.id}')" title="Edit"`);
  assertNotIncludes(html, `deleteItem('${it.id}')`);
});

test('a connected item\'s own IT/Business/Budget tags render as inert spans, not clickable, when viewOnly', function () {
  const journey = addJourney();
  const it = addItem({ name: 'Design the intake form' });
  it.journeyId = journey.id;
  toggleItemExpanded(journey.id);
  assertNotIncludes(itemRowHtml(journey), `cycleItemAttr('${it.id}'`);
});

test('a connected item with its own milestones can still be expanded to view them, read-only, with no "MS Req." column', function () {
  const journey = addJourney();
  const it = addItem({
    name: 'Design the intake form',
    milestones: [{ id: 'm1', name: 'Draft ready', dueDate: todayStr(), status: 'not-started', actualDate: null, notApplicable: false }]
  });
  it.journeyId = journey.id;
  toggleItemExpanded(journey.id);
  expandedItemIds.add(it.id); // peek at the connected item's own milestones too
  const html = itemRowHtml(journey);
  assertIncludes(html, 'Draft ready');
  assertNotIncludes(html, 'MS Req.');
  assertNotIncludes(html, `toggleMilestoneNotApplicable('${it.id}'`, 'the Not Applicable toggle itself must be gone too, not just its label');
  assertNotIncludes(html, `cycleMilestoneStatus('${it.id}'`, 'the milestone status badge must be read-only too');
});

test('a collapsed Journey never shows its connected items, even with some connected', function () {
  const journey = addJourney();
  const it = addItem({ name: 'Hidden while collapsed' });
  it.journeyId = journey.id;
  assertFalse(expandedItemIds.has(journey.id));
  assertNotIncludes(itemRowHtml(journey), 'Hidden while collapsed');
});

test('the milestone-count-badge shows a connected scope item count for an expanded-or-not Journey', function () {
  const journey = addJourney();
  const it = addItem({ name: 'One connection' });
  it.journeyId = journey.id;
  assertIncludes(itemRowHtml(journey), '1 scope item<');
  const it2 = addItem({ name: 'Two connections' });
  it2.journeyId = journey.id;
  assertIncludes(itemRowHtml(journey), '2 scope items<');
});

test('a scope item never gets the connected-items expand treatment, even if it somehow has a journeyId', function () {
  const it = addItem({ name: 'Just a scope item' });
  toggleItemExpanded(it.id);
  assertNotIncludes(itemRowHtml(it), 'No scope items connected yet');
});

// ---------- computeJourneyDateRange / connectedScopeItems ----------

test('connectedScopeItems returns only items whose journeyId matches, sorted by order', function () {
  const journey = addJourney();
  const other = addJourney('Other journey');
  const a = addItem({ name: 'A', journeyId: journey.id, order: 1 });
  const b = addItem({ name: 'B', journeyId: journey.id, order: 0 });
  addItem({ name: 'Unconnected' });
  addItem({ name: 'Connected elsewhere', journeyId: other.id });
  assertDeepEqual(connectedScopeItems(journey.id).map(it => it.name), ['B', 'A']);
});

test('computeJourneyDateRange returns null when nothing is connected', function () {
  const journey = addJourney();
  assertEqual(computeJourneyDateRange(journey.id), null);
});

test('computeJourneyDateRange spans the earliest/latest due-or-actual date across every connected item\'s milestones', function () {
  const journey = addJourney();
  addItem({
    name: 'Item A', journeyId: journey.id,
    milestones: [
      { id: 'm1', name: 'X', dueDate: '2026-03-01', status: 'not-started', actualDate: null, notApplicable: false },
      { id: 'm2', name: 'Y', dueDate: '2026-05-01', status: 'not-started', actualDate: '2026-06-15', notApplicable: false }
    ]
  });
  addItem({
    name: 'Item B', journeyId: journey.id,
    milestones: [{ id: 'm3', name: 'Z', dueDate: '2026-01-10', status: 'not-started', actualDate: null, notApplicable: false }]
  });
  const range = computeJourneyDateRange(journey.id);
  assertEqual(range.startDate, '2026-01-10');
  assertEqual(range.dueDate, '2026-06-15');
});

test('computeJourneyDateRange excludes a notApplicable milestone\'s dates', function () {
  const journey = addJourney();
  addItem({
    name: 'Item A', journeyId: journey.id,
    milestones: [
      { id: 'm1', name: 'Skip', dueDate: '2026-01-01', status: 'not-started', actualDate: null, notApplicable: true },
      { id: 'm2', name: 'Keep', dueDate: '2026-04-01', status: 'not-started', actualDate: null, notApplicable: false }
    ]
  });
  const range = computeJourneyDateRange(journey.id);
  assertEqual(range.startDate, '2026-04-01');
  assertEqual(range.dueDate, '2026-04-01');
});

test('computeJourneyDateRange falls back to a connected item\'s own start/due dates when it has no milestones', function () {
  const journey = addJourney();
  addItem({ name: 'No milestones', journeyId: journey.id, milestones: [], startDate: '2026-02-01', dueDate: '2026-02-20' });
  const range = computeJourneyDateRange(journey.id);
  assertEqual(range.startDate, '2026-02-01');
  assertEqual(range.dueDate, '2026-02-20');
});

test('itemRowHtml shows the computed range for a Journey, and a placeholder when nothing is connected', function () {
  const journey = addJourney();
  assertIncludes(itemRowHtml(journey), '—');
  addItem({ name: 'Connected', journeyId: journey.id, startDate: '2026-07-01', dueDate: '2026-07-15' });
  const html = itemRowHtml(journey);
  assertIncludes(html, fmtDateY('2026-07-01'));
  assertIncludes(html, fmtDateY('2026-07-15'));
});

test('the item modal shows a computed Plan-dates badge for an existing Journey, sourced from connected items', function () {
  const journey = addJourney();
  addItem({ name: 'Connected', journeyId: journey.id, startDate: '2026-08-01', dueDate: '2026-08-10' });
  openItemModal(journey.id);
  assertEqual(document.getElementById('itemDatesManual').style.display, 'none');
  assertEqual(document.getElementById('itemDatesComputed').style.display, '');
  assertIncludes(document.getElementById('itemDatesComputedBadge').textContent, fmtDateY('2026-08-01'));
});

test('the item modal shows "No connected scope items yet" for a brand-new Journey (no id to look up connections by)', function () {
  openItemModal(null, null, 'journey');
  assertEqual(document.getElementById('itemDatesComputedBadge').textContent, 'No connected scope items yet');
});

test('the item modal still shows a manual Status select for a Journey (no milestones to compute it from)', function () {
  const journey = addJourney();
  openItemModal(journey.id);
  assertEqual(document.getElementById('itemStatusSelect').style.display, '');
  assertEqual(document.getElementById('itemStatusComputed').style.display, 'none');
});

// ---------- The connect modal ----------

test('openJourneyConnectModal sets the title and populates the list, grouped by workstream', function () {
  const secondWs = { id: genId(), name: 'Second', color: 'teal', order: 1 };
  workstreams.push(secondWs);
  const journey = addJourney('Supplier Onboarding');
  addItem({ name: 'In first ws' });
  addItem({ name: 'In second ws', workstreamId: secondWs.id });
  openJourneyConnectModal(journey.id);
  assertEqual(document.getElementById('journeyConnectModalTitle').textContent, 'Connect scope items to "Supplier Onboarding"');
  const html = document.getElementById('journeyConnectList').innerHTML;
  assertIncludes(html, workstreams[0].name);
  assertIncludes(html, 'Second');
  assertIncludes(html, 'In first ws');
  assertIncludes(html, 'In second ws');
});

test('renderJourneyConnectList groups an Unassigned scope item under its own "Unassigned" heading', function () {
  const journey = addJourney();
  items.push({ id: genId(), workstreamId: null, categoryId: categories.find(c => c.pending).id, itemType: 'scope', name: 'Needs triage', dueDate: todayStr(), startDate: todayStr(), milestones: [], order: 0 });
  openJourneyConnectModal(journey.id);
  const html = document.getElementById('journeyConnectList').innerHTML;
  assertIncludes(html, 'Unassigned');
  assertIncludes(html, 'Needs triage');
});

test('renderJourneyConnectList checks a scope item already connected to this Journey', function () {
  const journey = addJourney();
  const connected = addItem({ name: 'Already connected', journeyId: journey.id });
  openJourneyConnectModal(journey.id);
  const html = document.getElementById('journeyConnectList').innerHTML;
  assertIncludes(html, `checked onchange="toggleJourneyConnection('${connected.id}', this.checked)"`);
});

test('renderJourneyConnectList excludes a scope item already connected to a *different* Journey', function () {
  const journey = addJourney('This journey');
  const other = addJourney('Other journey');
  addItem({ name: 'Taken', journeyId: other.id });
  openJourneyConnectModal(journey.id);
  assertNotIncludes(document.getElementById('journeyConnectList').innerHTML, 'Taken');
});

test('renderJourneyConnectList shows a placeholder when there are no available scope items', function () {
  const journey = addJourney();
  openJourneyConnectModal(journey.id);
  assertIncludes(document.getElementById('journeyConnectList').innerHTML, 'No available scope items yet.');
});

test('toggleJourneyConnection sets and clears journeyId directly', function () {
  const journey = addJourney();
  const it = addItem({ name: 'Target' });
  openJourneyConnectModal(journey.id);
  toggleJourneyConnection(it.id, true);
  assertEqual(it.journeyId, journey.id);
  toggleJourneyConnection(it.id, false);
  assertEqual(it.journeyId, null);
});

test('toggleJourneyConnection re-renders the still-open modal list to reflect the new state', function () {
  const journey = addJourney();
  const it = addItem({ name: 'Target item' });
  openJourneyConnectModal(journey.id);
  toggleJourneyConnection(it.id, true);
  assertIncludes(document.getElementById('journeyConnectList').innerHTML, `checked onchange="toggleJourneyConnection('${it.id}', this.checked)"`);
});

test('toggleJourneyConnection is blocked below Editor', function () {
  const journey = addJourney();
  const it = addItem({ name: 'Target' });
  userRole = 'reviewer';
  toggleJourneyConnection(it.id, true);
  assertEqual(it.journeyId, null);
});

test('openJourneyConnectModal is blocked below Editor', function () {
  const journey = addJourney();
  userRole = 'reviewer';
  openJourneyConnectModal(journey.id);
  assertFalse(document.getElementById('journeyConnectModalBg').classList.contains('open'));
});

test('closeJourneyConnectModal clears journeyConnectItemId', function () {
  const journey = addJourney();
  openJourneyConnectModal(journey.id);
  closeJourneyConnectModal();
  assertEqual(journeyConnectItemId, null);
  assertFalse(document.getElementById('journeyConnectModalBg').classList.contains('open'));
});

// ---------- The "From Journey" backlink in the item modal ----------

test('openItemModal shows a read-only "From Journey" line for a scope item connected to one', function () {
  const journey = addJourney('Payments Revamp');
  const it = addItem({ name: 'Integrate gateway' });
  openJourneyConnectModal(journey.id); // toggleJourneyConnection() requires the modal's own journeyConnectItemId to be set first
  toggleJourneyConnection(it.id, true);
  openItemModal(it.id);
  assertEqual(document.getElementById('itemJourneyLinkField').style.display, '');
  assertEqual(document.getElementById('itemJourneyLinkBadge').textContent, 'Payments Revamp');
});

test('openItemModal hides the "From Journey" line for an ordinary, unconnected scope item', function () {
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

test('setMode("journeys") is a valid mode, renders into the shared scopedBody/main shell (sidebar visible), and hides adminBody', function () {
  setMode('journeys');
  assertEqual(mode, 'journeys');
  assertEqual(document.getElementById('scopedBody').style.display, '', 'Journeys now shares the sidebar shell — moved there so its own nav entry could live in the sidebar');
  assertEqual(document.getElementById('adminBody').style.display, 'none');
});

test('renderSidebar renders a Journeys nav row in its own section, separate from the workstream list, showing the current Journey count and highlighted only in Journeys mode', function () {
  addJourney('First Journey');
  addJourney('Second Journey');
  setMode('planning');
  let html = document.getElementById('journeysNav').innerHTML;
  assertIncludes(html, 'Journeys');
  assertIncludes(html, '>2<', 'the count badge should show allJourneys().length');
  assertNotIncludes(html, 'ws-row active', 'not active while on Planning');

  setMode('journeys');
  html = document.getElementById('journeysNav').innerHTML;
  assertIncludes(html, 'ws-row active', 'active once Journeys mode is showing');
});

test('allJourneys returns only itemType:"journey" items, sorted by order, regardless of any workstream', function () {
  addItem({ name: 'Scope item, not a journey' });
  addJourney('First Journey');
  addJourney('Second Journey');
  const names = allJourneys().map(j => j.name);
  assertDeepEqual(names, ['First Journey', 'Second Journey']);
});

test('renderJourneys lists every journey in one flat list with a single Add-Journey button (inline quick-add, not the modal), and excludes scope items', function () {
  addItem({ name: 'A plain scope item' });
  addJourney('The Journey');
  setMode('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'The Journey');
  assertNotIncludes(html, 'A plain scope item');
  assertIncludes(html, `onclick="openJourneyQuickAdd()"`);
});

test('renderJourneys shows "No journeys yet" when there are none', function () {
  setMode('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'No journeys yet.');
});

test('renderJourneys omits the Add-Journey button below Editor', function () {
  addJourney('Existing Journey');
  userRole = 'reviewer';
  setMode('journeys');
  const html = document.getElementById('main').innerHTML;
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
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Journey A');
  assertIncludes(html, 'Journey B');
});

test('renderJourneys works even with zero workstreams (a Journey needs none to exist)', function () {
  workstreams = []; items = [];
  addJourney('Standalone Journey');
  setMode('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Standalone Journey');
});

// ---------- Reserved-category protections (deletion, pickers) already
// covered in categories.test.js/pending.test.js — see:
//  - "deleteCategoryFromModal refuses to delete the reserved Journey category..."
//  - "deleteCategoryFromModal refuses to delete the last remaining non-Pending, non-Journey category"
//  - "openScopeAssignModal ... offers every category except Pending and Journey"
