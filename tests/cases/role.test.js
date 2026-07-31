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

// Switching away from Admin while sitting on the Admin page would otherwise
// leave Admin-gated content (Role Passwords especially) disappearing out
// from under whoever's looking, mid-page — an explicit user request.
test('setUserRole leaves the Admin page for the All-workstreams Dashboard when switching to any non-Admin role while mode is "admin"', function () {
  userRole = 'admin';
  mode = 'admin';
  filterWorkstreamId = workstreams[0].id;
  setUserRole('editor');
  assertEqual(mode, 'dashboard');
  assertEqual(filterWorkstreamId, null, 'should land on "All workstreams", not whatever was filtered before');
});

test('setUserRole does not touch mode/filterWorkstreamId when switching roles outside Admin mode', function () {
  userRole = 'admin';
  mode = 'planning';
  filterWorkstreamId = workstreams[0].id;
  setUserRole('visitor');
  assertEqual(mode, 'planning');
  assertEqual(filterWorkstreamId, workstreams[0].id);
});

test('setUserRole does not leave the Admin page when the newly picked role is still Admin', function () {
  userRole = 'admin';
  mode = 'admin';
  setUserRole('admin');
  assertEqual(mode, 'admin');
});

test('setUserRole does not leave the Admin page when re-picking the same role that\'s already active', function () {
  userRole = 'editor';
  mode = 'admin';
  setUserRole('editor');
  assertEqual(mode, 'admin', 'nothing actually changed, so there\'s no reason to navigate away');
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

test('renderRoleModal renders one option per ROLES entry, wired to pickRole, with the current role marked selected', function () {
  userRole = 'reviewer';
  renderRoleModal();
  const html = document.getElementById('roleOptions').innerHTML;
  ROLES.forEach(r => {
    assertIncludes(html, ROLE_META[r].label);
    assertIncludes(html, `pickRole('${r}')`);
  });
  assertIncludes(html, 'theme-option selected', 'the current role should render marked as selected');
});

// ---------- Role passwords: pickRole()'s password gate ----------
// A soft deterrent, not real access control (see pickRole()'s own comment) —
// Reviewer/Editor/Admin can each optionally require a password (set by an
// Admin via saveRolePasswords()); Visitor never does, and a role with no
// password set (the default — see normalizeData()) still switches
// immediately, same as before this existed. A set password is stored as a
// salted hash ({salt, hash}), never the plain password — hashRolePassword()/
// verifyRolePassword() are exercised directly below, and every test that
// needs a role "password-protected" builds a real hash via
// hashRolePassword() rather than faking the shape by hand, so these tests
// also double as coverage of the hashing round-trip itself.

test('hashRolePassword/verifyRolePassword round-trip: the same password verifies, a different one doesn\'t, and two hashes of the same password differ (distinct random salts)', async function () {
  const stored = await hashRolePassword('correct-horse');
  assertTrue(await verifyRolePassword('correct-horse', stored));
  assertFalse(await verifyRolePassword('wrong-guess', stored));

  const stored2 = await hashRolePassword('correct-horse');
  assertTrue(stored.salt !== stored2.salt, 'each hash should get its own random salt');
  assertTrue(stored.hash !== stored2.hash, 'a different salt means a different hash, even for the same password');
});

test('verifyRolePassword returns false against a null/missing stored value, rather than throwing', async function () {
  assertFalse(await verifyRolePassword('anything', null));
  assertFalse(await verifyRolePassword('anything', undefined));
});

test('normalizeData backfills a missing/malformed programme.rolePasswords to {reviewer:null, editor:null, admin:null}, resets an invalid per-role entry to null, and leaves a real {salt,hash} alone', async function () {
  delete programme.rolePasswords;
  normalizeData();
  assertDeepEqual(programme.rolePasswords, { reviewer: null, editor: null, admin: null });

  programme.rolePasswords = 'not an object';
  normalizeData();
  assertDeepEqual(programme.rolePasswords, { reviewer: null, editor: null, admin: null });

  // The old plain-string shape (from before hashing existed) is exactly the
  // kind of malformed per-role entry this should reset, not trust as-is.
  const hash = await hashRolePassword('a-pass');
  programme.rolePasswords = { reviewer: 'plain-string-leftover', editor: { salt: 'x' }, admin: hash };
  normalizeData();
  assertEqual(programme.rolePasswords.reviewer, null, 'a plain string is not a valid {salt,hash} — reset to null');
  assertEqual(programme.rolePasswords.editor, null, 'missing hash field — reset to null');
  assertDeepEqual(programme.rolePasswords.admin, hash, 'a genuinely valid {salt,hash} must be left alone');
});

test('pickRole switches immediately, with no password step, for Visitor regardless of any passwords set', async function () {
  const hash = await hashRolePassword('x');
  programme.rolePasswords = { reviewer: hash, editor: hash, admin: hash };
  userRole = 'admin';
  openRoleModal();
  pickRole('visitor');
  assertEqual(userRole, 'visitor');
  assertEqual(document.getElementById('roleModalPasswordStep').style.display, 'none');
});

test('pickRole switches immediately for a role with no password set (the default)', function () {
  assertEqual(programme.rolePasswords.reviewer, null, 'sanity check — no password set by default');
  userRole = 'visitor';
  openRoleModal();
  pickRole('reviewer');
  assertEqual(userRole, 'reviewer');
  assertEqual(document.getElementById('roleModalPasswordStep').style.display, 'none');
});

test('pickRole does not switch roles yet for a password-protected role — it shows the password step instead', async function () {
  programme.rolePasswords.editor = await hashRolePassword('secret123');
  userRole = 'visitor';
  openRoleModal();
  pickRole('editor');
  assertEqual(userRole, 'visitor', 'must not switch until the password is actually submitted and correct');
  assertEqual(document.getElementById('roleModalPasswordStep').style.display, '', 'the password step must be shown');
  assertEqual(document.getElementById('roleOptions').style.display, 'none', 'the tile grid should be hidden while entering a password');
  assertIncludes(document.getElementById('roleModalTitle').textContent, 'Editor');
  assertIncludes(document.getElementById('roleModalPasswordIntro').textContent, 'Editor');
  assertEqual(document.getElementById('roleModalIntro').style.display, 'none', 'the whole-picker explanation should be hidden while focused on entering one password');
});

test('submitRolePassword rejects a wrong password, leaving the role unchanged and showing an error', async function () {
  programme.rolePasswords.admin = await hashRolePassword('correct-horse');
  userRole = 'visitor';
  pickRole('admin');
  document.getElementById('roleModalPasswordInput').value = 'wrong-guess';
  await submitRolePassword();
  assertEqual(userRole, 'visitor');
  assertEqual(document.getElementById('roleModalPasswordError').style.display, '');
  assertIncludes(document.getElementById('roleModalPasswordError').textContent, 'Incorrect');
  assertEqual(document.getElementById('roleModalPasswordStep').style.display, '', 'the password step should stay open after a wrong guess, not close');
});

test('submitRolePassword switches roles on a correct password and closes the password step', async function () {
  programme.rolePasswords.admin = await hashRolePassword('correct-horse');
  userRole = 'visitor';
  pickRole('admin');
  document.getElementById('roleModalPasswordInput').value = 'correct-horse';
  await submitRolePassword();
  assertEqual(userRole, 'admin');
  assertEqual(document.getElementById('roleModalPasswordStep').style.display, 'none');
  assertEqual(document.getElementById('roleOptions').style.display, '', 'the tile grid should be showing again');
});

test('submitRolePassword shows a clear error instead of throwing when crypto.subtle is unavailable (e.g. a non-secure context)', async function () {
  programme.rolePasswords.admin = await hashRolePassword('correct-horse');
  userRole = 'visitor';
  pickRole('admin');
  document.getElementById('roleModalPasswordInput').value = 'correct-horse';
  const savedCrypto = globalThis.crypto;
  delete globalThis.crypto;
  try {
    await submitRolePassword();
    assertEqual(userRole, 'visitor', 'must not switch roles when the password can\'t actually be checked');
    assertIncludes(document.getElementById('roleModalPasswordError').textContent, 'secure context');
  } finally {
    globalThis.crypto = savedCrypto;
  }
});

test('cancelRolePasswordStep backs out of the password step without changing the current role, restoring the picker\'s own title/intro', async function () {
  programme.rolePasswords.editor = await hashRolePassword('secret123');
  userRole = 'visitor';
  pickRole('editor');
  cancelRolePasswordStep();
  assertEqual(userRole, 'visitor', 'canceling must not switch roles');
  assertEqual(document.getElementById('roleModalPasswordStep').style.display, 'none');
  assertEqual(document.getElementById('roleOptions').style.display, '');
  assertEqual(document.getElementById('roleModalTitle').textContent, 'Choose your role');
  assertEqual(document.getElementById('roleModalIntro').style.display, '');
});

test('openRoleModal always resets any lingering password step back to the tile grid', async function () {
  programme.rolePasswords.editor = await hashRolePassword('secret123');
  userRole = 'visitor';
  pickRole('editor'); // leaves the password step open
  openRoleModal();
  assertEqual(document.getElementById('roleModalPasswordStep').style.display, 'none');
  assertEqual(document.getElementById('roleOptions').style.display, '');
});

test('renderRoleModal shows a lock icon only on a role that currently has a password set, never on Visitor', async function () {
  programme.rolePasswords = { reviewer: null, editor: await hashRolePassword('secret123'), admin: null };
  renderRoleModal();
  const html = document.getElementById('roleOptions').innerHTML;
  const editorTile = html.slice(html.indexOf('pickRole(\'editor\')'), html.indexOf('pickRole(\'admin\')'));
  const reviewerTile = html.slice(html.indexOf('pickRole(\'reviewer\')'), html.indexOf('pickRole(\'editor\')'));
  const visitorTile = html.slice(html.indexOf('pickRole(\'visitor\')'), html.indexOf('pickRole(\'reviewer\')'));
  assertIncludes(editorTile, 'fa-lock', 'Editor has a password set, so its tile should show a lock');
  assertNotIncludes(reviewerTile, 'fa-lock', 'Reviewer has no password set');
  assertNotIncludes(visitorTile, 'fa-lock', 'Visitor is never password-gated, even if it somehow had a value set');
});

// ---------- Role Passwords admin settings ----------

test('rolePasswordsSectionHtml (rendered as part of renderAdmin) is admin-only — invisible to every other role', function () {
  ['visitor', 'reviewer', 'editor'].forEach(r => {
    userRole = r;
    assertEqual(rolePasswordsSectionHtml(), '', `${r} must not see the Role Passwords section`);
  });
  userRole = 'admin';
  assertIncludes(rolePasswordsSectionHtml(), 'Role Passwords');
});

test('rolePasswordsSectionHtml names which roles currently have a password set, never the password values themselves', async function () {
  userRole = 'admin';
  programme.rolePasswords = { reviewer: null, editor: await hashRolePassword('secret123'), admin: null };
  let html = rolePasswordsSectionHtml();
  assertIncludes(html, 'Editor');
  assertNotIncludes(html, 'secret123', 'the actual password must never render into the page');
  assertNotIncludes(html, programme.rolePasswords.editor.hash, 'not even the hash should render into the page');

  programme.rolePasswords = { reviewer: null, editor: null, admin: null };
  html = rolePasswordsSectionHtml();
  assertIncludes(html, 'No passwords set yet');
});

test('openRolePasswordsModal and saveRolePasswords are both blocked below Admin', async function () {
  userRole = 'editor';
  openRolePasswordsModal();
  assertEqual(document.getElementById('rolePasswordsModalBg').classList.contains('open'), false);

  const original = await hashRolePassword('unchanged');
  programme.rolePasswords.admin = original;
  document.getElementById('rolePasswordAdminInput').value = 'hijacked';
  await saveRolePasswords();
  assertDeepEqual(programme.rolePasswords.admin, original, 'a sub-Admin role must not be able to change the Admin password');
});

test('openRolePasswordsModal always opens the three fields blank (no plain password to pre-fill) with a placeholder naming the current state', async function () {
  userRole = 'admin';
  programme.rolePasswords = { reviewer: await hashRolePassword('r-pass'), editor: null, admin: null };
  openRolePasswordsModal();
  assertEqual(document.getElementById('rolePasswordReviewerInput').value, '');
  assertEqual(document.getElementById('rolePasswordEditorInput').value, '');
  assertIncludes(document.getElementById('rolePasswordReviewerInput').placeholder, 'Currently set');
  assertIncludes(document.getElementById('rolePasswordEditorInput').placeholder, 'No password set');
  assertEqual(document.getElementById('rolePasswordReviewerClear').checked, false, 'the Remove checkbox must not carry over from a previous open');
});

test('saveRolePasswords hashes a non-blank field into that role\'s password, and leaves a blank field (Remove unchecked) untouched', async function () {
  userRole = 'admin';
  const oldReviewerHash = await hashRolePassword('old-reviewer-pass');
  programme.rolePasswords = { reviewer: oldReviewerHash, editor: null, admin: null };
  openRolePasswordsModal();
  // Reviewer field left blank — its existing password must survive untouched.
  document.getElementById('rolePasswordEditorInput').value = '  new-editor-pass  ';
  await saveRolePasswords();
  assertDeepEqual(programme.rolePasswords.reviewer, oldReviewerHash, 'a blank field with Remove unchecked must leave the existing password alone');
  assertTrue(await verifyRolePassword('new-editor-pass', programme.rolePasswords.editor), 'the trimmed value should have been hashed in');
  assertEqual(document.getElementById('rolePasswordsModalBg').classList.contains('open'), false, 'saving should close the modal');
});

test('saveRolePasswords clears a role\'s password when its "Remove" checkbox is checked, regardless of anything typed alongside it', async function () {
  userRole = 'admin';
  programme.rolePasswords.editor = await hashRolePassword('old-editor-pass');
  openRolePasswordsModal();
  document.getElementById('rolePasswordEditorInput').value = 'ignored-because-removing';
  document.getElementById('rolePasswordEditorClear').checked = true;
  await saveRolePasswords();
  assertEqual(programme.rolePasswords.editor, null, 'Remove wins outright, even with text also typed in');
});

// Admin's password requirement is deliberately not deactivatable at all —
// an explicit user request — unlike Reviewer/Editor, which can be freely
// turned on and off via the "Remove" checkbox above. saveRolePasswords()'s
// own applyOne() call for 'admin' hardcodes a null clearId (see its source)
// rather than looking up any checkbox id, so there is no code path at all
// that can null out Admin's password, regardless of what markup exists —
// these two tests exercise exactly that code path directly.
test('saveRolePasswords never clears Admin\'s password — leaving its field blank leaves the existing password untouched, exactly like any other unchanged field', async function () {
  userRole = 'admin';
  const original = await hashRolePassword('old-admin-pass');
  programme.rolePasswords.admin = original;
  openRolePasswordsModal();
  document.getElementById('rolePasswordAdminInput').value = ''; // left blank
  await saveRolePasswords();
  assertDeepEqual(programme.rolePasswords.admin, original, 'Admin has no "Remove" path at all — a blank field can only mean "leave unchanged"');
});

test('saveRolePasswords still lets Admin\'s password be changed to a new one, just never removed', async function () {
  userRole = 'admin';
  programme.rolePasswords.admin = await hashRolePassword('old-admin-pass');
  openRolePasswordsModal();
  document.getElementById('rolePasswordAdminInput').value = 'new-admin-pass';
  await saveRolePasswords();
  assertTrue(await verifyRolePassword('new-admin-pass', programme.rolePasswords.admin));
  assertFalse(await verifyRolePassword('old-admin-pass', programme.rolePasswords.admin));
});

test('saveRolePasswords shows a clear error instead of throwing when crypto.subtle is unavailable', async function () {
  userRole = 'admin';
  const original = await hashRolePassword('unchanged');
  programme.rolePasswords.admin = original;
  openRolePasswordsModal();
  document.getElementById('rolePasswordAdminInput').value = 'new-pass';
  const savedCrypto = globalThis.crypto;
  delete globalThis.crypto;
  try {
    await saveRolePasswords();
    assertDeepEqual(programme.rolePasswords.admin, original, 'must not silently corrupt the stored password when hashing is unavailable');
    assertIncludes(document.getElementById('toastMsg').textContent, 'secure context');
  } finally {
    globalThis.crypto = savedCrypto;
  }
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

test('deleteDecisionLogItem is blocked below Reviewer', function () {
  const w = workstreams[0];
  w.decisionLog = [{ id: genId(), text: 'Go live on the 15th.', cycleId: null, addedAt: Date.now() }];
  const itemId = w.decisionLog[0].id;

  userRole = 'visitor';
  deleteDecisionLogItem(w.id, itemId);
  assertEqual(w.decisionLog.length, 1, 'deleting must have been blocked below Reviewer');
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

// File sync (link/create/reconnect/unlink) is available to every role,
// including Visitor — an explicit user request — so openFileSyncModal() no
// longer has any role-gated content; it always shows the real
// options/reconnect prompt, never an "Admin required" notice.
test('openFileSyncModal shows the real reconnect prompt or warning at every role, including Visitor', function () {
  userRole = 'visitor';
  openFileSyncModal();
  assertEqual(document.getElementById('fileSyncReconnectOption').style.display, 'none');
  assertEqual(document.getElementById('fileSyncWarning').style.display, 'flex');

  openFileSyncModal({ name: 'pulse-data.json' });
  assertEqual(document.getElementById('fileSyncReconnectOption').style.display, 'flex');
  assertEqual(document.getElementById('fileSyncWarning').style.display, 'none');
});

// Regression test: on a brand-new browser, initFileSync() runs concurrently
// with the mandatory first-launch role-picker gate. It used to call
// openFileSyncModal() (link, or reconnect a lapsed-permission handle)
// immediately whenever it found something to prompt about — racing the
// (undismissable) role modal that opens right after it in the init
// sequence, so the prompt either got buried behind the role modal. The fix:
// initFileSync() parks what it wanted to show in pendingFileSyncPrompt when
// userRole is still null, and closeRoleModal() surfaces it once the
// mandatory gate actually resolves — for any first-time role pick, since
// file sync isn't role-gated any more.
test('closeRoleModal surfaces a pending file-sync prompt once any role is chosen for the first time', function () {
  userRole = null; // simulates the brand-new-browser, pre-choice state
  pendingFileSyncPrompt = 'link';
  setUserRole('visitor');
  closeRoleModal();
  assertTrue(document.getElementById('fileSyncModalBg').classList.contains('open'), 'picking any role for the first time must surface the deferred link/reconnect prompt');
  assertEqual(pendingFileSyncPrompt, null, 'the pending prompt is consumed once surfaced');
});
