// ---------- Quick-add scope items & the reserved Pending category ----------
// See "Quick-add scope items & the Pending category" in pulse.html and
// CLAUDE.md. "Add item" opens openQuickAddItemModal() instead of the full
// item modal — just Name and Workstream — and seeds the new item into the
// reserved Pending category with its one milestone, "Scope item confirmed".
// Marking that milestone Complete pops up openScopeAssignModal() to pick the
// item's real workstream/category, which applyScopeCategory() then applies.

test('openQuickAddItemModal/saveQuickAddItem creates an item in the Pending category with its one milestone', function () {
  openQuickAddItemModal(workstreams[0].id);
  document.getElementById('quickAddNameInput').value = 'Some new ask';
  // The fake DOM's <select>.innerHTML is an opaque string — marking an
  // <option> "selected" in it (as openQuickAddItemModal()'s populate call
  // does) doesn't also update .value the way a real browser would, so every
  // test here sets .value explicitly, same convention as fillItemForm() in
  // items.test.js.
  document.getElementById('quickAddWorkstreamSelect').value = workstreams[0].id;
  saveQuickAddItem();
  assertEqual(items.length, 1);
  const it = items[0];
  assertEqual(it.name, 'Some new ask');
  assertEqual(it.workstreamId, workstreams[0].id);
  assertTrue(isPendingCategory(it.categoryId));
  assertEqual(it.milestones.length, 1);
  assertEqual(it.milestones[0].name, 'Scope item confirmed');
  assertEqual(it.milestones[0].status, 'not-started');
  assertEqual(it.status, 'not-started');
});

test('saveQuickAddItem rejects an empty name', function () {
  openQuickAddItemModal(workstreams[0].id);
  document.getElementById('quickAddNameInput').value = '   ';
  saveQuickAddItem();
  assertEqual(items.length, 0);
});

test('openQuickAddItemModal presets the workstream select, but it can still be changed before saving', function () {
  const secondWs = { id: genId(), name: 'Second', color: 'teal', order: 1 };
  workstreams.push(secondWs);
  openQuickAddItemModal(workstreams[0].id);
  assertIncludes(document.getElementById('quickAddWorkstreamSelect').innerHTML, `value="${workstreams[0].id}" selected`);
  document.getElementById('quickAddWorkstreamSelect').value = secondWs.id;
  document.getElementById('quickAddNameInput').value = 'X';
  saveQuickAddItem();
  assertEqual(items[0].workstreamId, secondWs.id);
});

test('closeQuickAddItemModal is a no-op that discards nothing (nothing is created until Save)', function () {
  openQuickAddItemModal(workstreams[0].id);
  document.getElementById('quickAddNameInput').value = 'Abandoned draft';
  closeQuickAddItemModal();
  assertEqual(items.length, 0);
});

function addPendingItem(name) {
  openQuickAddItemModal(workstreams[0].id);
  document.getElementById('quickAddNameInput').value = name || 'Some new ask';
  document.getElementById('quickAddWorkstreamSelect').value = workstreams[0].id;
  saveQuickAddItem();
  return items[items.length - 1];
}

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
  document.getElementById('itemWorkstreamSelect').value = it.workstreamId;
  document.getElementById('itemCategorySelect').value = it.categoryId;
  document.getElementById('itemOwnerInput').value = 'Jamie';
  saveItem();
  assertEqual(scopeAssignItemId, null, 'saving an unrelated field change should not re-trigger the prompt');
  assertFalse(document.getElementById('scopeAssignModalBg').classList.contains('open'));
});

test('marking the milestone Complete via the full item modal\'s dropdown also triggers the scope-assign prompt', function () {
  const it = addPendingItem();
  openItemModal(it.id);
  // Same fake-DOM caveat as addPendingItem() above — populateWorkstreamSelect()/
  // populateCategorySelect() mark the right <option> "selected" in the
  // innerHTML string, but the harness's <select>.value doesn't follow that;
  // it must be set explicitly so saveItem() persists the item's real
  // workstream/category rather than the fake element's default ''.
  document.getElementById('itemWorkstreamSelect').value = it.workstreamId;
  document.getElementById('itemCategorySelect').value = it.categoryId;
  editingMilestones[0].status = 'complete';
  saveItem();
  assertEqual(scopeAssignItemId, it.id);
  assertTrue(document.getElementById('scopeAssignModalBg').classList.contains('open'));
});

test('openScopeAssignModal populates the workstream select and offers every category except Pending', function () {
  const it = addPendingItem();
  openScopeAssignModal(it.id);
  assertIncludes(document.getElementById('scopeAssignWorkstreamSelect').innerHTML, `value="${workstreams[0].id}" selected`);
  const html = document.getElementById('scopeAssignCategorySelect').innerHTML;
  categories.filter(c => !c.pending).forEach(c => assertIncludes(html, `value="${c.id}"`));
  const pendingCat = categories.find(c => c.pending);
  assertNotIncludes(html, `value="${pendingCat.id}"`, 'Pending itself must never be offered as a destination category');
});

test('applyScopeCategory swaps in the chosen workstream/category and that category\'s full milestone template', function () {
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

test('openQuickAddItemModal/openScopeAssignModal are both blocked below Editor', function () {
  const it = addPendingItem();
  userRole = 'reviewer';
  openQuickAddItemModal(workstreams[0].id);
  assertFalse(document.getElementById('quickAddItemModalBg').classList.contains('open'));
  openScopeAssignModal(it.id);
  assertFalse(document.getElementById('scopeAssignModalBg').classList.contains('open'));
});
