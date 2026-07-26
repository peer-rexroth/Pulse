test('mode defaults to planning on a fresh install', function () {
  assertEqual(mode, 'planning');
});

test('setMode switches the active mode and persists it', function () {
  setMode('review');
  assertEqual(mode, 'review');
});

test('render() shows only the active mode\'s body container', function () {
  setMode('review');
  assertEqual(document.getElementById('planningBody').style.display, 'none');
  assertEqual(document.getElementById('reviewBody').style.display, '');
  assertEqual(document.getElementById('dashboardBody').style.display, 'none');
  assertEqual(document.getElementById('adminBody').style.display, 'none');

  setMode('dashboard');
  assertEqual(document.getElementById('dashboardBody').style.display, '');
  assertEqual(document.getElementById('reviewBody').style.display, 'none');

  setMode('admin');
  assertEqual(document.getElementById('adminBody').style.display, '');
  assertEqual(document.getElementById('dashboardBody').style.display, 'none');

  setMode('planning');
  assertEqual(document.getElementById('planningBody').style.display, '');
  assertEqual(document.getElementById('adminBody').style.display, 'none');
});

test('render() marks the active mode tab active and the others inactive', function () {
  setMode('admin');
  assertTrue(document.getElementById('tabAdmin').classList.contains('active'));
  assertFalse(document.getElementById('tabPlanning').classList.contains('active'));
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

test('switching to Review mode renders the workstream picker', function () {
  setMode('review');
  assertIncludes(document.getElementById('reviewWsList').innerHTML, workstreams[0].name);
});
