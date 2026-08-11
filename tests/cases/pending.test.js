// ---------- Quick-add scope items & the reserved Pending category ----------
// See "Quick-add scope items & the Pending category" in pulse.html and
// CLAUDE.md. The Unassigned section's inline "+ Add item" (see
// unassignedSectionHtml()) is a deliberately minimal, name-only capture —
// no modal, no workstream picker. The new item is seeded with no workstream
// at all (workstreamId: null — "Unassigned") and straight into the reserved
// Pending category with its one milestone, "Scope Item Confirmed". Marking
// that milestone Complete pops up openScopeAssignModal() to pick the item's
// real workstream/category together, which applyScopeCategory() then applies.

function addPendingItem(name) {
  openInlineQuickAdd();
  document.getElementById('unassignedQuickAddInput').value = name || 'Some new ask';
  saveInlineQuickAddItem();
  return items[items.length - 1];
}

test('openInlineQuickAdd/saveInlineQuickAddItem creates an Unassigned item in the Pending category with its one milestone', function () {
  const it = addPendingItem('Some new ask');
  assertEqual(items.length, 1);
  assertEqual(it.name, 'Some new ask');
  assertEqual(it.workstreamId, null);
  assertTrue(isPendingCategory(it.categoryId));
  assertEqual(it.milestones.length, 1);
  assertEqual(it.milestones[0].name, 'Scope Item Confirmed');
  assertEqual(it.milestones[0].status, 'pending');
  assertEqual(it.status, 'pending');
  assertFalse(unassignedQuickAddOpen, 'the input should have closed back to the button after saving');
});

// A user-reported bug: a freshly quick-added item's one milestone
// ("Scope Item Confirmed") is always seeded Pending/dateless, so there is
// genuinely nothing planned yet — but this function used to fall back to
// today's date for the item's own startDate/dueDate when it had nothing to
// compute a range from, which meant every quick-added item silently got a
// real due date at creation and read as Overdue on the Dashboard the very
// next day, despite still being entirely un-triaged. See
// computedDateRangeFromMilestones()'s own comment in pulse.html.
test('saveInlineQuickAddItem creates an item with no date planned at all (startDate/dueDate both null), not today\'s date', function () {
  const it = addPendingItem('Some new ask');
  assertEqual(it.startDate, null, 'must not silently default to today\'s date');
  assertEqual(it.dueDate, null);
});

test('saveInlineQuickAddItem closes the input without creating anything when the name is blank', function () {
  openInlineQuickAdd();
  document.getElementById('unassignedQuickAddInput').value = '   ';
  saveInlineQuickAddItem();
  assertEqual(items.length, 0);
  assertFalse(unassignedQuickAddOpen);
});

test('cancelInlineQuickAdd (Escape) discards whatever was typed, closing the input', function () {
  openInlineQuickAdd();
  document.getElementById('unassignedQuickAddInput').value = 'Abandoned draft';
  cancelInlineQuickAdd();
  assertEqual(items.length, 0);
  assertFalse(unassignedQuickAddOpen);
});

test('saveInlineQuickAddItem is a no-op if called again after it already closed things (Enter followed by the resulting blur)', function () {
  openInlineQuickAdd();
  document.getElementById('unassignedQuickAddInput').value = 'Typed once';
  saveInlineQuickAddItem(); // e.g. Enter
  assertEqual(items.length, 1);
  saveInlineQuickAddItem(); // e.g. the blur that same render() triggers by tearing out the focused input
  assertEqual(items.length, 1, 'a second call after the input already closed must not create a duplicate');
});

test('unassignedItemsSorted only returns items with no workstream, ordered by their own `order`', function () {
  addPendingItem('First');
  addPendingItem('Second');
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'Assigned', owner: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], order: 0, updatedAt: Date.now() });
  const names = unassignedItemsSorted().map(it => it.name);
  assertDeepEqual(names, ['First', 'Second']);
});

test('openInlineQuickAdd/saveInlineQuickAddItem are blocked below Editor', function () {
  userRole = 'reviewer';
  openInlineQuickAdd();
  assertFalse(unassignedQuickAddOpen);
});

test('marking a Pending item\'s "Scope Item Confirmed" milestone Complete auto-opens the scope-assign modal', function () {
  const it = addPendingItem();
  const mId = it.milestones[0].id;
  scopeAssignItemId = null;
  cycleMilestoneStatus(it.id, mId); // pending -> not-started
  cycleMilestoneStatus(it.id, mId); // -> green
  assertEqual(scopeAssignItemId, null, 'not complete yet — should not have opened');
  cycleMilestoneStatus(it.id, mId); // -> amber
  cycleMilestoneStatus(it.id, mId); // -> red
  cycleMilestoneStatus(it.id, mId); // -> complete
  assertEqual(it.status, 'complete');
  assertEqual(scopeAssignItemId, it.id, 'the scope-assign modal should have opened for this item');
  assertTrue(document.getElementById('scopeAssignModalBg').classList.contains('open'));
});

test('the scope-assign modal does not re-open on an unrelated save once already Complete', function () {
  const it = addPendingItem();
  cycleMilestoneStatus(it.id, it.milestones[0].id); // pending -> not-started
  cycleMilestoneStatus(it.id, it.milestones[0].id); // -> green
  cycleMilestoneStatus(it.id, it.milestones[0].id); // -> amber
  cycleMilestoneStatus(it.id, it.milestones[0].id); // -> red
  cycleMilestoneStatus(it.id, it.milestones[0].id); // -> complete, opens the modal
  closeScopeAssignModal();
  openItemModal(it.id);
  document.getElementById('itemCategorySelect').value = it.categoryId;
  document.getElementById('itemOwnerInput').value = 'Jamie';
  saveItem();
  assertEqual(scopeAssignItemId, null, 'saving an unrelated field change should not re-trigger the prompt');
  assertFalse(document.getElementById('scopeAssignModalBg').classList.contains('open'));
});

test('marking the milestone Complete via the full item modal\'s dropdown also triggers the scope-assign prompt', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  // The fake DOM's <select>.innerHTML is an opaque string — marking an
  // <option> "selected" in it (as populateCategorySelect() does) doesn't
  // also update .value the way a real browser would, so it's set explicitly
  // here, same convention as fillItemForm() in items.test.js.
  document.getElementById('itemCategorySelect').value = it.categoryId;
  editingMilestones[0].status = 'complete';
  saveItem();
  assertEqual(scopeAssignItemId, it.id);
  assertTrue(document.getElementById('scopeAssignModalBg').classList.contains('open'));
});

test('openScopeAssignModal populates the workstream select (with nothing preselected for an Unassigned item) and offers every category except Pending', function () {
  const it = addPendingItem();
  openScopeAssignModal(it.id);
  const wsHtml = document.getElementById('scopeAssignWorkstreamSelect').innerHTML;
  workstreams.forEach(w => assertIncludes(wsHtml, `value="${w.id}"`));
  assertNotIncludes(wsHtml, 'selected', 'an Unassigned item has no workstream to preselect');
  const catHtml = document.getElementById('scopeAssignCategorySelect').innerHTML;
  categories.filter(c => !c.pending).forEach(c => assertIncludes(catHtml, `value="${c.id}"`));
  const pendingCat = categories.find(c => c.pending);
  assertNotIncludes(catHtml, `value="${pendingCat.id}"`, 'Pending itself must never be offered as a destination category');
});

// ---------- A Pending (Unassigned) item can be deleted like any other ----------
// An explicit user request: deleteItem() used to refuse a still-Pending item
// outright (toast, no confirm modal) so it couldn't be lost before ever
// getting a real workstream/category — that guard was later removed at the
// user's own request, so a not-yet-triaged item is deletable the same way
// as any other now.

test('deleteItem allows deleting a still-Pending (Unassigned) item, going through the normal confirm modal', function () {
  const it = addPendingItem();
  const before = items.length;
  deleteItem(it.id);
  assertTrue(!!modalTarget, 'the normal confirm modal should open, same as for any other item');
  confirmModalAction();
  assertEqual(items.length, before - 1);
});

test('deleteItem still works normally once an item has a real category (post scope-assign)', function () {
  const it = addPendingItem();
  const realCat = categories.find(c => !c.pending);
  applyScopeCategory(it.id, workstreams[0].id, realCat.id);
  deleteItem(it.id);
  confirmModalAction();
  assertEqual(items.length, 0);
});

test('deleteItemFromModal also deletes a Pending item, reached through the modal', function () {
  const it = addPendingItem();
  editingItemId = it.id;
  deleteItemFromModal();
  confirmModalAction();
  assertEqual(items.length, 0);
});

// A user-reported follow-up to the deleteItem() guard above: removing the
// Pending item's own milestone from inside the full edit modal left it
// stuck Pending with nothing left for maybeOfferScopeAssign() to watch, the
// same underlying problem as deleting the whole item.

test('removeMilestoneRow refuses to remove a Pending item\'s milestone from the modal', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  const before = editingMilestones.length;
  removeMilestoneRow(0);
  assertEqual(editingMilestones.length, before, 'the milestone should survive the attempted removal');
});

test('renderMilestonesEditor renders a Pending item\'s Remove button as inert, not clickable', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  const html = document.getElementById('milestonesEditor').innerHTML;
  assertNotIncludes(html, 'onclick="removeMilestoneRow', 'no clickable Remove control should render for a Pending item\'s milestone');
});

// Regression tests for an explicit user request: "do not allow to disable
// the one 'Scope Item Confirmed' milestone for Pending tasks" — marking it
// Not Applicable would clear its Due/Actual dates and freeze its status
// badge, permanently stranding the item in Pending with no way to trigger
// maybeOfferScopeAssign() at all.

test('toggleMilestoneNotApplicable refuses to mark a Pending item\'s milestone Not Applicable, from the status board', function () {
  const it = addPendingItem();
  toggleMilestoneNotApplicable(it.id, it.milestones[0].id);
  assertFalse(it.milestones[0].notApplicable, 'the toggle must be blocked while the item is still Pending');
});

test('milestoneRowsHtml renders a Pending item\'s Not Applicable toggle as inert, not clickable', function () {
  const it = addPendingItem();
  expandedItemIds.add(it.id);
  const html = milestoneRowsHtml(it);
  assertNotIncludes(html, 'onclick="toggleMilestoneNotApplicable', 'no clickable N/A toggle should render for a Pending item\'s milestone');
});

test('toggleEditingMilestoneNotApplicable refuses to mark a Pending item\'s milestone Not Applicable, from the item modal', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  toggleEditingMilestoneNotApplicable(0);
  assertFalse(editingMilestones[0].notApplicable, 'the toggle must be blocked while the item is still Pending');
});

test('renderMilestonesEditor renders a Pending item\'s Not Applicable toggle as inert, not clickable', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  const html = document.getElementById('milestonesEditor').innerHTML;
  assertNotIncludes(html, 'onclick="toggleEditingMilestoneNotApplicable', 'no clickable N/A toggle should render for a Pending item\'s milestone');
});

test('the Not Applicable toggle works normally again once a Pending item has been scope-assigned to a real category', function () {
  const it = addPendingItem();
  const realCat = categories.find(c => !c.pending);
  applyScopeCategory(it.id, workstreams[0].id, realCat.id);
  const mId = it.milestones[0].id;
  toggleMilestoneNotApplicable(it.id, mId);
  assertTrue(it.milestones[0].notApplicable, 'the toggle should work normally once the item has a real category');
});

// Regression tests for an explicit user request: "remove for unassigned
// items External Delivery and Actual Completion date" — neither is
// meaningful yet, since the item hasn't been scope-assigned to a real
// workstream/category at all.

test('openItemModal hides Actual completion date and External Delivery for a Pending item', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  assertEqual(document.getElementById('itemActualField').style.display, 'none');
  assertEqual(document.getElementById('itemDependencyField').style.display, 'none');
  assertEqual(document.getElementById('itemDependencySpocField').style.display, 'none');
});

test('openItemModal shows Actual completion date and External Delivery again once an item has a real category (post scope-assign)', function () {
  const it = addPendingItem();
  const realCat = categories.find(c => !c.pending);
  applyScopeCategory(it.id, workstreams[0].id, realCat.id);
  openItemModal(it.id);
  assertEqual(document.getElementById('itemActualField').style.display, '');
  assertEqual(document.getElementById('itemDependencyField').style.display, '');
});

test('openItemModal shows both fields for a brand-new item (never Pending to begin with)', function () {
  openItemModal(null, workstreams[0].id);
  assertEqual(document.getElementById('itemActualField').style.display, '');
  assertEqual(document.getElementById('itemDependencyField').style.display, '');
});

test('removeMilestoneRow works normally on a non-Pending item\'s milestones', function () {
  const it = addItem({
    name: 'Real item',
    milestones: [
      { id: 'm1', name: 'A', dueDate: todayStr(), status: 'not-started', actualDate: null },
      { id: 'm2', name: 'B', dueDate: todayStr(), status: 'not-started', actualDate: null }
    ]
  });
  openItemModal(it.id);
  removeMilestoneRow(0);
  assertEqual(editingMilestones.length, 1);
  assertEqual(editingMilestones[0].name, 'B');
});

// Regression tests for an explicit user request: "prevent change category
// from unassigned scope items. They must remain pending. Only the
// assignment process triggered by completed can change it."

test('openItemModal disables the Category select for a Pending item, even at Editor+', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  assertTrue(document.getElementById('itemCategorySelect').disabled, 'the category select must be locked while the item is still Pending');
});

test('openItemModal leaves the Category select editable once an item has a real category (post scope-assign)', function () {
  const it = addPendingItem();
  const realCat = categories.find(c => !c.pending);
  applyScopeCategory(it.id, workstreams[0].id, realCat.id);
  openItemModal(it.id);
  assertFalse(document.getElementById('itemCategorySelect').disabled);
});

test('saveItem forces a Pending item\'s categoryId to stay Pending, even if the (disabled) select somehow reports a different value', function () {
  const it = addPendingItem();
  const pendingCatId = it.categoryId;
  const realCat = categories.find(c => !c.pending);
  openItemModal(it.id);
  document.getElementById('itemCategorySelect').value = realCat.id; // simulates bypassing the disabled attribute
  saveItem();
  assertEqual(it.categoryId, pendingCatId, 'only applyScopeCategory() may move an item out of Pending');
});

// Regression tests for a later, explicit user request: "do not allow to
// assign a workstream to a pending scope item" — the identical lock as
// Category above, applied to Workstream for the identical reason.

test('openItemModal disables the Workstream select for a Pending item, even at Editor+', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  assertTrue(document.getElementById('itemWorkstreamSelect').disabled, 'the workstream select must be locked while the item is still Pending');
});

test('openItemModal leaves the Workstream select editable once an item has a real category (post scope-assign)', function () {
  const it = addPendingItem();
  const realCat = categories.find(c => !c.pending);
  applyScopeCategory(it.id, workstreams[0].id, realCat.id);
  openItemModal(it.id);
  assertFalse(document.getElementById('itemWorkstreamSelect').disabled);
});

test('saveItem forces a Pending item\'s workstreamId to stay Unassigned, even if the (disabled) select somehow reports a different value', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  document.getElementById('itemWorkstreamSelect').value = workstreams[0].id; // simulates bypassing the disabled attribute
  saveItem();
  assertEqual(it.workstreamId, null, 'only applyScopeCategory() may move an item out of Unassigned');
});

// The scope-assign modal's own "no Later button, no Escape/backdrop
// dismiss" behavior lives entirely in static HTML markup and the global
// keydown/click listeners at the bottom of the script — neither is
// something this JXA harness can observe (it only extracts and evals the
// inline <script> block's own function bodies against fake DOM stubs; the
// real <body> markup and the harness's own no-op addEventListener() mean
// there's no static HTML or real event dispatch to assert against here).
// Verified manually in a real browser instead — see CLAUDE.md's own note
// on this change.

test('removeMilestoneRow works again once a Pending item has been scope-assigned to a real category', function () {
  const it = addPendingItem();
  const realCat = categories.find(c => !c.pending);
  applyScopeCategory(it.id, workstreams[0].id, realCat.id);
  openItemModal(it.id);
  const before = editingMilestones.length;
  removeMilestoneRow(0);
  assertEqual(editingMilestones.length, before - 1);
});

test('applyScopeCategory sets the item\'s workstream (out of Unassigned) and category, and swaps in that category\'s full milestone template', function () {
  const secondWs = { id: genId(), name: 'Second', color: 'teal', order: 1 };
  workstreams.push(secondWs);
  const it = addPendingItem();
  const oldMilestoneId = it.milestones[0].id;
  const devCat = categories.find(c => c.name === 'Development');
  applyScopeCategory(it.id, secondWs.id, devCat.id);
  assertEqual(it.workstreamId, secondWs.id);
  assertEqual(it.categoryId, devCat.id);
  assertDeepEqual(it.milestones.map(m => m.name), DEFAULT_CATEGORY_MILESTONES);
  it.milestones.forEach(m => assertEqual(m.status, 'pending'));
  assertTrue(deletedMilestoneIds.some(x => x.id === oldMilestoneId), 'the discarded Pending checklist milestone should be tombstoned');
});

test('applyScopeCategory lands the item at the end of the target workstream\'s own list, not wherever its order happened to be in Unassigned', function () {
  const ws = workstreams[0];
  const existingA = { id: genId(), workstreamId: ws.id, categoryId: categories[0].id, name: 'Existing A', status: 'not-started', startDate: '2026-01-01', dueDate: '2026-01-01', actualDate: null, milestones: [], itStatus: 'green', businessStatus: 'green', budgetStatus: 'green', order: 0, updatedAt: Date.now(), itemType: 'scope' };
  const existingB = { id: genId(), workstreamId: ws.id, categoryId: categories[0].id, name: 'Existing B', status: 'not-started', startDate: '2026-01-01', dueDate: '2026-01-01', actualDate: null, milestones: [], itStatus: 'green', businessStatus: 'green', budgetStatus: 'green', order: 1, updatedAt: Date.now(), itemType: 'scope' };
  items.push(existingA, existingB);
  // A quick-added item always starts at order 0 in Unassigned (it's the
  // first/only item there) — the exact order value that used to collide
  // with an already-real order-0 item once assigned into a workstream.
  const it = addPendingItem();
  assertEqual(it.order, 0);
  const devCat = categories.find(c => c.name === 'Development');
  applyScopeCategory(it.id, ws.id, devCat.id);
  assertEqual(it.order, 2, 'should land after both existing items, not tie with Existing A at order 0');
});

test('applyScopeAssign reads the modal\'s selects and applies them, then closes the modal', function () {
  const it = addPendingItem();
  const devCat = categories.find(c => c.name === 'Development');
  openScopeAssignModal(it.id);
  document.getElementById('scopeAssignWorkstreamSelect').value = workstreams[0].id;
  document.getElementById('scopeAssignCategorySelect').value = devCat.id;
  applyScopeAssign();
  assertEqual(it.workstreamId, workstreams[0].id);
  assertEqual(it.categoryId, devCat.id);
  assertFalse(document.getElementById('scopeAssignModalBg').classList.contains('open'));
  assertEqual(scopeAssignItemId, null);
});

// Regression tests for a user-reported dead end: this modal has no dismiss
// path at all (see its own HTML comment), so with zero workstreams the
// plain Workstream select used to render with no <option>s, and Apply — the
// only way to close the modal — silently wrote an invalid, non-null
// workstreamId onto the item.

test('openScopeAssignModal shows the "create one to continue" prompt instead of the select, and disables Apply, when there are no workstreams', function () {
  workstreams = []; items = [];
  const it = addPendingItem();
  openScopeAssignModal(it.id);
  assertEqual(document.getElementById('scopeAssignWorkstreamField').style.display, 'none');
  assertEqual(document.getElementById('scopeAssignNoWorkstreamsField').style.display, '');
  assertTrue(document.getElementById('scopeAssignApplyBtn').disabled);
});

test('applyScopeAssign refuses to run while there are no workstreams, even if called directly (bypassing the disabled Apply button)', function () {
  workstreams = []; items = [];
  const it = addPendingItem();
  openScopeAssignModal(it.id);
  applyScopeAssign();
  assertEqual(it.workstreamId, null, 'must not have been set to the empty-select sentinel');
  assertTrue(document.getElementById('scopeAssignModalBg').classList.contains('open'), 'the modal must stay open — nothing valid was applied');
  assertEqual(scopeAssignItemId, it.id);
});

test('creating a workstream via the modal\'s "New workstream" button refreshes it back to the normal select, preselecting the one just created', function () {
  workstreams = []; items = [];
  const it = addPendingItem();
  openScopeAssignModal(it.id);
  openWorkstreamModal(null); // the "+ New workstream" button's own onclick
  document.getElementById('wsNameInput').value = 'First Workstream';
  saveWorkstream();
  assertEqual(workstreams.length, 1);
  assertFalse(document.getElementById('wsModalBg').classList.contains('open'), 'the nested workstream modal should have closed itself');
  assertTrue(document.getElementById('scopeAssignModalBg').classList.contains('open'), 'the scope-assign modal must still be open underneath — it has no dismiss path');
  assertEqual(document.getElementById('scopeAssignWorkstreamField').style.display, '', 'back to the real select now that a workstream exists');
  assertEqual(document.getElementById('scopeAssignNoWorkstreamsField').style.display, 'none');
  assertFalse(document.getElementById('scopeAssignApplyBtn').disabled);
  assertIncludes(document.getElementById('scopeAssignWorkstreamSelect').innerHTML, `value="${workstreams[0].id}" selected`, 'the newly created workstream should be preselected');
});

test('the full flow works end to end: create the first workstream from inside scope-assign, then Apply', function () {
  workstreams = []; items = [];
  const it = addPendingItem();
  openScopeAssignModal(it.id);
  openWorkstreamModal(null);
  document.getElementById('wsNameInput').value = 'Ops';
  saveWorkstream();
  // The fake <select>'s innerHTML doesn't parse into .value the way a real
  // browser's would (see CLAUDE.md's "Tests" section) — the option really
  // is marked selected in the rendered HTML (covered by the test right
  // above this one), this is purely a harness limitation.
  document.getElementById('scopeAssignWorkstreamSelect').value = workstreams[0].id;
  document.getElementById('scopeAssignCategorySelect').value = categories.find(c => !c.pending).id;
  applyScopeAssign();
  assertEqual(it.workstreamId, workstreams[0].id);
  assertFalse(document.getElementById('scopeAssignModalBg').classList.contains('open'));
});

test('saveWorkstream does not touch the scope-assign modal state when it is not the caller (the normal sidebar/edit-pencil flow)', function () {
  const it = addPendingItem();
  openWorkstreamModal(null);
  document.getElementById('wsNameInput').value = 'Second Workstream';
  saveWorkstream();
  assertFalse(document.getElementById('scopeAssignModalBg').classList.contains('open'), 'never opened in this test, must stay closed');
  assertEqual(scopeAssignItemId, null);
});

test('itemRowHtml routes a Pending-and-Complete item\'s status badge to openScopeAssignModal instead of openItemModal', function () {
  const it = addPendingItem();
  cycleMilestoneStatus(it.id, it.milestones[0].id); // pending -> not-started
  cycleMilestoneStatus(it.id, it.milestones[0].id); // -> green
  cycleMilestoneStatus(it.id, it.milestones[0].id); // -> amber
  cycleMilestoneStatus(it.id, it.milestones[0].id); // -> red
  cycleMilestoneStatus(it.id, it.milestones[0].id); // -> complete
  closeScopeAssignModal();
  const html = itemRowHtml(it);
  // The pencil "Edit" button (item-actions) still legitimately opens the
  // full item modal regardless — only the status-badge cell itself should
  // have switched targets.
  assertIncludes(html, `class="status-badge" style="background:var(--stat-complete-bg);color:var(--stat-complete)" onclick="openScopeAssignModal('${it.id}')"`);
});

test('itemRowHtml uses the normal openItemModal status badge for a not-yet-complete Pending item', function () {
  const it = addPendingItem();
  const html = itemRowHtml(it);
  assertIncludes(html, `class="status-badge" style="background:var(--stat-pending-bg);color:var(--stat-pending)" onclick="openItemModal('${it.id}')"`);
  assertNotIncludes(html, 'openScopeAssignModal');
});

// ---------- The Unassigned section itself (renderStatusView()/unassignedSectionHtml()) ----------

test('unassignedSectionHtml shows the inline Add-item button (not the input) by default, for an Editor', function () {
  const html = unassignedSectionHtml();
  assertIncludes(html, 'Unassigned');
  assertIncludes(html, `onclick="openInlineQuickAdd()"`);
  assertNotIncludes(html, 'id="unassignedQuickAddInput"');
});

test('unassignedSectionHtml renders an inbox icon in its header, in place of a (non-existent) workstream color dot', function () {
  const html = unassignedSectionHtml();
  assertIncludes(html, 'fa-inbox');
  assertIncludes(html, 'title="Unassigned"');
});

test('unassignedSectionHtml shows the input once opened', function () {
  openInlineQuickAdd();
  const html = unassignedSectionHtml();
  assertIncludes(html, 'id="unassignedQuickAddInput"');
});

test('unassignedSectionHtml is omitted entirely below Editor when there are no unassigned items', function () {
  userRole = 'reviewer';
  assertEqual(unassignedSectionHtml(), '');
});

test('unassignedSectionHtml still shows (read-only) below Editor once there is at least one unassigned item', function () {
  const it = addPendingItem();
  userRole = 'reviewer';
  const html = unassignedSectionHtml();
  assertIncludes(html, it.name);
  assertNotIncludes(html, 'openInlineQuickAdd', 'no add affordance below Editor');
});

test('renderMain places the Unassigned section above the real workstream sections, and shows it regardless of the sidebar filter', function () {
  addPendingItem('Needs triage');
  setFilterWorkstream(workstreams[0].id);
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Needs triage');
  assertTrue(html.indexOf('Unassigned') < html.indexOf(workstreams[0].name), 'Unassigned should render first');
});

test('renderMain shows the Unassigned add-item entry point even with zero workstreams', function () {
  workstreams = []; items = [];
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Unassigned');
  assertIncludes(html, 'No workstreams yet');
});
