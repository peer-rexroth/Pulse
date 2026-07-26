test('seedDefaults creates one default "Development" category with the standard milestones', function () {
  assertEqual(categories.length, 1);
  assertEqual(categories[0].name, 'Development');
  assertDeepEqual(categories[0].milestones, DEFAULT_CATEGORY_MILESTONES);
});

test('normalizeData seeds a default category if none exist', function () {
  categories = [];
  normalizeData();
  assertEqual(categories.length, 1);
  assertEqual(categories[0].name, 'Development');
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
  const secondCat = categories[1];
  openItemModal(null);
  document.getElementById('itemCategorySelect').value = secondCat.id;
  document.getElementById('itemNameInput').value = 'Onboard Acme';
  document.getElementById('itemWorkstreamSelect').value = workstreams[0].id;
  saveItem();
  assertEqual(items[0].categoryId, secondCat.id);
});

test('onItemCategoryChange reseeds milestones from the new category while creating an item', function () {
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed', 'Kickoff call'];
  saveCategory();
  const secondCat = categories[1];
  openItemModal(null);
  assertEqual(editingMilestones.length, categories[0].milestones.length);
  document.getElementById('itemCategorySelect').value = secondCat.id;
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
  document.getElementById('itemCategorySelect').value = categories[1].id;
  onItemCategoryChange();
  assertEqual(editingMilestones.length, 1, 'editing an existing item should not reseed its milestones on category change');
});

test('saveCategory adds a new category, and edits an existing one in place', function () {
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed', 'Kickoff call'];
  saveCategory();
  assertEqual(categories.length, 2);
  openCategoryModal(categories[1].id);
  document.getElementById('categoryNameInput').value = 'Renamed Category';
  saveCategory();
  assertEqual(categories.length, 2);
  assertEqual(categories[1].name, 'Renamed Category');
});

test('saveCategory rejects an empty name', function () {
  const before = categories.length;
  document.getElementById('categoryNameInput').value = '   ';
  saveCategory();
  assertEqual(categories.length, before);
});

test('deleteCategoryFromModal reassigns items using it to the fallback category', function () {
  document.getElementById('categoryNameInput').value = 'Vendor Onboarding';
  editingCategoryMilestones = ['Contract signed'];
  saveCategory();
  const secondCat = categories[1];
  const it = { id: genId(), workstreamId: workstreams[0].id, categoryId: secondCat.id, name: 'X', owner: '', notes: '', status: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);
  editingCategoryId = secondCat.id;
  deleteCategoryFromModal();
  confirmModalAction();
  assertEqual(categories.length, 1);
  assertEqual(items[0].categoryId, categories[0].id);
});

test('deleteCategoryFromModal refuses to delete the only remaining category', function () {
  editingCategoryId = categories[0].id;
  deleteCategoryFromModal();
  assertEqual(categories.length, 1);
});

test('addCategoryMilestoneRow / removeCategoryMilestoneRow edit the in-progress template only', function () {
  openCategoryModal();
  assertEqual(editingCategoryMilestones.length, 0);
  addCategoryMilestoneRow();
  addCategoryMilestoneRow();
  assertEqual(editingCategoryMilestones.length, 2);
  removeCategoryMilestoneRow(0);
  assertEqual(editingCategoryMilestones.length, 1);
  assertEqual(categories.length, 1, 'nothing should be saved until Save is clicked');
});

test('moveCategoryMilestoneRow swaps a milestone with its neighbor', function () {
  openCategoryModal(categories[0].id);
  const before = editingCategoryMilestones.slice();
  moveCategoryMilestoneRow(0, 1); // move first entry down
  assertEqual(editingCategoryMilestones[0], before[1]);
  assertEqual(editingCategoryMilestones[1], before[0]);
  moveCategoryMilestoneRow(1, -1); // move it back up
  assertDeepEqual(editingCategoryMilestones, before);
});

test('moveCategoryMilestoneRow refuses to move past either end', function () {
  openCategoryModal(categories[0].id);
  const before = editingCategoryMilestones.slice();
  moveCategoryMilestoneRow(0, -1); // already first — no-op
  assertDeepEqual(editingCategoryMilestones, before);
  const lastIdx = editingCategoryMilestones.length - 1;
  moveCategoryMilestoneRow(lastIdx, 1); // already last — no-op
  assertDeepEqual(editingCategoryMilestones, before);
});

test('a reordered template is only committed to the category on Save', function () {
  openCategoryModal(categories[0].id);
  const before = editingCategoryMilestones.slice();
  moveCategoryMilestoneRow(0, 1);
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
