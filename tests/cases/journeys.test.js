// ---------- Journeys ----------
// A Journey has two levels — Journey and Sub Journey — an explicit user
// request ("Journey consists of 2 levels. Journey and sub journey. Scope
// items can only be attached to subjourneys"). Neither is a separate
// top-level data shape — both are plain items (see "Data model" in
// CLAUDE.md), itemType:'journey' or itemType:'subjourney'. Neither has a
// category, a workstream, or a milestone checklist at all — an explicit
// user simplification carried over from the original single-level design.
// A scope item only ever connects to a Sub Journey (item.journeyId), never
// directly to a top-level Journey; a Sub Journey in turn links up to
// exactly one Journey (item.parentJourneyId, set once at creation). Both
// levels' own "end date" and status are computed live, at render time, from
// whatever's connected beneath them — a Sub Journey from its connected
// scope items directly (computeSubJourneyDateRange()/
// computeSubJourneyStatus()), a Journey one level further removed, from its
// connected Sub Journeys' own already-computed values
// (computeJourneyDateRange()/computeJourneyStatus()).

function addJourney(name) {
  openItemModal(null, null, 'journey');
  document.getElementById('itemNameInput').value = name || 'New Journey';
  saveItem();
  return items[items.length - 1];
}

function addSubJourney(journeyId, name) {
  openSubJourneyQuickAdd(journeyId);
  document.getElementById('subJourneyQuickAddInput').value = name || 'New Sub Journey';
  saveSubJourneyQuickAddItem();
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

test('saveItem creates a new Journey with itemType, no category, no workstream, no parentJourneyId, and zero milestones', function () {
  const it = addJourney('Customer Onboarding');
  assertEqual(it.itemType, 'journey');
  assertEqual(it.categoryId, null, 'a Journey has no category at all');
  assertEqual(it.workstreamId, null, 'a Journey is overarching — never assigned to a workstream');
  assertEqual(it.journeyId, null);
  assertEqual(it.parentJourneyId, null, 'a top-level Journey has nothing above it to link to');
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

test('editing an existing Sub Journey shows "Edit Sub Journey" as the title and keeps the same field hiding as a Journey', function () {
  const journey = addJourney('Parent Journey');
  const sub = addSubJourney(journey.id, 'Intake');
  openItemModal(sub.id);
  assertEqual(document.getElementById('itemModalTitle').textContent, 'Edit Sub Journey');
  assertEqual(editingItemType, 'subjourney');
  assertEqual(document.getElementById('itemWorkstreamField').style.display, 'none');
  assertEqual(document.getElementById('itemCategoryField').style.display, 'none');
  assertEqual(document.getElementById('itemMilestonesField').style.display, 'none');
  document.getElementById('itemNameInput').value = 'Intake (renamed)';
  saveItem();
  assertEqual(sub.name, 'Intake (renamed)');
  assertEqual(sub.itemType, 'subjourney', 'itemType must never change via a plain re-save');
  assertEqual(sub.parentJourneyId, journey.id, 'a Sub Journey\'s link to its parent Journey must never change via a plain re-save either');
});

test('closeItemModal resets editingItemType back to "scope"', function () {
  openItemModal(null, null, 'journey');
  closeItemModal();
  assertEqual(editingItemType, 'scope');
});

// Journey/Sub Journey management is gated on canManageJourneys() (Planner
// or Editor+), not the plain hasRole('editor') an ordinary item uses — see
// "Roles (RBAC)" in CLAUDE.md for the Planner role and why it's a
// deliberate exception to the plain ROLES ladder (Reviewer outranks
// Planner there, yet is still excluded from Journey management). The tests
// below still say "blocked for Reviewer" specifically, since Reviewer is
// the one role this session's Planner change actually reasoned through —
// see the dedicated "Planner: Journey/Sub Journey management" section
// further down for the positive Planner-can-do-this coverage and the
// explicit Reviewer-stays-blocked-despite-outranking-Planner regression
// guard.
test('creating a Journey is blocked for Reviewer', function () {
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

test('openJourneyQuickAdd is blocked for Reviewer', function () {
  userRole = 'reviewer';
  openJourneyQuickAdd();
  assertFalse(journeyQuickAddOpen);
});

test('renderJourneys shows the button by default, and swaps in the input once opened', function () {
  let html = document.getElementById('main').innerHTML;
  setPlanningTab('journeys');
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, `onclick="openJourneyQuickAdd()"`);
  assertNotIncludes(html, 'id="journeyQuickAddInput"');

  openJourneyQuickAdd();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'id="journeyQuickAddInput"');
});

test('renderJourneys omits the Add-Journey button (and the quick-add input) for Reviewer', function () {
  addJourney('Existing Journey');
  userRole = 'reviewer';
  setPlanningTab('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Existing Journey');
  assertNotIncludes(html, 'openJourneyQuickAdd');
  assertNotIncludes(html, 'id="journeyQuickAddInput"');
});

// ---------- Sub Journey quick-add ----------
// A Sub Journey's own counterpart — the only way one is ever created (there
// is no "+ Add Sub Journey" path through the full item modal, mirroring how
// a brand-new scope item/Journey never has one either). Scoped per-parent
// via subJourneyQuickAddOpenFor rather than a plain boolean.

test('openSubJourneyQuickAdd/saveSubJourneyQuickAddItem creates a Sub Journey linked to its parent, with no workstream, no category, and zero milestones', function () {
  const journey = addJourney('Parent Journey');
  openSubJourneyQuickAdd(journey.id);
  assertEqual(subJourneyQuickAddOpenFor, journey.id);
  document.getElementById('subJourneyQuickAddInput').value = 'Intake';
  saveSubJourneyQuickAddItem();
  const sub = items[items.length - 1];
  assertEqual(sub.name, 'Intake');
  assertEqual(sub.itemType, 'subjourney');
  assertEqual(sub.parentJourneyId, journey.id);
  assertEqual(sub.workstreamId, null);
  assertEqual(sub.categoryId, null);
  assertEqual(sub.journeyId, null, 'a Sub Journey itself never has a journeyId — that\'s only ever set on a connected scope item');
  assertDeepEqual(sub.milestones, []);
  assertFalse(!!subJourneyQuickAddOpenFor, 'the input should have closed back to the button after saving');
});

test('saveSubJourneyQuickAddItem closes the input without creating anything when the name is blank', function () {
  const journey = addJourney('Parent Journey');
  openSubJourneyQuickAdd(journey.id);
  document.getElementById('subJourneyQuickAddInput').value = '   ';
  saveSubJourneyQuickAddItem();
  assertEqual(items.length, 1, 'only the parent Journey itself should exist');
  assertFalse(!!subJourneyQuickAddOpenFor);
});

test('cancelSubJourneyQuickAdd discards whatever was typed, closing the input', function () {
  const journey = addJourney('Parent Journey');
  openSubJourneyQuickAdd(journey.id);
  document.getElementById('subJourneyQuickAddInput').value = 'Abandoned draft';
  cancelSubJourneyQuickAdd();
  assertEqual(items.length, 1);
  assertFalse(!!subJourneyQuickAddOpenFor);
});

test('openSubJourneyQuickAdd is blocked for Reviewer', function () {
  const journey = addJourney('Parent Journey');
  userRole = 'reviewer';
  openSubJourneyQuickAdd(journey.id);
  assertFalse(!!subJourneyQuickAddOpenFor);
});

// ---------- Row badges ----------
// An explicit user request ("remove the icons for Journey and SubJourney in
// list view. maintain the one journey icon in the headline") removed the
// per-row .journey-type-badge icon entirely — a Journey/Sub Journey row now
// renders its name exactly like an ordinary scope item's, distinguished
// only by indentation/position in the list. renderJourneys()'s own
// .ws-section-header keeps its single fa-route icon next to the page's
// "Journeys" title — see the "single headline icon, not per-row" test in
// views.test.js-style page-header coverage.

test('itemRowHtml no longer shows a per-row journey-type-badge icon for a Journey, a Sub Journey, or a scope item', function () {
  const journey = addJourney('Onboarding Journey');
  const sub = addSubJourney(journey.id, 'Intake');
  const scope = addItem({ name: 'Ordinary scope item' });
  assertNotIncludes(itemRowHtml(journey), 'journey-type-badge');
  assertNotIncludes(itemRowHtml(sub), 'journey-type-badge');
  assertNotIncludes(itemRowHtml(scope), 'journey-type-badge');
});

test('itemRowHtml shows a "Connect scope items" icon for a Sub Journey, but not for a top-level Journey or a scope item', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const scope = addItem({ name: 'Ordinary scope item' });
  assertIncludes(itemRowHtml(sub), `onclick="openJourneyConnectModal('${sub.id}')"`);
  assertNotIncludes(itemRowHtml(journey), 'openJourneyConnectModal', 'a top-level Journey no longer connects directly to scope items — that\'s what the Sub Journey level is for');
  assertNotIncludes(itemRowHtml(scope), 'openJourneyConnectModal');
});

test('the Connect-scope-items icon is omitted for Reviewer, same as Edit/Delete', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  userRole = 'reviewer';
  assertNotIncludes(itemRowHtml(sub), 'openJourneyConnectModal');
});

// ---------- Unfolding a Journey's connected Sub Journeys ----------

test('a Journey\'s chevron is clickable even with zero connected Sub Journeys', function () {
  const journey = addJourney();
  assertIncludes(itemRowHtml(journey), `onclick="toggleItemExpanded('${journey.id}')"`);
});

test('expanding a Journey with no connections shows the "No Sub Journeys yet" placeholder plus its own Add-Sub-Journey affordance', function () {
  const journey = addJourney();
  toggleItemExpanded(journey.id);
  const html = itemRowHtml(journey);
  assertIncludes(html, 'No Sub Journeys yet.');
  assertIncludes(html, `onclick="openSubJourneyQuickAdd('${journey.id}')"`);
});

test('expanding a Journey lists each connected Sub Journey as a real, fully-interactive item row (not viewOnly)', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id, 'Design phase');
  toggleItemExpanded(journey.id);
  const html = itemRowHtml(journey);
  assertIncludes(html, 'Design phase');
  assertIncludes(html, `dragStartItem(event,'${sub.id}')`, 'a Sub Journey is real and manageable, unlike a Journey\'s own connected scope items — it should keep its drag handle');
  assertIncludes(html, `onclick="openItemModal('${sub.id}')" title="Edit"`);
  assertIncludes(html, `deleteItem('${sub.id}')`);
  assertIncludes(html, `onclick="openJourneyConnectModal('${sub.id}')"`, 'its own Connect icon should be reachable from here too');
});

test('a collapsed Journey never shows its connected Sub Journeys, even with some connected', function () {
  const journey = addJourney();
  addSubJourney(journey.id, 'Hidden while collapsed');
  assertFalse(expandedItemIds.has(journey.id));
  assertNotIncludes(itemRowHtml(journey), 'Hidden while collapsed');
});

test('the milestone-count-badge shows a connected Sub Journey count for an expanded-or-not Journey', function () {
  const journey = addJourney();
  addSubJourney(journey.id, 'One connection');
  assertIncludes(itemRowHtml(journey), '1 sub journey<');
  addSubJourney(journey.id, 'Two connections');
  assertIncludes(itemRowHtml(journey), '2 sub journeys<');
});

// ---------- Unfolding a Sub Journey's connected scope items (mirrors the
// single-level Journey's own original behavior exactly, just one level
// down) ----------

test('a Sub Journey\'s chevron is clickable even with zero connected scope items', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  assertIncludes(itemRowHtml(sub), `onclick="toggleItemExpanded('${sub.id}')"`);
});

test('expanding a Sub Journey with no connections shows the "No scope items connected yet" placeholder', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  toggleItemExpanded(sub.id);
  assertIncludes(itemRowHtml(sub), 'No scope items connected yet.');
});

test('expanding a Sub Journey lists each connected scope item as a real, viewOnly item row', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Design the intake form', status: 'amber' });
  it.journeyId = sub.id;
  toggleItemExpanded(sub.id);
  const html = itemRowHtml(sub);
  assertIncludes(html, 'Design the intake form');
  assertIncludes(html, `onclick="openItemModal('${it.id}')"`, 'the status badge still opens the item\'s own modal — that\'s viewing, not editing');
  assertIncludes(html, 'At Risk'); // statusLabel('amber')
});

test('a connected item\'s own row renders viewOnly — no drag handle, Edit, or Delete', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Design the intake form' });
  it.journeyId = sub.id;
  toggleItemExpanded(sub.id);
  const html = itemRowHtml(sub);
  assertNotIncludes(html, `dragStartItem(event,'${it.id}')`);
  assertNotIncludes(html, `onclick="openItemModal('${it.id}')" title="Edit"`);
  assertNotIncludes(html, `deleteItem('${it.id}')`);
});

test('a connected item\'s own IT/Business/Budget tags render as inert spans, not clickable, when viewOnly', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Design the intake form' });
  it.journeyId = sub.id;
  toggleItemExpanded(sub.id);
  assertNotIncludes(itemRowHtml(sub), `cycleItemAttr('${it.id}'`);
});

test('a connected item with its own milestones can still be expanded to view them, read-only, with no "MS Req." column', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({
    name: 'Design the intake form',
    milestones: [{ id: 'm1', name: 'Draft ready', dueDate: todayStr(), status: 'not-started', actualDate: null, notApplicable: false }]
  });
  it.journeyId = sub.id;
  toggleItemExpanded(sub.id);
  expandedItemIds.add(it.id); // peek at the connected item's own milestones too
  const html = itemRowHtml(sub);
  assertIncludes(html, 'Draft ready');
  assertNotIncludes(html, 'MS Req.');
  assertNotIncludes(html, `toggleMilestoneNotApplicable('${it.id}'`, 'the Not Applicable toggle itself must be gone too, not just its label');
  assertNotIncludes(html, `cycleMilestoneStatus('${it.id}'`, 'the milestone status badge must be read-only too');
});

// ---------- Nesting indent (rows + milestones) ----------
// An explicit user request ("indent the milestones and headers in
// alignment with the Sub journey"): a connected scope item's own row was
// already indented under its Sub Journey (.item-row-indent-2), but an
// expanded one's milestone header/rows rendered flush-left underneath it,
// breaking the nested look.

test('a Sub Journey\'s own row is indented one level (item-row-indent-1)', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  toggleItemExpanded(journey.id);
  assertIncludes(itemRowHtml(journey), `item-row-indent-1`);
});

test('a Sub Journey\'s connected scope item row is indented two levels (item-row-indent-2)', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Design the intake form' });
  it.journeyId = sub.id;
  toggleItemExpanded(sub.id);
  assertIncludes(itemRowHtml(sub), 'item-row-indent-2');
});

test('an expanded connected item\'s milestone header and milestone rows match its own item-row-indent-2', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({
    name: 'Design the intake form',
    milestones: [{ id: 'm1', name: 'Draft ready', dueDate: todayStr(), status: 'not-started', actualDate: null, notApplicable: false }]
  });
  it.journeyId = sub.id;
  toggleItemExpanded(sub.id);
  expandedItemIds.add(it.id);
  const html = itemRowHtml(sub);
  assertIncludes(html, 'class="milestone-header item-row-indent-2"');
  assertIncludes(html, 'class="milestone-sub-row  item-row-indent-2"');
});

test('an ordinary (non-nested) scope item\'s own milestone header/rows get no indent class', function () {
  const it = addItem({
    name: 'Plain scope item',
    milestones: [{ id: 'm1', name: 'Kickoff', dueDate: todayStr(), status: 'not-started', actualDate: null, notApplicable: false }]
  });
  expandedItemIds.add(it.id);
  const html = itemRowHtml(it);
  assertNotIncludes(html, 'item-row-indent-1');
  assertNotIncludes(html, 'item-row-indent-2');
});

// ---------- Journey "header" tint (visual, no new icons) ----------
// An explicit user request ("build 1 and 2", following a design discussion
// on telling Journey/Sub Journey/scope item rows apart now that per-row
// icons are gone): a top-level Journey's own row gets the same tinted
// "section header" treatment .ws-section-header uses for a workstream. (A
// companion CSS-only tree guide-line, "build 2" of that same pair, was
// added alongside this and later removed again per a separate explicit
// user request ("remove 2") — see CLAUDE.md's "Journeys" section.)

test('a top-level Journey\'s own row gets the item-row-journey-header class; a Sub Journey\'s does not', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const scope = addItem({ name: 'Ordinary scope item' });
  assertIncludes(itemRowHtml(journey), 'item-row-journey-header');
  assertNotIncludes(itemRowHtml(sub), 'item-row-journey-header');
  assertNotIncludes(itemRowHtml(scope), 'item-row-journey-header');
});

test('a Sub Journey\'s connected scope item (rendered viewOnly) does not get item-row-journey-header either', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Design the intake form' });
  it.journeyId = sub.id;
  toggleItemExpanded(sub.id);
  assertNotIncludes(itemRowHtml(sub), 'item-row-journey-header');
});

test('a collapsed Sub Journey never shows its connected scope items, even with some connected', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Hidden while collapsed' });
  it.journeyId = sub.id;
  assertFalse(expandedItemIds.has(sub.id));
  assertNotIncludes(itemRowHtml(sub), 'Hidden while collapsed');
});

test('the milestone-count-badge shows a connected scope item count for an expanded-or-not Sub Journey', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'One connection' });
  it.journeyId = sub.id;
  assertIncludes(itemRowHtml(sub), '1 scope item<');
  const it2 = addItem({ name: 'Two connections' });
  it2.journeyId = sub.id;
  assertIncludes(itemRowHtml(sub), '2 scope items<');
});

test('a scope item never gets the connected-items expand treatment, even if it somehow has a journeyId', function () {
  const it = addItem({ name: 'Just a scope item' });
  toggleItemExpanded(it.id);
  assertNotIncludes(itemRowHtml(it), 'No scope items connected yet');
});

// ---------- connectedScopeItems / connectedSubJourneys ----------

test('connectedScopeItems returns only items whose journeyId matches a Sub Journey, sorted by order', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id, 'Sub A');
  const otherSub = addSubJourney(journey.id, 'Sub B');
  const a = addItem({ name: 'A', journeyId: sub.id, order: 1 });
  const b = addItem({ name: 'B', journeyId: sub.id, order: 0 });
  addItem({ name: 'Unconnected' });
  addItem({ name: 'Connected elsewhere', journeyId: otherSub.id });
  assertDeepEqual(connectedScopeItems(sub.id).map(it => it.name), ['B', 'A']);
});

test('connectedSubJourneys returns only items whose parentJourneyId matches, sorted by order, excluding scope items even if one somehow has a matching journeyId', function () {
  const journey = addJourney();
  const other = addJourney('Other journey');
  const subA = addSubJourney(journey.id, 'A');
  const subB = addSubJourney(journey.id, 'B');
  addSubJourney(other.id, 'Connected elsewhere');
  assertDeepEqual(connectedSubJourneys(journey.id).map(it => it.name), ['A', 'B']);
});

// ---------- computeSubJourneyDateRange (the direct, scope-item-level
// roll-up — exactly what the single-level Journey's own
// computeJourneyDateRange used to be) ----------

test('computeSubJourneyDateRange returns null when nothing is connected', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  assertEqual(computeSubJourneyDateRange(sub.id), null);
});

test('computeSubJourneyDateRange spans the earliest/latest due-or-actual date across every connected item\'s milestones', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({
    name: 'Item A', journeyId: sub.id,
    milestones: [
      { id: 'm1', name: 'X', dueDate: '2026-03-01', status: 'not-started', actualDate: null, notApplicable: false },
      { id: 'm2', name: 'Y', dueDate: '2026-05-01', status: 'not-started', actualDate: '2026-06-15', notApplicable: false }
    ]
  });
  addItem({
    name: 'Item B', journeyId: sub.id,
    milestones: [{ id: 'm3', name: 'Z', dueDate: '2026-01-10', status: 'not-started', actualDate: null, notApplicable: false }]
  });
  const range = computeSubJourneyDateRange(sub.id);
  assertEqual(range.startDate, '2026-01-10');
  assertEqual(range.dueDate, '2026-06-15');
});

test('computeSubJourneyDateRange excludes a notApplicable milestone\'s dates', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({
    name: 'Item A', journeyId: sub.id,
    milestones: [
      { id: 'm1', name: 'Skip', dueDate: '2026-01-01', status: 'not-started', actualDate: null, notApplicable: true },
      { id: 'm2', name: 'Keep', dueDate: '2026-04-01', status: 'not-started', actualDate: null, notApplicable: false }
    ]
  });
  const range = computeSubJourneyDateRange(sub.id);
  assertEqual(range.startDate, '2026-04-01');
  assertEqual(range.dueDate, '2026-04-01');
});

test('computeSubJourneyDateRange falls back to a connected item\'s own start/due dates when it has no milestones', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({ name: 'No milestones', journeyId: sub.id, milestones: [], startDate: '2026-02-01', dueDate: '2026-02-20' });
  const range = computeSubJourneyDateRange(sub.id);
  assertEqual(range.startDate, '2026-02-01');
  assertEqual(range.dueDate, '2026-02-20');
});

test('itemRowHtml shows the computed range for a Sub Journey, and a placeholder when nothing is connected', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  assertIncludes(itemRowHtml(sub), '—');
  addItem({ name: 'Connected', journeyId: sub.id, startDate: '2026-07-01', dueDate: '2026-07-15' });
  const html = itemRowHtml(sub);
  assertIncludes(html, fmtDateY('2026-07-01'));
  assertIncludes(html, fmtDateY('2026-07-15'));
});

test('the item modal shows a computed Plan-dates badge for an existing Sub Journey, sourced from connected items', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({ name: 'Connected', journeyId: sub.id, startDate: '2026-08-01', dueDate: '2026-08-10' });
  openItemModal(sub.id);
  assertEqual(document.getElementById('itemDatesManual').style.display, 'none');
  assertEqual(document.getElementById('itemDatesComputed').style.display, '');
  assertIncludes(document.getElementById('itemDatesComputedBadge').textContent, fmtDateY('2026-08-01'));
});

test('the item modal shows "No connected scope items yet" for a brand-new Sub Journey (no id to look up connections by)', function () {
  openItemModal(null, null, 'subjourney');
  assertEqual(document.getElementById('itemDatesComputedBadge').textContent, 'No connected scope items yet');
});

// ---------- computeJourneyDateRange (one level further removed — rolls up
// over connected Sub Journeys' own already-computed ranges) ----------

test('computeJourneyDateRange returns null when nothing is connected', function () {
  const journey = addJourney();
  assertEqual(computeJourneyDateRange(journey.id), null);
});

test('computeJourneyDateRange returns null when a Sub Journey is connected but it has no dates of its own to contribute', function () {
  const journey = addJourney();
  addSubJourney(journey.id);
  assertEqual(computeJourneyDateRange(journey.id), null);
});

test('computeJourneyDateRange spans the earliest/latest date across every connected Sub Journey\'s own computed range', function () {
  const journey = addJourney();
  const subA = addSubJourney(journey.id, 'A');
  const subB = addSubJourney(journey.id, 'B');
  addItem({ name: 'In A', journeyId: subA.id, startDate: '2026-03-01', dueDate: '2026-03-10', milestones: [] });
  addItem({ name: 'In B', journeyId: subB.id, startDate: '2026-01-01', dueDate: '2026-06-01', milestones: [] });
  const range = computeJourneyDateRange(journey.id);
  assertEqual(range.startDate, '2026-01-01');
  assertEqual(range.dueDate, '2026-06-01');
});

test('itemRowHtml shows the computed range for a Journey, and a placeholder when nothing is connected', function () {
  const journey = addJourney();
  assertIncludes(itemRowHtml(journey), '—');
  const sub = addSubJourney(journey.id);
  addItem({ name: 'Connected', journeyId: sub.id, startDate: '2026-07-01', dueDate: '2026-07-15', milestones: [] });
  const html = itemRowHtml(journey);
  assertIncludes(html, fmtDateY('2026-07-01'));
  assertIncludes(html, fmtDateY('2026-07-15'));
});

test('the item modal shows a computed Plan-dates badge for an existing Journey, sourced from its connected Sub Journeys', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({ name: 'Connected', journeyId: sub.id, startDate: '2026-08-01', dueDate: '2026-08-10', milestones: [] });
  openItemModal(journey.id);
  assertEqual(document.getElementById('itemDatesManual').style.display, 'none');
  assertEqual(document.getElementById('itemDatesComputed').style.display, '');
  assertIncludes(document.getElementById('itemDatesComputedBadge').textContent, fmtDateY('2026-08-01'));
});

test('the item modal shows "No connected Sub Journeys yet" for a brand-new Journey (no id to look up connections by)', function () {
  openItemModal(null, null, 'journey');
  assertEqual(document.getElementById('itemDatesComputedBadge').textContent, 'No connected Sub Journeys yet');
});

// ---------- computeSubJourneyStatus() / computeJourneyStatus() ----------
// An explicit, later user request: "Journey should calculate their status
// based on the status of the included scope items" — carried down one
// level to Sub Journey (the direct roll-up) once the 2-level hierarchy was
// added, with the top-level Journey now rolling up over its Sub Journeys'
// own already-computed status instead.

test('computeSubJourneyStatus returns null when nothing is connected', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  assertEqual(computeSubJourneyStatus(sub.id), null);
});

test('computeSubJourneyStatus picks the weakest (worst) status across every connected scope item', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({ name: 'A', journeyId: sub.id, status: 'green' });
  addItem({ name: 'B', journeyId: sub.id, status: 'red' });
  addItem({ name: 'C', journeyId: sub.id, status: 'amber' });
  assertEqual(computeSubJourneyStatus(sub.id), 'red');
});

test('computeSubJourneyStatus treats not-started as better than an active Green/Amber/Red, same severity order as computedStatusFromMilestones', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({ name: 'A', journeyId: sub.id, status: 'not-started' });
  addItem({ name: 'B', journeyId: sub.id, status: 'amber' });
  assertEqual(computeSubJourneyStatus(sub.id), 'amber');
});

test('computeSubJourneyStatus reads complete as the best status when every connected item is done', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({ name: 'A', journeyId: sub.id, status: 'complete' });
  addItem({ name: 'B', journeyId: sub.id, status: 'complete' });
  assertEqual(computeSubJourneyStatus(sub.id), 'complete');
});

test('itemRowHtml shows the computed status badge for a Sub Journey, falling back to Not Started when nothing is connected', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  assertIncludes(itemRowHtml(sub), statusLabel('not-started'));
  addItem({ name: 'Connected', journeyId: sub.id, status: 'red' });
  assertIncludes(itemRowHtml(sub), statusLabel('red'));
});

test('the item modal shows a computed Status badge for an existing Sub Journey, sourced from connected items, not a manual select', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({ name: 'Connected', journeyId: sub.id, status: 'amber' });
  openItemModal(sub.id);
  assertEqual(document.getElementById('itemStatusSelect').style.display, 'none');
  assertEqual(document.getElementById('itemStatusComputed').style.display, '');
  assertEqual(document.getElementById('itemStatusComputedBadge').textContent, statusLabel('amber'));
});

test('computeJourneyStatus returns null when nothing is connected', function () {
  const journey = addJourney();
  assertEqual(computeJourneyStatus(journey.id), null);
});

test('computeJourneyStatus picks the weakest (worst) status across every connected Sub Journey\'s own computed status', function () {
  const journey = addJourney();
  const subGreen = addSubJourney(journey.id, 'Green sub');
  addItem({ name: 'A', journeyId: subGreen.id, status: 'green' });
  const subRed = addSubJourney(journey.id, 'Red sub');
  addItem({ name: 'B', journeyId: subRed.id, status: 'red' });
  assertEqual(computeJourneyStatus(journey.id), 'red');
});

test('computeJourneyStatus treats an empty Sub Journey (nothing connected to it yet, so it computes to not-started) as better than an active Green sibling — it should not drag the overall status down', function () {
  const journey = addJourney();
  addSubJourney(journey.id, 'Empty sub'); // contributes 'not-started'
  const subGreen = addSubJourney(journey.id, 'Green sub');
  addItem({ name: 'A', journeyId: subGreen.id, status: 'green' });
  assertEqual(computeJourneyStatus(journey.id), 'green', 'not-started ranks near the best end (only worse than complete), same severity order computedStatusFromMilestones uses — an empty Sub Journey must not outrank a genuinely active Green one');
});

test('computeJourneyStatus reads complete as the best status when every connected Sub Journey is fully complete', function () {
  const journey = addJourney();
  const subA = addSubJourney(journey.id, 'A');
  addItem({ name: 'Item A', journeyId: subA.id, status: 'complete' });
  const subB = addSubJourney(journey.id, 'B');
  addItem({ name: 'Item B', journeyId: subB.id, status: 'complete' });
  assertEqual(computeJourneyStatus(journey.id), 'complete');
});

test('itemRowHtml shows the computed status badge for a Journey, falling back to Not Started when nothing is connected', function () {
  const journey = addJourney();
  assertIncludes(itemRowHtml(journey), statusLabel('not-started'));
  const sub = addSubJourney(journey.id);
  addItem({ name: 'Connected', journeyId: sub.id, status: 'red' });
  assertIncludes(itemRowHtml(journey), statusLabel('red'));
});

test('the item modal shows a computed Status badge for an existing Journey, sourced from its connected Sub Journeys, not a manual select', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  addItem({ name: 'Connected', journeyId: sub.id, status: 'amber' });
  openItemModal(journey.id);
  assertEqual(document.getElementById('itemStatusSelect').style.display, 'none');
  assertEqual(document.getElementById('itemStatusComputed').style.display, '');
  assertEqual(document.getElementById('itemStatusComputedBadge').textContent, statusLabel('amber'));
});

test('the item modal shows the Not Started fallback for a brand-new Journey (no id to look up connections by)', function () {
  openItemModal(null, null, 'journey');
  assertEqual(document.getElementById('itemStatusSelect').style.display, 'none');
  assertEqual(document.getElementById('itemStatusComputedBadge').textContent, statusLabel('not-started'));
});

test('saveItem never reads the hidden Status select for a Journey — the stored status field is inert, display always comes from computeJourneyStatus', function () {
  const journey = addJourney('Onboarding');
  const sub = addSubJourney(journey.id);
  addItem({ name: 'Connected', journeyId: sub.id, status: 'red' });
  openItemModal(journey.id);
  document.getElementById('itemNameInput').value = 'Onboarding v2';
  document.getElementById('itemStatusSelect').value = 'green'; // simulates a stray/bypassed value
  saveItem();
  const saved = items.find(i => i.id === journey.id);
  assertEqual(saved.name, 'Onboarding v2', 'the unrelated edit should still have saved');
  assertEqual(computeJourneyStatus(journey.id), 'red', 'the displayed status is unaffected by whatever the hidden select reported');
});

test('saveItem never reads the hidden Status select for a Sub Journey either', function () {
  const journey = addJourney('Parent');
  const sub = addSubJourney(journey.id, 'Sub');
  addItem({ name: 'Connected', journeyId: sub.id, status: 'red' });
  openItemModal(sub.id);
  document.getElementById('itemNameInput').value = 'Sub v2';
  document.getElementById('itemStatusSelect').value = 'green';
  saveItem();
  const saved = items.find(i => i.id === sub.id);
  assertEqual(saved.name, 'Sub v2');
  assertEqual(computeSubJourneyStatus(sub.id), 'red');
});

// ---------- The connect modal (now Sub Journey scoped) ----------

test('openJourneyConnectModal sets the title and populates the list, grouped by workstream', function () {
  const secondWs = { id: genId(), name: 'Second', color: 'teal', order: 1 };
  workstreams.push(secondWs);
  const journey = addJourney('Parent');
  const sub = addSubJourney(journey.id, 'Supplier Onboarding');
  addItem({ name: 'In first ws' });
  addItem({ name: 'In second ws', workstreamId: secondWs.id });
  openJourneyConnectModal(sub.id);
  assertEqual(document.getElementById('journeyConnectModalTitle').textContent, 'Connect scope items to Sub Journey "Supplier Onboarding"');
  const html = document.getElementById('journeyConnectList').innerHTML;
  assertIncludes(html, workstreams[0].name);
  assertIncludes(html, 'Second');
  assertIncludes(html, 'In first ws');
  assertIncludes(html, 'In second ws');
});

test('renderJourneyConnectList groups an Unassigned scope item under its own "Unassigned" heading', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  items.push({ id: genId(), workstreamId: null, categoryId: categories.find(c => c.pending).id, itemType: 'scope', name: 'Needs triage', dueDate: todayStr(), startDate: todayStr(), milestones: [], order: 0 });
  openJourneyConnectModal(sub.id);
  const html = document.getElementById('journeyConnectList').innerHTML;
  assertIncludes(html, 'Unassigned');
  assertIncludes(html, 'Needs triage');
});

test('renderJourneyConnectList checks a scope item already connected to this Sub Journey', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const connected = addItem({ name: 'Already connected', journeyId: sub.id });
  openJourneyConnectModal(sub.id);
  const html = document.getElementById('journeyConnectList').innerHTML;
  assertIncludes(html, `checked onchange="toggleJourneyConnection('${connected.id}', this.checked)"`);
});

test('renderJourneyConnectList excludes a scope item already connected to a *different* Sub Journey', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id, 'This sub');
  const otherSub = addSubJourney(journey.id, 'Other sub');
  addItem({ name: 'Taken', journeyId: otherSub.id });
  openJourneyConnectModal(sub.id);
  assertNotIncludes(document.getElementById('journeyConnectList').innerHTML, 'Taken');
});

test('renderJourneyConnectList excludes every Journey and Sub Journey itself from the candidate list — only real scope items are connectable', function () {
  const journey = addJourney('A Journey');
  const sub = addSubJourney(journey.id, 'A Sub Journey');
  const otherJourney = addJourney('Another Journey');
  const otherSub = addSubJourney(otherJourney.id, 'Another Sub Journey');
  openJourneyConnectModal(sub.id);
  const html = document.getElementById('journeyConnectList').innerHTML;
  assertNotIncludes(html, 'Another Journey');
  assertNotIncludes(html, 'Another Sub Journey');
});

test('renderJourneyConnectList shows a placeholder when there are no available scope items', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  openJourneyConnectModal(sub.id);
  assertIncludes(document.getElementById('journeyConnectList').innerHTML, 'No available scope items yet.');
});

// Regression test for a user-reported bug: a scope item quick-added via
// openInlineQuickAdd() earlier in the same session used to be invisible in
// this list. saveInlineQuickAddItem() never stamped itemType at all (only
// normalizeData(), run on load/merge/import — not on a plain save() — ever
// backfills it), so the item's itemType stayed undefined for the rest of
// that session; renderJourneyConnectList()'s own candidates filter checked
// itemType === 'scope', which undefined never satisfies. Both halves of the
// fix are covered here: saveInlineQuickAddItem() now stamps itemType
// itself, and the filter is the same defensive itemType !== 'journey'/
// 'subjourney' form used everywhere else in this file, so even an item that
// somehow still arrives with no itemType (an old import, a hand-edited
// file) shows up correctly rather than silently disappearing from this one
// picker.
test('a scope item quick-added via openInlineQuickAdd (before any reload/normalizeData) still shows up in the Sub Journey connect list', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  openInlineQuickAdd();
  document.getElementById('unassignedQuickAddInput').value = 'Freshly quick-added';
  saveInlineQuickAddItem();
  const it = items[items.length - 1];
  assertEqual(it.itemType, 'scope', 'saveInlineQuickAddItem must stamp itemType itself, not rely on a later normalizeData() pass');
  openJourneyConnectModal(sub.id);
  assertIncludes(document.getElementById('journeyConnectList').innerHTML, 'Freshly quick-added');
});

test('renderJourneyConnectList includes a scope item with no itemType at all (pre-normalizeData legacy/imported data), not just ones already stamped "scope"', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  items.push({ id: genId(), workstreamId: null, categoryId: categories.find(c => c.pending).id, name: 'No itemType yet', dueDate: todayStr(), startDate: todayStr(), milestones: [], order: 0 });
  openJourneyConnectModal(sub.id);
  assertIncludes(document.getElementById('journeyConnectList').innerHTML, 'No itemType yet');
});

test('toggleJourneyConnection sets and clears journeyId directly', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Target' });
  openJourneyConnectModal(sub.id);
  toggleJourneyConnection(it.id, true);
  assertEqual(it.journeyId, sub.id);
  toggleJourneyConnection(it.id, false);
  assertEqual(it.journeyId, null);
});

test('toggleJourneyConnection re-renders the still-open modal list to reflect the new state', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Target item' });
  openJourneyConnectModal(sub.id);
  toggleJourneyConnection(it.id, true);
  assertIncludes(document.getElementById('journeyConnectList').innerHTML, `checked onchange="toggleJourneyConnection('${it.id}', this.checked)"`);
});

test('toggleJourneyConnection is blocked for Reviewer', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Target' });
  userRole = 'reviewer';
  toggleJourneyConnection(it.id, true);
  assertEqual(it.journeyId, null);
});

test('openJourneyConnectModal is blocked for Reviewer', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  userRole = 'reviewer';
  openJourneyConnectModal(sub.id);
  assertFalse(document.getElementById('journeyConnectModalBg').classList.contains('open'));
});

test('closeJourneyConnectModal clears journeyConnectItemId', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  openJourneyConnectModal(sub.id);
  closeJourneyConnectModal();
  assertEqual(journeyConnectItemId, null);
  assertFalse(document.getElementById('journeyConnectModalBg').classList.contains('open'));
});

// ---------- The "From Sub Journey" / "From Journey" backlinks in the item
// modal ----------

test('openItemModal shows a read-only "From Sub Journey" line for a scope item connected to one', function () {
  const journey = addJourney('Parent');
  const sub = addSubJourney(journey.id, 'Payments Revamp');
  const it = addItem({ name: 'Integrate gateway' });
  openJourneyConnectModal(sub.id); // toggleJourneyConnection() requires the modal's own journeyConnectItemId to be set first
  toggleJourneyConnection(it.id, true);
  openItemModal(it.id);
  assertEqual(document.getElementById('itemJourneyLinkField').style.display, '');
  assertEqual(document.getElementById('itemJourneyLinkLabel').textContent, 'From Sub Journey');
  assertEqual(document.getElementById('itemJourneyLinkBadge').textContent, 'Payments Revamp');
});

test('openItemModal shows a read-only "From Journey" line for a Sub Journey itself, naming its parent Journey', function () {
  const journey = addJourney('Payments Revamp');
  const sub = addSubJourney(journey.id, 'Gateway integration');
  openItemModal(sub.id);
  assertEqual(document.getElementById('itemJourneyLinkField').style.display, '');
  assertEqual(document.getElementById('itemJourneyLinkLabel').textContent, 'From Journey');
  assertEqual(document.getElementById('itemJourneyLinkBadge').textContent, 'Payments Revamp');
});

test('openItemModal hides the backlink line for an ordinary, unconnected scope item', function () {
  const it = addItem({ name: 'No journey here' });
  openItemModal(it.id);
  assertEqual(document.getElementById('itemJourneyLinkField').style.display, 'none');
});

test('openItemModal hides the backlink line for a top-level Journey — it has nothing above it to link to', function () {
  const journey = addJourney();
  openItemModal(journey.id);
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

test('normalizeData recognizes "subjourney" as a valid itemType, not resetting it to "scope"', function () {
  const journey = addJourney();
  items.push({ id: genId(), workstreamId: null, categoryId: null, itemType: 'subjourney', parentJourneyId: journey.id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[1].itemType, 'subjourney');
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

test('normalizeData clears a journeyId pointing at an item that exists but is not itemType:"subjourney" (e.g. a top-level Journey)', function () {
  const journey = addJourney('Not a valid target any more');
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, journeyId: journey.id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[items.length - 1].journeyId, null, 'a scope item may only ever connect to a Sub Journey, never a top-level Journey');
});

test('normalizeData preserves a journeyId that legitimately points at an existing Sub Journey', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, journeyId: sub.id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[items.length - 1].journeyId, sub.id);
});

test('normalizeData backfills a missing parentJourneyId to null', function () {
  items.push({ id: genId(), workstreamId: null, categoryId: null, itemType: 'subjourney', name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].parentJourneyId, null);
});

test('normalizeData clears a parentJourneyId that points at a deleted/non-existent Journey', function () {
  items.push({ id: genId(), workstreamId: null, categoryId: null, itemType: 'subjourney', parentJourneyId: 'does-not-exist', name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].parentJourneyId, null);
});

test('normalizeData clears a parentJourneyId pointing at an item that is not itemType:"journey"', function () {
  const notAJourney = addItem({ name: 'Just a scope item' });
  items.push({ id: genId(), workstreamId: null, categoryId: null, itemType: 'subjourney', parentJourneyId: notAJourney.id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[1].parentJourneyId, null);
});

test('normalizeData preserves a parentJourneyId that legitimately points at an existing Journey', function () {
  const journey = addJourney();
  items.push({ id: genId(), workstreamId: null, categoryId: null, itemType: 'subjourney', parentJourneyId: journey.id, name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[items.length - 1].parentJourneyId, journey.id);
});

test('normalizeData forces parentJourneyId to null for every item type other than "subjourney", even if one happens to be set', function () {
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, itemType: 'scope', parentJourneyId: 'stray-value', name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].parentJourneyId, null);
});

test('normalizeData never resets a Journey\'s or Sub Journey\'s own workstreamId to anything other than null (neither has one to reassign)', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  normalizeData();
  assertEqual(journey.workstreamId, null);
  assertEqual(sub.workstreamId, null);
});

// ---------- unassignedItemsSorted excludes both Journeys and Sub Journeys ----------

test('unassignedItemsSorted never includes a Journey or a Sub Journey, even though all three share workstreamId:null', function () {
  const journey = addJourney('Should not appear here');
  addSubJourney(journey.id, 'Should not appear here either');
  items.push({ id: genId(), workstreamId: null, categoryId: categories.find(c => c.pending).id, itemType: 'scope', name: 'Genuinely unassigned', dueDate: todayStr(), startDate: todayStr(), milestones: [], order: 0 });
  const names = unassignedItemsSorted().map(it => it.name);
  assertDeepEqual(names, ['Genuinely unassigned']);
});

// ---------- Journeys as a Planning sub-tab ----------
// Journeys used to be its own top-level mode (mode:'journeys'), reached from
// a dedicated sidebar row — an explicit user request ("move Journeys to All
// Workstreams / Planning / Journeys") moved it inside Planning instead, as
// its second sub-tab (planningTab, alongside the status board's own "Scope
// Items"), the same reviewTab-style pattern Review's own sub-tabs already
// use. mode itself now stays 'planning' the whole time; only planningTab
// changes which content renderMain() writes into #main.

test('setPlanningTab("journeys") keeps mode at "planning" and renders Journeys content into the shared #main, with adminBody still hidden', function () {
  setPlanningTab('journeys');
  assertEqual(mode, 'planning', 'Journeys is a Planning sub-tab now, not its own mode');
  assertEqual(planningTab, 'journeys');
  assertEqual(document.getElementById('scopedBody').style.display, '');
  assertEqual(document.getElementById('adminBody').style.display, 'none');
});

test('the Planning toolbar shows Scope Items/Journeys sub-tab buttons only in Planning mode, with the correct one active', function () {
  setMode('dashboard');
  assertEqual(document.getElementById('planningModeToolbar').style.display, 'none');

  setMode('planning');
  assertEqual(document.getElementById('planningModeToolbar').style.display, '');
  assertTrue(document.getElementById('tabPlanningScope').classList.contains('active'));
  assertFalse(document.getElementById('tabPlanningJourneys').classList.contains('active'));

  setPlanningTab('journeys');
  assertFalse(document.getElementById('tabPlanningScope').classList.contains('active'));
  assertTrue(document.getElementById('tabPlanningJourneys').classList.contains('active'));
});

test('the search box/status-chip toolbar only shows on Planning\'s Scope Items sub-tab, not on Journeys', function () {
  setMode('planning');
  assertEqual(document.getElementById('planningSearchToolbar').style.display, '');
  setPlanningTab('journeys');
  assertEqual(document.getElementById('planningSearchToolbar').style.display, 'none');
  setPlanningTab('scope');
  assertEqual(document.getElementById('planningSearchToolbar').style.display, '');
});

test('allJourneys returns only itemType:"journey" items, sorted by order, excluding Sub Journeys and scope items', function () {
  addItem({ name: 'Scope item, not a journey' });
  const journey = addJourney('First Journey');
  addSubJourney(journey.id, 'Not a top-level journey');
  addJourney('Second Journey');
  const names = allJourneys().map(j => j.name);
  assertDeepEqual(names, ['First Journey', 'Second Journey']);
});

test('renderJourneys lists every top-level journey in one flat list with a single Add-Journey button (inline quick-add, not the modal), and excludes scope items and Sub Journeys from the top-level list', function () {
  addItem({ name: 'A plain scope item' });
  const journey = addJourney('The Journey');
  addSubJourney(journey.id, 'A Sub Journey');
  setPlanningTab('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'The Journey');
  assertNotIncludes(html, 'A plain scope item');
  assertIncludes(html, `onclick="openJourneyQuickAdd()"`);
});

test('renderJourneys shows "No journeys yet" when there are none', function () {
  setPlanningTab('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'No journeys yet.');
});

test('renderJourneys ignores the shared filterWorkstreamId selector entirely — it always shows every journey', function () {
  const secondWs = { id: genId(), name: 'Second', color: 'teal', order: 1 };
  workstreams.push(secondWs);
  addJourney('Journey A');
  addJourney('Journey B');
  setFilterWorkstream(secondWs.id);
  setPlanningTab('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Journey A');
  assertIncludes(html, 'Journey B');
});

test('renderJourneys works even with zero workstreams (a Journey needs none to exist)', function () {
  workstreams = []; items = [];
  addJourney('Standalone Journey');
  setPlanningTab('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Standalone Journey');
});

// ---------- Journeys' own "Expand all"/"Collapse all" ----------
// An explicit user request to bring the same per-section control Planning's
// status board already has (expandAllToggleHtml()) to the Journeys sub-tab
// too. journeysExpandAllIds()/journeysExpandAllToggleHtml() are its own
// counterparts, since "expandable" means something different here (every
// Journey/Sub Journey, not "has milestones") and there are two nested
// levels to unfold, not one.

test('journeysExpandAllIds collects every top-level Journey plus every one of its own Sub Journeys, but not connected scope items', function () {
  const j1 = addJourney('Journey A');
  const sub1 = addSubJourney(j1.id, 'Sub A1');
  const it = addItem({ name: 'Connected item' });
  it.journeyId = sub1.id;
  const j2 = addJourney('Journey B');
  const ids = journeysExpandAllIds();
  assertDeepEqual(ids.sort(), [j1.id, sub1.id, j2.id].sort());
});

test('journeysExpandAllToggleHtml is omitted (empty string) when there are no journeys at all', function () {
  assertEqual(journeysExpandAllToggleHtml(), '');
});

test('renderJourneys shows the Expand-all/Collapse-all icon in its own page header once at least one journey exists', function () {
  addJourney('Journey A');
  setPlanningTab('journeys');
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'toggleExpandAllForItems');
  assertIncludes(html, 'Expand all');
});

test('clicking Expand-all on the Journeys sub-tab expands every Journey and every Sub Journey at once', function () {
  const j1 = addJourney('Journey A');
  const sub1 = addSubJourney(j1.id, 'Sub A1');
  const j2 = addJourney('Journey B');
  assertFalse(expandedItemIds.has(j1.id));
  assertFalse(expandedItemIds.has(sub1.id));
  assertFalse(expandedItemIds.has(j2.id));
  toggleExpandAllForItems(journeysExpandAllIds());
  assertTrue(expandedItemIds.has(j1.id));
  assertTrue(expandedItemIds.has(sub1.id));
  assertTrue(expandedItemIds.has(j2.id));
});

test('clicking Expand-all a second time (once everything is already expanded) collapses everything back', function () {
  const j1 = addJourney('Journey A');
  const sub1 = addSubJourney(j1.id, 'Sub A1');
  toggleExpandAllForItems(journeysExpandAllIds());
  toggleExpandAllForItems(journeysExpandAllIds());
  assertFalse(expandedItemIds.has(j1.id));
  assertFalse(expandedItemIds.has(sub1.id));
});

test('renderJourneys still renders correctly (and updates, not just Planning) after toggleExpandAllForItems, since it now calls the general render()', function () {
  const j1 = addJourney('Journey A');
  const sub1 = addSubJourney(j1.id, 'Sub A1');
  setPlanningTab('journeys');
  toggleExpandAllForItems(journeysExpandAllIds());
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Sub A1', 'expanding the Journey should reveal its Sub Journey in the live-rendered page, not just in expandedItemIds state');
});

// ---------- Planner: Journey/Sub Journey management ----------
// The Planner role — an explicit user request ("Create the role Planner...
// It should be able to create and edit journeys (also linking/delinking
// scope items to journeys). The other access rights should be inherited
// from visitor"). See "Roles (RBAC)" in CLAUDE.md for the full design: ROLES
// is ['visitor','planner','reviewer','editor','admin'] — Planner sits
// directly above Visitor, not between Reviewer and Editor, specifically so
// the plain cumulative hasRole() ladder doesn't also hand it Reviewer's own
// review-cycle actions. Journey/Sub Journey management itself is granted by
// a separate, non-ladder predicate, canManageJourneys() (`userRole ===
// 'planner' || hasRole('editor')`) — every one of the individual
// "...is blocked for Reviewer" tests above already covers the negative case
// for that one function; these tests instead exercise the actual new
// branching logic end-to-end (Planner succeeds, Editor/Admin are
// unaffected, Reviewer is still excluded despite outranking Planner on the
// ladder) and confirm Planner gets nothing beyond Journeys.

test('canManageJourneys is true for Planner, Editor, and Admin, false for Reviewer and Visitor', function () {
  ['planner', 'editor', 'admin'].forEach(r => { userRole = r; assertTrue(canManageJourneys(), r); });
  ['reviewer', 'visitor'].forEach(r => { userRole = r; assertFalse(canManageJourneys(), r); });
});

test('a Planner can create a Journey and a Sub Journey', function () {
  userRole = 'planner';
  const journey = addJourney('Planner-made Journey');
  assertEqual(journey.itemType, 'journey');
  const sub = addSubJourney(journey.id, 'Planner-made Sub Journey');
  assertEqual(sub.itemType, 'subjourney');
  assertEqual(sub.parentJourneyId, journey.id);
});

test('a Planner can edit and delete a Journey', function () {
  const journey = addJourney('Original name');
  userRole = 'planner';
  openItemModal(journey.id);
  assertEqual(document.getElementById('itemSaveBtn').style.display, '', 'Save must be visible for a Planner editing a Journey');
  document.getElementById('itemNameInput').value = 'Renamed by Planner';
  saveItem();
  assertEqual(journey.name, 'Renamed by Planner');

  deleteItem(journey.id);
  confirmModalAction();
  assertFalse(items.some(it => it.id === journey.id), 'a Planner must be able to delete a Journey too');
});

test('a Planner can link and delink a scope item to a Sub Journey', function () {
  const journey = addJourney();
  const sub = addSubJourney(journey.id);
  const it = addItem({ name: 'Linkable scope item' });
  userRole = 'planner';
  openJourneyConnectModal(sub.id);
  assertTrue(document.getElementById('journeyConnectModalBg').classList.contains('open'));
  toggleJourneyConnection(it.id, true);
  assertEqual(it.journeyId, sub.id, 'a Planner must be able to link a scope item to a Sub Journey');
  toggleJourneyConnection(it.id, false);
  assertEqual(it.journeyId, null, 'a Planner must be able to delink it again too');
});

test('a Planner can drag-reorder Journeys', function () {
  const j1 = addJourney('First');
  const j2 = addJourney('Second');
  userRole = 'planner';
  reorderItem(j2.id, j1.id);
  assertEqual(j2.order, 0, 'a Planner must be able to reorder Journeys via drag-and-drop, same as an Editor');
});

test('Reviewer stays blocked from every Journey/Sub Journey action above, despite outranking Planner on the plain ROLES ladder', function () {
  const j1 = addJourney('First');
  const j2 = addJourney('Second');
  const sub = addSubJourney(j1.id);
  const it = addItem({ name: 'X' });
  const j2OrderBefore = j2.order;
  userRole = 'reviewer';
  reorderItem(j2.id, j1.id);
  assertEqual(j2.order, j2OrderBefore, 'Reviewer must not be able to reorder Journeys');
  toggleJourneyConnection(it.id, true);
  assertEqual(it.journeyId, null, 'Reviewer must not be able to link a scope item to a Sub Journey');
  deleteItem(sub.id);
  assertTrue(items.some(i => i.id === sub.id), 'Reviewer must not be able to delete a Sub Journey');
});

test('a Planner\'s other access rights are inherited from Visitor — ordinary scope items, workstreams, and categories stay off-limits', function () {
  userRole = 'planner';
  const wsBefore = workstreams.length;
  document.getElementById('wsNameInput').value = 'Should not save';
  saveWorkstream();
  assertEqual(workstreams.length, wsBefore, 'a Planner must not be able to create/edit workstreams');

  const itemsBefore = items.length;
  openItemModal(null, workstreams[0] && workstreams[0].id); // a plain scope item, not a Journey
  document.getElementById('itemNameInput').value = 'Should not save either';
  saveItem();
  assertEqual(items.length, itemsBefore, 'a Planner must not be able to create/edit an ordinary scope item');

  assertFalse(hasRole('reviewer'), 'a Planner must not gain Reviewer\'s own review-cycle actions just by outranking it numerically were the ladder read naively');
});

// ---------- Reserved-category protections (deletion, pickers) already
// covered in categories.test.js/pending.test.js — see:
//  - "deleteCategoryFromModal refuses to delete the reserved Journey category..."
//  - "deleteCategoryFromModal refuses to delete the last remaining non-Pending, non-Journey category"
//  - "openScopeAssignModal ... offers every category except Pending and Journey"
