test('seedDefaults creates the out-of-the-box DEFAULT_CATEGORIES, plus the reserved Pending and Journey categories', function () {
  assertEqual(categories.length, DEFAULT_CATEGORIES.length + 2);
  DEFAULT_CATEGORIES.forEach((c, i) => {
    assertEqual(categories[i].name, c.name);
    assertDeepEqual(categories[i].milestones, c.milestones);
  });
  const pendingCat = categories.find(c => c.pending);
  assertEqual(pendingCat.name, 'Pending');
  assertTrue(pendingCat.pending);
  assertDeepEqual(pendingCat.milestones, ['Scope item confirmed']);
  const journeyCat = categories.find(c => c.journey);
  assertEqual(journeyCat.name, 'Journey');
  assertTrue(journeyCat.journey);
  assertDeepEqual(journeyCat.milestones, JOURNEY_DEFAULT_MILESTONES);
});

test('normalizeData seeds the default categories if none exist, and always ensures a Pending and a Journey one too', function () {
  categories = [];
  normalizeData();
  assertEqual(categories.length, DEFAULT_CATEGORIES.length + 2);
  assertEqual(categories[0].name, DEFAULT_CATEGORIES[0].name);
  assertTrue(categories.some(c => c.pending));
  assertTrue(categories.some(c => c.journey));
});

test('normalizeData adds back missing Pending and Journey categories on an older save that predates them', function () {
  categories = [{ id: genId(), name: 'Development', milestones: DEFAULT_CATEGORY_MILESTONES.slice(), order: 0 }];
  normalizeData();
  assertEqual(categories.length, 3);
  assertTrue(categories.some(c => c.pending), 'a save from before the Pending category existed should get one added back');
  assertTrue(categories.some(c => c.journey), 'a save from before the Journey category existed should get one added back');
});

test('normalizeData reassigns an item whose category no longer exists', function () {
  items.push({ id: genId(), workstreamId: workstreams[0].id, categoryId: 'does-not-exist', name: 'X', dueDate: todayStr(), startDate: todayStr(), milestones: [] });
  normalizeData();
  assertEqual(items[0].categoryId, categories[0].id);
});

test('a new item defaults to the first category and its milestone template', function () {
  openItemModal(null);
  assertIncludes(document.getElementById('itemCategorySelect').innerHTML, `value="${categories[0].id}" selected`);
  assertEqual(editingMilestones.length, categories[0].milestones.length);
});

test('saveItem persists the chosen categoryId', function () {
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed', 'Kickoff call'];
  saveCategory();
  const newCat = categories[categories.length - 1]; // saveCategory() always appends new categories at the end
  openItemModal(null);
  document.getElementById('itemCategorySelect').value = newCat.id;
  document.getElementById('itemNameInput').value = 'Onboard Acme';
  document.getElementById('itemWorkstreamSelect').value = workstreams[0].id;
  saveItem();
  assertEqual(items[0].categoryId, newCat.id);
});

test('onItemCategoryChange reseeds milestones from the new category while creating an item', function () {
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed', 'Kickoff call'];
  saveCategory();
  const newCat = categories[categories.length - 1]; // saveCategory() always appends new categories at the end
  openItemModal(null);
  assertEqual(editingMilestones.length, categories[0].milestones.length);
  document.getElementById('itemCategorySelect').value = newCat.id;
  onItemCategoryChange();
  assertEqual(editingMilestones.length, 2);
  assertEqual(editingMilestones[0].name, 'Contract signed');
});

test('onItemCategoryChange does nothing while editing an existing item (never resets a customized checklist)', function () {
  openItemModal(null);
  document.getElementById('itemNameInput').value = 'Existing item';
  document.getElementById('itemWorkstreamSelect').value = workstreams[0].id;
  saveItem();
  const id = items[0].id;
  items[0].milestones = items[0].milestones.slice(0, 1); // simulate a customized checklist
  openItemModal(id);
  assertEqual(editingMilestones.length, 1);
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed'];
  saveCategory();
  document.getElementById('itemCategorySelect').value = categories[categories.length - 1].id; // the one just created
  onItemCategoryChange();
  assertEqual(editingMilestones.length, 1, 'editing an existing item should not reseed its milestones on category change');
});

test('saveCategory adds a new category, and edits an existing one in place', function () {
  const baseCount = categories.length;
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed', 'Kickoff call'];
  saveCategory();
  assertEqual(categories.length, baseCount + 1);
  const newCat = categories[categories.length - 1];
  openCategoryModal(newCat.id);
  document.getElementById('categoryNameInput').value = 'Renamed Category';
  saveCategory();
  assertEqual(categories.length, baseCount + 1);
  assertEqual(categories[categories.length - 1].name, 'Renamed Category');
});

test('saveCategory rejects an empty name', function () {
  const before = categories.length;
  document.getElementById('categoryNameInput').value = '   ';
  saveCategory();
  assertEqual(categories.length, before);
});

test('deleteCategoryFromModal reassigns items using it to the fallback category', function () {
  const baseCount = categories.length;
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed'];
  saveCategory();
  const newCat = categories[categories.length - 1]; // the one just created
  const it = { id: genId(), workstreamId: workstreams[0].id, categoryId: newCat.id, name: 'X', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);
  editingCategoryId = newCat.id;
  deleteCategoryFromModal();
  confirmModalAction();
  assertEqual(categories.length, baseCount);
  assertEqual(items[0].categoryId, categories[0].id);
});

test('deleteCategoryFromModal refuses to delete the last remaining non-Pending, non-Journey category', function () {
  // Delete every non-Pending, non-Journey category but one, to actually
  // reach the guarded scenario — DEFAULT_CATEGORIES seeds several, not just
  // one, these days.
  categories.filter(c => !c.pending && !c.journey).slice(1).forEach(c => {
    editingCategoryId = c.id;
    deleteCategoryFromModal();
    confirmModalAction();
  });
  assertEqual(categories.filter(c => !c.pending && !c.journey).length, 1);
  editingCategoryId = categories.find(c => !c.pending && !c.journey).id;
  deleteCategoryFromModal();
  assertEqual(categories.filter(c => !c.pending && !c.journey).length, 1, 'at least one real (non-Pending, non-Journey) category must always remain');
});

test('deleteCategoryFromModal refuses to delete the reserved Journey category, even with other categories to fall back to', function () {
  editingCategoryId = journeyCategory().id;
  deleteCategoryFromModal();
  assertTrue(categories.some(c => c.journey), 'the Journey category should still exist — no confirm modal should even have opened');
});

test('deleteCategoryFromModal refuses to delete the reserved Pending category, even with other categories to fall back to', function () {
  const baseCount = categories.length;
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed'];
  saveCategory();
  editingCategoryId = categories.find(c => c.pending).id;
  deleteCategoryFromModal();
  assertEqual(categories.length, baseCount + 1, 'Pending must never be deletable, regardless of how many other categories exist');
});

test('addCategoryMilestoneRow / removeCategoryMilestoneRow edit the in-progress template only', function () {
  const baseCount = categories.length;
  openCategoryModal();
  assertEqual(editingCategoryMilestones.length, 0);
  addCategoryMilestoneRow();
  addCategoryMilestoneRow();
  assertEqual(editingCategoryMilestones.length, 2);
  removeCategoryMilestoneRow(0);
  assertEqual(editingCategoryMilestones.length, 1);
  assertEqual(categories.length, baseCount, 'nothing should be saved until Save is clicked');
});

test('renderCategoryMilestonesEditor renders a drag handle wired to dragStartCategoryMilestoneRow for each row at Editor+, and omits it below Editor', function () {
  openCategoryModal(categories[0].id);
  let html = document.getElementById('categoryMilestonesEditor').innerHTML;
  editingCategoryMilestones.forEach((_, idx) => {
    assertIncludes(html, `dragStartCategoryMilestoneRow(event,${idx})`);
    assertIncludes(html, `dropOnCategoryMilestoneRow(event,${idx})`);
  });
  userRole = 'reviewer';
  renderCategoryMilestonesEditor();
  html = document.getElementById('categoryMilestonesEditor').innerHTML;
  assertNotIncludes(html, 'dragStartCategoryMilestoneRow', 'no drag handle should render below Editor');
  assertNotIncludes(html, 'dropOnCategoryMilestoneRow', 'no drop target should render below Editor');
});

test('dragStartCategoryMilestoneRow/dropOnCategoryMilestoneRow reorders the in-progress template by dragging', function () {
  openCategoryModal(categories[0].id);
  const before = editingCategoryMilestones.slice();
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  dragStartCategoryMilestoneRow(fakeEvent, 0); // drag first entry
  dropOnCategoryMilestoneRow(fakeEvent, 1); // drop it onto the second slot
  assertEqual(editingCategoryMilestones[0], before[1]);
  assertEqual(editingCategoryMilestones[1], before[0]);
  dragStartCategoryMilestoneRow(fakeEvent, 1); // drag it back
  dropOnCategoryMilestoneRow(fakeEvent, 0);
  assertDeepEqual(editingCategoryMilestones, before);
});

test('dropOnCategoryMilestoneRow is a no-op when dropped back on the same row it was dragged from', function () {
  openCategoryModal(categories[0].id);
  const before = editingCategoryMilestones.slice();
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  dragStartCategoryMilestoneRow(fakeEvent, 0);
  dropOnCategoryMilestoneRow(fakeEvent, 0);
  assertDeepEqual(editingCategoryMilestones, before);
  const lastIdx = editingCategoryMilestones.length - 1;
  dragStartCategoryMilestoneRow(fakeEvent, lastIdx);
  dropOnCategoryMilestoneRow(fakeEvent, lastIdx);
  assertDeepEqual(editingCategoryMilestones, before);
});

test('dropOnCategoryMilestoneRow is blocked below Editor', function () {
  openCategoryModal(categories[0].id);
  const before = editingCategoryMilestones.slice();
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  userRole = 'reviewer';
  dragStartCategoryMilestoneRow(fakeEvent, 0);
  dropOnCategoryMilestoneRow(fakeEvent, 1);
  assertDeepEqual(editingCategoryMilestones, before, 'a Reviewer must not be able to reorder the template by dragging');
});

test('a reordered template is only committed to the category on Save', function () {
  openCategoryModal(categories[0].id);
  const before = editingCategoryMilestones.slice();
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  dragStartCategoryMilestoneRow(fakeEvent, 0);
  dropOnCategoryMilestoneRow(fakeEvent, 1);
  assertDeepEqual(categories[0].milestones, before, 'the saved category should be untouched before Save');
  saveCategory();
  assertEqual(categories[0].milestones[0], before[1]);
});

test('renderAdmin lists every category with its milestone template and item count', function () {
  const it = { id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);
  renderAdmin();
  const html = document.getElementById('adminBody').innerHTML;
  assertIncludes(html, 'Development');
  assertIncludes(html, '1 item');
});

// ---------- Category template changes sync to items using that category ----------

function addItemWithCategory(categoryId, milestoneNames) {
  const it = {
    id: genId(), workstreamId: workstreams[0].id, categoryId, name: 'Synced item', owner: '', notes: '',
    status: 'green', startDate: todayStr(), dueDate: todayStr(), updatedAt: Date.now(),
    milestones: milestoneNames.map(name => ({ id: genId(), name, dueDate: todayStr(), status: 'not-started', actualDate: null }))
  };
  items.push(it);
  return it;
}

test('adding a milestone to a category template prompts for confirmation, then appends it to items using that category', function () {
  const catId = categories[0].id;
  addItemWithCategory(catId, categories[0].milestones);
  openCategoryModal(catId);
  addCategoryMilestoneRow();
  editingCategoryMilestones[editingCategoryMilestones.length - 1] = 'Go-live approved';
  saveCategory();
  assertTrue(!!modalTarget, 'a confirm modal should be armed rather than saving immediately');
  assertEqual(categories[0].milestones.includes('Go-live approved'), false, 'not applied until confirmed');
  assertEqual(document.getElementById('confirmModalActionBtn').textContent, 'Apply Changes', 'this is not a delete action, the button must say so');
  confirmModalAction();
  assertTrue(categories[0].milestones.includes('Go-live approved'));
  assertTrue(items[0].milestones.some(m => m.name === 'Go-live approved' && m.status === 'not-started'));
});

test('appending a category milestone skips items that already have a milestone with that exact name', function () {
  const catId = categories[0].id;
  const it = addItemWithCategory(catId, categories[0].milestones);
  const existingCount = it.milestones.length;
  it.milestones[0].status = 'complete'; // hand-customize one so we can tell it wasn't touched
  openCategoryModal(catId);
  addCategoryMilestoneRow();
  editingCategoryMilestones[editingCategoryMilestones.length - 1] = categories[0].milestones[0]; // duplicate an existing name
  saveCategory();
  confirmModalAction();
  assertEqual(items[0].milestones.length, existingCount, 'no duplicate milestone should be appended');
  assertEqual(items[0].milestones[0].status, 'complete', 'the existing matching milestone must be untouched');
});

test('removing a milestone from a category template removes it from items, even if already Complete with an actual date', function () {
  const catId = categories[0].id;
  const it = addItemWithCategory(catId, categories[0].milestones);
  const removedName = categories[0].milestones[0];
  it.milestones[0].status = 'complete';
  it.milestones[0].actualDate = '2026-01-01';
  openCategoryModal(catId);
  removeCategoryMilestoneRow(0);
  saveCategory();
  confirmModalAction();
  assertFalse(items[0].milestones.some(m => m.name === removedName), 'the removed template entry should be gone from the item too');
});

test('removing a milestone from a category template tombstones it', function () {
  const catId = categories[0].id;
  const it = addItemWithCategory(catId, categories[0].milestones);
  const removedId = it.milestones[0].id;
  openCategoryModal(catId);
  removeCategoryMilestoneRow(0);
  saveCategory();
  confirmModalAction();
  assertTrue(deletedMilestoneIds.some(x => x.id === removedId), 'a merge must be able to tell this milestone was deleted, not just never seen');
});

test('a milestone appended by a category template sync gets its own updatedAt', function () {
  const catId = categories[0].id;
  addItemWithCategory(catId, categories[0].milestones);
  openCategoryModal(catId);
  addCategoryMilestoneRow();
  editingCategoryMilestones[editingCategoryMilestones.length - 1] = 'Go-live approved';
  saveCategory();
  confirmModalAction();
  const added = items[0].milestones.find(m => m.name === 'Go-live approved');
  assertTrue(typeof added.updatedAt === 'number' && added.updatedAt > 0);
});

test('a renamed template entry is treated as remove-old-name plus add-new-name', function () {
  const catId = categories[0].id;
  const it = addItemWithCategory(catId, categories[0].milestones);
  const oldName = categories[0].milestones[0];
  openCategoryModal(catId);
  editingCategoryMilestones[0] = 'Renamed milestone';
  saveCategory();
  confirmModalAction();
  assertFalse(items[0].milestones.some(m => m.name === oldName));
  assertTrue(items[0].milestones.some(m => m.name === 'Renamed milestone' && m.status === 'not-started'));
});

test('reordering a template with no name changes saves immediately, without a confirm modal, and reorders items using it', function () {
  const catId = categories[0].id;
  const it = addItemWithCategory(catId, categories[0].milestones);
  openCategoryModal(catId);
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  dragStartCategoryMilestoneRow(fakeEvent, 0);
  dropOnCategoryMilestoneRow(fakeEvent, 1);
  const expectedFirst = editingCategoryMilestones[0]; // captured before saveCategory() clears the working copy
  const expectedSecond = editingCategoryMilestones[1];
  saveCategory();
  assertFalse(!!modalTarget, 'a pure reorder has no items-facing impact to confirm');
  assertEqual(categories[0].milestones[0], expectedFirst);
  assertEqual(it.milestones[0].name, expectedFirst, 'the existing item\'s milestone order should follow the reordered template');
  assertEqual(it.milestones[1].name, expectedSecond);
});

test('a custom milestone not in the template keeps its relative position after a template reorder', function () {
  const catId = categories[0].id;
  const it = addItemWithCategory(catId, categories[0].milestones);
  it.milestones.push({ id: genId(), name: 'One-off custom step', dueDate: todayStr(), status: 'not-started', actualDate: null });
  openCategoryModal(catId);
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  dragStartCategoryMilestoneRow(fakeEvent, 0);
  dropOnCategoryMilestoneRow(fakeEvent, 1);
  saveCategory();
  assertEqual(it.milestones[it.milestones.length - 1].name, 'One-off custom step', 'a milestone with no matching template entry should sort after every template-matched one');
});

test('reordering the template also positions a newly-added milestone correctly on existing items, not just appended', function () {
  const catId = categories[0].id;
  const it = addItemWithCategory(catId, categories[0].milestones);
  openCategoryModal(catId);
  addCategoryMilestoneRow();
  const newName = 'Go-live approved';
  editingCategoryMilestones[editingCategoryMilestones.length - 1] = newName;
  const fakeEvent = { dataTransfer: {}, preventDefault: () => {} };
  const lastIdx = editingCategoryMilestones.length - 1;
  dragStartCategoryMilestoneRow(fakeEvent, lastIdx);
  dropOnCategoryMilestoneRow(fakeEvent, lastIdx - 1); // move the new entry up one, off the very end
  const expectedIdx = editingCategoryMilestones.indexOf(newName);
  saveCategory();
  confirmModalAction();
  assertEqual(it.milestones[expectedIdx].name, newName, 'the newly-added milestone should land at its template position, not always at the array end');
});

test('template changes save immediately (no confirm) when no items use the category', function () {
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed'];
  saveCategory();
  const newCat = categories[categories.length - 1]; // the one just created
  openCategoryModal(newCat.id);
  addCategoryMilestoneRow();
  saveCategory();
  assertFalse(!!modalTarget);
  assertEqual(newCat.milestones.length, 2);
});

test('cancelling the confirm modal discards the whole category edit, including the name change', function () {
  const catId = categories[0].id;
  addItemWithCategory(catId, categories[0].milestones);
  const originalName = categories[0].name;
  openCategoryModal(catId);
  document.getElementById('categoryNameInput').value = 'Renamed Category';
  removeCategoryMilestoneRow(0);
  saveCategory();
  assertTrue(!!modalTarget);
  closeConfirmModal();
  assertEqual(categories[0].name, originalName);
  assertEqual(categories[0].milestones.length, DEFAULT_CATEGORY_MILESTONES.length);
});

test('an item\'s computed status is refreshed after a category sync removes its worst milestone', function () {
  const catId = categories[0].id;
  const it = addItemWithCategory(catId, categories[0].milestones);
  it.milestones[0].status = 'red';
  it.status = computedStatusFromMilestones(it.milestones);
  assertEqual(items[0].status, 'red');
  openCategoryModal(catId);
  removeCategoryMilestoneRow(0); // remove the one red milestone
  saveCategory();
  confirmModalAction();
  assertFalse(items[0].status === 'red', 'status should be recomputed from the remaining milestones');
});
