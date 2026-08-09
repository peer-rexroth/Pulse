// Resizable left navigation sidebar — a plain per-device UI preference,
// the same "lives in the pulse-v1 blob, never written to the synced
// folder" treatment mode/theme/colorScheme/filterWorkstreamId already get
// (see buildIndexPayload(), which never mentions sidebarWidth at all).
// The floor (SIDEBAR_MIN_WIDTH) is today's fixed 220px; the ceiling
// (SIDEBAR_MAX_WIDTH) is exactly double, per explicit user request.
//
// The actual mouse-drag interaction (startSidebarResize()/
// onSidebarResizeMove()/endSidebarResize()) isn't meaningfully testable
// under this harness — no real mousemove coordinate tracking, and
// endSidebarResize() reads getComputedStyle(), which isn't defined here
// at all. Verified live with Playwright instead. What *is* testable, since
// none of it touches those: clampSidebarWidth() itself, load()/save()'s
// persistence, and resetSidebarWidth().

test('clampSidebarWidth clamps below the floor up to SIDEBAR_MIN_WIDTH', function () {
  assertEqual(clampSidebarWidth(100), SIDEBAR_MIN_WIDTH);
});

test('clampSidebarWidth clamps above the ceiling down to SIDEBAR_MAX_WIDTH', function () {
  assertEqual(clampSidebarWidth(900), SIDEBAR_MAX_WIDTH);
});

test('clampSidebarWidth passes an in-range value through unchanged', function () {
  assertEqual(clampSidebarWidth(300), 300);
});

test('SIDEBAR_MAX_WIDTH is exactly double SIDEBAR_MIN_WIDTH, per the explicit request', function () {
  assertEqual(SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH * 2);
});

test('load() restores a valid persisted sidebarWidth', function () {
  localStorage.setItem('pulse-v1', JSON.stringify({
    programme: { name: 'X' }, workstreams: [], items: [], categories: [], reviewCycles: [],
    sidebarWidth: 350
  }));
  load();
  assertEqual(sidebarWidth, 350);
});

test('load() clamps an out-of-range or corrupt persisted sidebarWidth back into bounds', function () {
  localStorage.setItem('pulse-v1', JSON.stringify({
    programme: { name: 'X' }, workstreams: [], items: [], categories: [], reviewCycles: [],
    sidebarWidth: 9999
  }));
  load();
  assertEqual(sidebarWidth, SIDEBAR_MAX_WIDTH, 'a stale/hand-edited value outside range must not be trusted as-is');
});

test('load() defaults sidebarWidth to 220 when the saved blob has none at all (pre-feature save)', function () {
  localStorage.setItem('pulse-v1', JSON.stringify({
    programme: { name: 'X' }, workstreams: [], items: [], categories: [], reviewCycles: []
  }));
  load();
  assertEqual(sidebarWidth, 220);
});

test('seedDefaults leaves sidebarWidth at its default 220 (mode/theme/colorScheme are not reset there either — a genuinely fresh state already starts correct)', function () {
  sidebarWidth = 220;
  seedDefaults();
  assertEqual(sidebarWidth, 220);
});

test('save() round-trips sidebarWidth into the stored data blob', function () {
  sidebarWidth = 380;
  save();
  const saved = JSON.parse(localStorage.getItem('pulse-v1'));
  assertEqual(saved.sidebarWidth, 380);
});

test('buildIndexPayload does not include sidebarWidth — a per-device preference must never sync to the shared folder', function () {
  sidebarWidth = 380;
  const payload = buildIndexPayload();
  assertFalse(Object.prototype.hasOwnProperty.call(payload, 'sidebarWidth'));
});

test('resetSidebarWidth sets sidebarWidth back to the floor and applies it to the CSS custom property', function () {
  sidebarWidth = 400;
  applySidebarWidth();
  resetSidebarWidth();
  assertEqual(sidebarWidth, SIDEBAR_MIN_WIDTH);
  assertEqual(document.documentElement.style.getPropertyValue('--sidebar-width'), '220px');
});

test('resetSidebarWidth is a no-op (no save()) when already at the floor', function () {
  sidebarWidth = SIDEBAR_MIN_WIDTH;
  const original = save;
  let calls = 0;
  save = function () { calls++; original(); };
  try {
    resetSidebarWidth();
    assertEqual(calls, 0, 'already at the minimum — nothing changed, so nothing should be persisted');
  } finally {
    save = original;
  }
});

test('resetSidebarWidth does call save() when it actually changes the width', function () {
  sidebarWidth = 400;
  const original = save;
  let calls = 0;
  save = function () { calls++; original(); };
  try {
    resetSidebarWidth();
    assertEqual(calls, 1);
  } finally {
    save = original;
  }
});

test('applySidebarWidth writes the current sidebarWidth onto the --sidebar-width CSS custom property', function () {
  sidebarWidth = 300;
  applySidebarWidth();
  assertEqual(document.documentElement.style.getPropertyValue('--sidebar-width'), '300px');
});
