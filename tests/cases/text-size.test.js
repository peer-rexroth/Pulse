// Text Size — a plain CSS zoom on <html>, picked from a 4-way segmented
// control (Small/Medium/Large/Extra Large) in the topbar's own popover —
// ported from this author's mytasks app, an explicit user request. A plain
// per-device UI preference, the same "lives in the pulse-v1 blob, never
// written to the synced folder" treatment sidebarWidth/mode/theme/
// colorScheme already get (see buildIndexPayload(), which never mentions
// uiScale at all) — mytasks itself syncs its own uiScale through its
// linked-file payload, a deliberate divergence not carried over here, since
// Pulse's own established stance is that a personal zoom-level preference
// has no more business syncing to a shared folder than sidebarWidth does.

test('UI_SCALE_STEPS has exactly the 4 documented stops, in ascending order', function () {
  assertDeepEqual(UI_SCALE_STEPS.map(s => s.pct), [90, 100, 115, 130]);
});

test('clampUiScale passes an already-exact stop through unchanged', function () {
  assertEqual(clampUiScale(115), 115);
});

test('clampUiScale snaps a non-stop value to its nearest real stop', function () {
  assertEqual(clampUiScale(93), 90);
  assertEqual(clampUiScale(108), 115);
});

test('clampUiScale falls back to UI_SCALE_DEFAULT for a non-finite/garbage value', function () {
  assertEqual(clampUiScale(NaN), UI_SCALE_DEFAULT);
  assertEqual(clampUiScale('not a number'), UI_SCALE_DEFAULT);
  assertEqual(clampUiScale(undefined), UI_SCALE_DEFAULT);
});

test('load() restores a valid persisted uiScale', function () {
  localStorage.setItem('pulse-v1', JSON.stringify({
    programme: { name: 'X' }, workstreams: [], items: [], categories: [], reviewCycles: [],
    uiScale: 130
  }));
  load();
  assertEqual(uiScale, 130);
});

test('load() clamps an out-of-range or corrupt persisted uiScale to its nearest real stop', function () {
  localStorage.setItem('pulse-v1', JSON.stringify({
    programme: { name: 'X' }, workstreams: [], items: [], categories: [], reviewCycles: [],
    uiScale: 999
  }));
  load();
  assertEqual(uiScale, 130, 'a stale/hand-edited value outside range must not be trusted as-is');
});

test('load() defaults uiScale to 100 when the saved blob has none at all (pre-feature save)', function () {
  localStorage.setItem('pulse-v1', JSON.stringify({
    programme: { name: 'X' }, workstreams: [], items: [], categories: [], reviewCycles: []
  }));
  load();
  assertEqual(uiScale, UI_SCALE_DEFAULT);
});

test('seedDefaults leaves uiScale at its default 100 (mode/theme/colorScheme/sidebarWidth are not reset there either — a genuinely fresh state already starts correct)', function () {
  uiScale = 100;
  seedDefaults();
  assertEqual(uiScale, 100);
});

test('save() round-trips uiScale into the stored data blob', function () {
  uiScale = 90;
  save();
  const saved = JSON.parse(localStorage.getItem('pulse-v1'));
  assertEqual(saved.uiScale, 90);
});

test('buildIndexPayload does not include uiScale — a per-device preference must never sync to the shared folder', function () {
  uiScale = 130;
  const payload = buildIndexPayload();
  assertFalse(Object.prototype.hasOwnProperty.call(payload, 'uiScale'));
});

test('applyUiScale writes the current uiScale (as a 0-1 zoom factor) onto <html>\'s own style.zoom', function () {
  uiScale = 115;
  applyUiScale();
  assertEqual(document.documentElement.style.zoom, 1.15);
});

test('setUiScale clamps its input, applies it, and persists it', function () {
  setUiScale(108); // not an exact stop — should snap to 115
  assertEqual(uiScale, 115);
  assertEqual(document.documentElement.style.zoom, 1.15);
  const saved = JSON.parse(localStorage.getItem('pulse-v1'));
  assertEqual(saved.uiScale, 115);
});

test('setUiScale closes the popover after applying', function () {
  document.getElementById('uiScaleMenu').classList.add('open');
  setUiScale(90);
  assertFalse(document.getElementById('uiScaleMenu').classList.contains('open'));
});

test('renderUiScaleMenu marks exactly the current uiScale\'s own segment active', function () {
  uiScale = 100;
  renderUiScaleMenu();
  const html = document.getElementById('uiScaleMenu').innerHTML;
  assertIncludes(html, 'Text Size');
  assertIncludes(html, `onclick="setUiScale(90)">S<`);
  assertIncludes(html, `onclick="setUiScale(100)">M<`);
  assertIncludes(html, `onclick="setUiScale(115)">L<`);
  assertIncludes(html, `onclick="setUiScale(130)">XL<`);
  const mIdx = html.indexOf('setUiScale(100)');
  const activeIdx = html.lastIndexOf('view-tab active', mIdx);
  assertTrue(activeIdx > -1 && mIdx - activeIdx < 60, 'the Medium (100) segment should carry the active class');
});

test('toggleUiScaleMenu opens the popover and renders it fresh', function () {
  uiScale = 130;
  toggleUiScaleMenu();
  assertTrue(document.getElementById('uiScaleMenu').classList.contains('open'));
  assertIncludes(document.getElementById('uiScaleMenu').innerHTML, `onclick="setUiScale(130)">XL<`);
});

test('closeUiScaleMenu closes the popover', function () {
  document.getElementById('uiScaleMenu').classList.add('open');
  closeUiScaleMenu();
  assertFalse(document.getElementById('uiScaleMenu').classList.contains('open'));
});
