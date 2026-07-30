// ---------- Quick-add scope items & the reserved Pending category ----------
// See "Quick-add scope items & the Pending category" in pulse.html and
// CLAUDE.md. The Unassigned section's inline "+ Add item" (see
// unassignedSectionHtml()) is a deliberately minimal, name-only capture —
// no modal, no workstream picker. The new item is seeded with no workstream
// at all (workstreamId: null — "Unassigned") and straight into the reserved
// Pending category with its one milestone, "Scope item confirmed". Marking
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
  assertEqual(it.milestones[0].name, 'Scope item confirmed');
  assertEqual(it.milestones[0].status, 'not-started');
  assertEqual(it.status, 'not-started');
  assertFalse(unassignedQuickAddOpen, 'the input should have closed back to the button after saving');
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

test('marking a Pending item\'s "Scope item confirmed" milestone Complete auto-opens the scope-assign modal', function () {
  const it = addPendingItem();
  const mId = it.milestones[0].id;
  scopeAssignItemId = null;
  cycleMilestoneStatus(it.id, mId); // not-started -> green
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

// ---------- A Pending item can't be deleted before it's triaged ----------
// An explicit user request: deleteItem() is the one function behind both the
// row's own trash icon and the full edit modal's Delete button (see
// deleteItemFromModal()), so guarding it here blocks both without needing a
// second check anywhere else — same "refuse outright with a toast, don't
// even open the confirm modal" shape deleteCategoryFromModal() already uses
// for the Pending category itself.

test('deleteItem refuses to delete a Pending-category item outright, with a toast, before the confirm modal ever opens', function () {
  const it = addPendingItem();
  const before = items.length;
  deleteItem(it.id);
  assertEqual(items.length, before, 'nothing should be removed');
  assertFalse(!!modalTarget, 'the confirm modal should never even open for a Pending item');
});

test('deleteItem still works normally once an item has a real category (post scope-assign)', function () {
  const it = addPendingItem();
  const realCat = categories.find(c => !c.pending);
  applyScopeCategory(it.id, workstreams[0].id, realCat.id);
  deleteItem(it.id);
  confirmModalAction();
  assertEqual(items.length, 0);
});

test('deleteItemFromModal is also blocked for a Pending item (same guard, reached through the modal)', function () {
  const it = addPendingItem();
  editingItemId = it.id;
  deleteItemFromModal();
  assertEqual(items.length, 1, 'the item should survive — deleteItem()\'s own guard still applies');
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
  it.milestones.forEach(m => assertEqual(m.status, 'not-started'));
  assertTrue(deletedMilestoneIds.some(x => x.id === oldMilestoneId), 'the discarded Pending checklist milestone should be tombstoned');
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

test('itemRowHtml routes a Pending-and-Complete item\'s status badge to openScopeAssignModal instead of openItemModal', function () {
  const it = addPendingItem();
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
  assertIncludes(html, `class="status-badge" style="background:var(--stat-not-started-bg);color:var(--stat-not-started)" onclick="openItemModal('${it.id}')"`);
  assertNotIncludes(html, 'openScopeAssignModal');
});

// ---------- The Unassigned section itself (renderStatusView()/unassignedSectionHtml()) ----------

test('unassignedSectionHtml shows the inline Add-item button (not the input) by default, for an Editor', function () {
  const html = unassignedSectionHtml();
  assertIncludes(html, 'Unassigned');
  assertIncludes(html, `onclick="openInlineQuickAdd()"`);
  assertNotIncludes(html, 'id="unassignedQuickAddInput"');
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
