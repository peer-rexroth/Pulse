test('mode defaults to planning on a fresh install', function () {
  assertEqual(mode, 'planning');
});

test('setMode switches to a non-gated mode and persists it', function () {
  setMode('dashboard');
  assertEqual(mode, 'dashboard');
});

test('render() shows the shared scopedBody for planning/review/dashboard, and adminBody only for admin', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  assertEqual(document.getElementById('scopedBody').style.display, '');
  assertEqual(document.getElementById('adminBody').style.display, 'none');

  setMode('dashboard');
  assertEqual(document.getElementById('scopedBody').style.display, '');
  assertEqual(document.getElementById('adminBody').style.display, 'none');

  setMode('admin');
  assertEqual(document.getElementById('scopedBody').style.display, 'none');
  assertEqual(document.getElementById('adminBody').style.display, '');

  setMode('planning');
  assertEqual(document.getElementById('scopedBody').style.display, '');
  assertEqual(document.getElementById('adminBody').style.display, 'none');
});

test('render() marks the active mode tab active and the others inactive', function () {
  setMode('admin');
  assertTrue(document.getElementById('tabAdmin').classList.contains('active'));
  assertFalse(document.getElementById('tabPlanning').classList.contains('active'));
});

// #tabReview itself is never disabled any more — the Action Log tab works
// fine with "All workstreams" selected (see allWorkstreamsActionLogHtml()),
// so Review mode always has something sensible to show. Only Scope Item
// Review, which needs one specific workstream's own cycle, still marks
// itself disabled without one.
test('render() marks the Scope Item Review sub-tab disabled while "All workstreams" is selected, and enabled once one is picked', function () {
  setMode('review'); // lands on Action Log with no workstream selected — see setMode()
  assertTrue(document.getElementById('tabReviewScope').classList.contains('disabled'));
  setFilterWorkstream(workstreams[0].id);
  assertFalse(document.getElementById('tabReviewScope').classList.contains('disabled'));
});

test('normalizeData falls back to planning mode if the stored mode is invalid', function () {
  mode = 'not-a-real-mode';
  normalizeData();
  assertEqual(mode, 'planning');
});

test('switching to Admin mode renders the category list', function () {
  setMode('admin');
  assertIncludes(document.getElementById('adminBody').innerHTML, 'Development');
});

test('the shared sidebar (not a separate Review picker) lists workstreams regardless of mode', function () {
  setFilterWorkstream(workstreams[0].id);
  setMode('review');
  assertIncludes(document.getElementById('wsList').innerHTML, workstreams[0].name);
});
