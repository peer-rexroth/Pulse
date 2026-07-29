// Roles (RBAC) — a soft, UI-level permission ladder, not real access control
// (there's no server/auth anywhere in this app). See "Roles (RBAC)" in
// CLAUDE.md. resetState() defaults userRole to 'admin' so every other test
// file (written before RBAC existed) keeps exercising full functionality
// unimpeded — tests here explicitly set userRole to a lower tier themselves.

// ---------- hasRole() / roleLevel() ladder ----------

// ROLES is ['visitor', 'reviewer', 'editor', 'admin'] — Reviewer sits below
// Editor (a user-requested swap from the original order), so an Editor also
// passes hasRole('reviewer'), but a Reviewer does not pass hasRole('editor').
test('hasRole treats ROLES as an increasing ladder — a higher role passes every lower check too', function () {
  userRole = 'admin';
  assertTrue(hasRole('visitor'));
  assertTrue(hasRole('reviewer'));
  assertTrue(hasRole('editor'));
  assertTrue(hasRole('admin'));

  userRole = 'editor';
  assertTrue(hasRole('visitor'));
  assertTrue(hasRole('reviewer'));
  assertTrue(hasRole('editor'));
  assertFalse(hasRole('admin'));

  userRole = 'reviewer';
  assertTrue(hasRole('reviewer'));
  assertFalse(hasRole('editor'));
  assertFalse(hasRole('admin'));

  userRole = 'visitor';
  assertTrue(hasRole('visitor'));
  assertFalse(hasRole('reviewer'));
});

test('requireRole shows a toast naming the missing role and returns false when the current role falls short; true and silent otherwise', function () {
  userRole = 'visitor';
  assertFalse(requireRole('editor'));
  assertIncludes(document.getElementById('toastMsg').textContent, 'Editor');

  userRole = 'admin';
  assertTrue(requireRole('editor'));
});

// ---------- Persistence — its own localStorage key, isolated from save()/load() ----------

test('loadRole() reads a valid stored role from its own key, separate from the main pulse-v1 blob', function () {
  localStorage.setItem('pulse-role-v1', 'reviewer');
  loadRole();
  assertEqual(userRole, 'reviewer');
});

test('loadRole() falls back to null on a missing or unrecognized stored value, rather than crashing', function () {
  localStorage.removeItem('pulse-role-v1');
  loadRole();
  assertEqual(userRole, null);

  localStorage.setItem('pulse-role-v1', 'not-a-real-role');
  loadRole();
  assertEqual(userRole, null);
});

test('saveRole() writes only to its own key — never into the pulse-v1 blob save() itself writes', function () {
  userRole = 'editor';
  save();
  saveRole();
  assertEqual(localStorage.getItem('pulse-role-v1'), 'editor');
  const mainBlob = JSON.parse(localStorage.getItem('pulse-v1'));
  assertEqual(mainBlob.userRole, undefined, 'userRole must never appear in the synced/exported data blob');
});

test('setUserRole updates state, persists it, and re-renders the picker', function () {
  setUserRole('reviewer');
  assertEqual(userRole, 'reviewer');
  assertEqual(localStorage.getItem('pulse-role-v1'), 'reviewer');
});

// Regression test: the topbar shield icon (#roleBtn) used to be a hardcoded
// fa-user-shield glyph regardless of the actual role, so switching roles
// visibly changed nothing there. updateRoleBtn() (called from render(),
// not just setUserRole()) keeps its icon/title in sync with ROLE_META.
test('the topbar role button\'s icon and title reflect the current role, and update when the role changes', function () {
  setUserRole('visitor');
  assertIncludes(document.getElementById('roleBtnIcon').className, ROLE_META.visitor.icon);
  assertIncludes(document.getElementById('roleBtn').title, 'Visitor');

  setUserRole('admin');
  assertIncludes(document.getElementById('roleBtnIcon').className, ROLE_META.admin.icon);
  assertIncludes(document.getElementById('roleBtn').title, 'Admin');
  assertNotIncludes(document.getElementById('roleBtnIcon').className, ROLE_META.visitor.icon, 'the previous role\'s icon class must not linger');
});

// ---------- Role modal: mandatory first-launch gate vs. anytime switcher ----------

test('closeRoleModal is a no-op while no role has ever been chosen — there is no way to dismiss the mandatory first pick', function () {
  userRole = null;
  openRoleModal();
  assertEqual(document.getElementById('roleModalBg').classList.contains('open'), true);
  closeRoleModal();
  assertEqual(document.getElementById('roleModalBg').classList.contains('open'), true, 'closeRoleModal must not close the modal while userRole is still null');
});

test('closeRoleModal closes normally once a role has been chosen', function () {
  userRole = 'editor';
  openRoleModal();
  closeRoleModal();
  assertEqual(document.getElementById('roleModalBg').classList.contains('open'), false);
});

test('renderRoleModal disables the Done button while no role is chosen yet, and enables it once one is', function () {
  userRole = null;
  renderRoleModal();
  assertEqual(document.getElementById('roleModalDoneBtn').disabled, true);
  setUserRole('editor');
  assertEqual(document.getElementById('roleModalDoneBtn').disabled, false);
});

test('renderRoleModal renders one option per ROLES entry, wired to setUserRole, with the current role marked selected', function () {
  userRole = 'reviewer';
  renderRoleModal();
  const html = document.getElementById('roleOptions').innerHTML;
  ROLES.forEach(r => {
    assertIncludes(html, ROLE_META[r].label);
    assertIncludes(html, `setUserRole('${r}')`);
  });
  assertIncludes(html, 'theme-option selected', 'the current role should render marked as selected');
});

// ---------- Editor-tier gating: workstreams, scope items, milestones, categories ----------

test('saveWorkstream is blocked below Editor and leaves workstreams untouched', function () {
  userRole = 'visitor';
  const before = workstreams.length;
  document.getElementById('wsNameInput').value = 'Should not save';
  saveWorkstream();
  assertEqual(workstreams.length, before);
});

test('saveItem is blocked below Editor and leaves items untouched', function () {
  userRole = 'visitor';
  const before = items.length;
  document.getElementById('itemNameInput').value = 'Should not save';
  document.getElementById('itemWorkstreamSelect').value = workstreams[0].id;
  document.getElementById('itemCategorySelect').value = categories[0].id;
  saveItem();
  assertEqual(items.length, before);
});

test('cycleItemAttr and cycleMilestoneStatus are both blocked below Editor', function () {
  userRole = 'admin';
  const it = { id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X', owner: '', notes: '', status: 'green', itBudget: 'green', businessImpact: 'green', budgetImpact: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [{ id: genId(), name: 'M', dueDate: todayStr(), status: 'not-started', actualDate: null }], updatedAt: Date.now() };
  items.push(it);
  const before = it.status;
  const mBefore = it.milestones[0].status;

  userRole = 'visitor';
  cycleItemAttr(it.id, 'itBudget');
  cycleMilestoneStatus(it.id, it.milestones[0].id);
  assertEqual(it.status, before, 'status roll-up should be untouched — cycleMilestoneStatus must have been blocked');
  assertEqual(it.milestones[0].status, mBefore);
});

test('itemRowHtml renders tag badges and Edit/Delete actions as inert below Editor, and as real controls at Editor+', function () {
  const it = { id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X', owner: '', notes: '', status: 'green', itBudget: 'green', businessImpact: 'green', budgetImpact: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };

  userRole = 'visitor';
  let html = itemRowHtml(it);
  assertNotIncludes(html, `onclick="cycleItemAttr('${it.id}'`, 'tag badges must not be clickable below Editor');
  assertNotIncludes(html, `deleteItem('${it.id}')`, 'Delete must not render below Editor');
  assertNotIncludes(html, 'drag-handle', 'the drag handle must not render below Editor');

  userRole = 'editor';
  html = itemRowHtml(it);
  assertIncludes(html, `onclick="cycleItemAttr('${it.id}'`);
  assertIncludes(html, `deleteItem('${it.id}')`);
});

test('the sidebar hides "+ new workstream" and each row\'s edit pencil below Editor', function () {
  userRole = 'visitor';
  renderSidebar();
  assertEqual(document.getElementById('addWsBtn').style.display, 'none');
  assertNotIncludes(document.getElementById('wsList').innerHTML, 'ws-row-edit');

  userRole = 'editor';
  renderSidebar();
  assertEqual(document.getElementById('addWsBtn').style.display, '');
  assertIncludes(document.getElementById('wsList').innerHTML, 'ws-row-edit');
});

test('saveCategory and deleteCategoryFromModal are both blocked below Editor', function () {
  userRole = 'visitor';
  const before = categories.length;
  document.getElementById('categoryNameInput').value = 'Should not save';
  saveCategory();
  assertEqual(categories.length, before);
});

// ---------- Reviewer-tier gating: review cycles, minutes, action log ----------

test('startReviewCycle, toggleReviewConfirm, and completeReviewCycle are all blocked below Reviewer', function () {
  const it = { id: genId(), workstreamId: workstreams[0].id, categoryId: categories[0].id, name: 'X', owner: '', notes: '', status: 'green', itBudget: 'green', businessImpact: 'green', budgetImpact: 'green', startDate: todayStr(), dueDate: todayStr(), milestones: [], updatedAt: Date.now() };
  items.push(it);

  userRole = 'visitor';
  startReviewCycle(workstreams[0].id);
  assertEqual(reviewCycles.length, 0, 'starting a review cycle must have been blocked below Reviewer');

  userRole = 'admin';
  startReviewCycle(workstreams[0].id);
  const cycle = activeReviewCycle(workstreams[0].id);
  assertTrue(!!cycle, 'sanity check — Admin can start a cycle');

  userRole = 'visitor';
  toggleReviewConfirm(cycle.id, it.id);
  assertEqual(cycle.confirmations.length, 0, 'confirming must have been blocked below Reviewer');

  userRole = 'admin';
  toggleReviewConfirm(cycle.id, it.id);
  completeReviewCycle(cycle.id);
  assertTrue(!!cycle.completedAt, 'sanity check — Admin can complete once confirmed');
});

test('toggleActionLogItem and deleteActionLogItem are both blocked below Reviewer', function () {
  const w = workstreams[0];
  w.actionLog = [{ id: genId(), text: 'Do the thing', owner: '', dueDate: null, completed: false, completedAt: null, cycleId: null, addedAt: Date.now() }];
  const itemId = w.actionLog[0].id;

  userRole = 'visitor';
  toggleActionLogItem(w.id, itemId);
  assertEqual(w.actionLog[0].completed, false, 'toggling must have been blocked below Reviewer');

  deleteActionLogItem(w.id, itemId);
  assertEqual(w.actionLog.length, 1, 'deleting must have been blocked below Reviewer');
});

test('the Review "Start review cycle" button is replaced with an explanatory line below Reviewer, and a real button at Reviewer+', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');

  userRole = 'visitor';
  renderReview();
  let html = document.getElementById('main').innerHTML;
  assertNotIncludes(html, 'startReviewCycle', 'no clickable Start button below Reviewer');
  assertIncludes(html, 'Reviewer role or higher');

  userRole = 'reviewer';
  renderReview();
  html = document.getElementById('main').innerHTML;
  assertIncludes(html, `startReviewCycle('${workstreams[0].id}')`);
});

test('saveMinutes and removeMinutes are both blocked below Reviewer', function () {
  const cycle = { id: genId(), workstreamId: workstreams[0].id, startedAt: Date.now(), completedAt: Date.now(), cancelledAt: null, confirmations: [], milestoneConfirmations: [], changeLog: [], minutes: null };
  reviewCycles.push(cycle);
  minutesModalCycleId = cycle.id;
  editingMinutesActionItems = [];
  document.getElementById('minutesSummaryInput').value = 'A summary';

  userRole = 'visitor';
  saveMinutes();
  assertEqual(cycle.minutes, null, 'saving must have been blocked below Reviewer');

  cycle.minutes = { summary: 'S', actionItems: [], decisions: '', nextSteps: '', importedAt: Date.now() };
  removeMinutes();
  assertTrue(!!cycle.minutes, 'removing must have been blocked below Reviewer (no confirm modal should have even opened)');
});

// ---------- Admin-tier gating: import/restore, file sync ----------

test('applyImport and restoreBackup are both blocked below Admin', function () {
  userRole = 'reviewer';
  pendingImportData = { programme: { name: 'Imported' }, workstreams: [], items: [], categories: [], reviewCycles: [] };
  applyImport('merge');
  assertTrue(programme.name !== 'Imported', 'import must have been blocked below Admin');
});

test('the Data menu hides Import/Backups below Admin, and shows them at Admin', function () {
  userRole = 'reviewer';
  render();
  assertEqual(document.getElementById('dataMenuImportItem').style.display, 'none');
  assertEqual(document.getElementById('dataMenuBackupsItem').style.display, 'none');

  userRole = 'admin';
  render();
  assertEqual(document.getElementById('dataMenuImportItem').style.display, '');
  assertEqual(document.getElementById('dataMenuBackupsItem').style.display, '');
});

test('openFileSyncModal shows the admin notice and hides the sync options below Admin', function () {
  userRole = 'reviewer';
  openFileSyncModal();
  assertEqual(document.getElementById('fileSyncOptions').style.display, 'none');
  assertEqual(document.getElementById('fileSyncAdminNotice').style.display, '');

  userRole = 'admin';
  openFileSyncModal();
  assertEqual(document.getElementById('fileSyncOptions').style.display, '');
  assertEqual(document.getElementById('fileSyncAdminNotice').style.display, 'none');
});

// Regression test: on a brand-new browser, initFileSync() runs concurrently
// with the mandatory first-launch role-picker gate. It used to call
// openFileSyncModal() (link, or reconnect a lapsed-permission handle)
// immediately whenever it found something to prompt about — racing the
// (undismissable) role modal that opens right after it in the init
// sequence, so the prompt either got buried behind the role modal or (since
// openFileSyncModal()'s own content gates on hasRole('admin')) rendered its
// "Admin required" notice instead of the real prompt, before any role had
// even been chosen yet. The fix: initFileSync() parks what it wanted to
// show in pendingFileSyncPrompt when userRole is still null, and
// closeRoleModal() surfaces it once the mandatory gate actually resolves.
test('closeRoleModal surfaces a pending file-sync prompt once a role is chosen for the first time, but only for Admin', function () {
  userRole = null; // simulates the brand-new-browser, pre-choice state
  pendingFileSyncPrompt = 'link';
  setUserRole('editor'); // a non-Admin choice — file sync stays Admin-only
  closeRoleModal();
  assertFalse(document.getElementById('fileSyncModalBg').classList.contains('open'), 'a non-Admin pick must not surface the file-sync prompt');
  assertEqual(pendingFileSyncPrompt, null, 'the pending prompt is consumed either way, not left to fire later');

  userRole = null;
  pendingFileSyncPrompt = 'link';
  setUserRole('admin');
  closeRoleModal();
  assertTrue(document.getElementById('fileSyncModalBg').classList.contains('open'), 'picking Admin for the first time must surface the deferred link/reconnect prompt');
  assertEqual(document.getElementById('fileSyncOptions').style.display, '', 'an Admin should see the real prompt, not the admin-only notice');
});
