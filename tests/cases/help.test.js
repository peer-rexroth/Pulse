// ---------- Help & About modals ----------
// Ported from mytasks (an explicit user request, "add help and info like in
// mytask app, same design") — see "Help & About modals" in CLAUDE.md. Both
// are plain, non-role-gated, non-mutating open/close pairs, same shape as
// the Theme modal (see tests/cases/theme.test.js).

test('openHelpModal/closeHelpModal toggle helpModalBg\'s open class', function () {
  assertFalse(document.getElementById('helpModalBg').classList.contains('open'));
  openHelpModal();
  assertTrue(document.getElementById('helpModalBg').classList.contains('open'));
  closeHelpModal();
  assertFalse(document.getElementById('helpModalBg').classList.contains('open'));
});

test('openAboutModal/closeAboutModal toggle aboutModalBg\'s open class', function () {
  assertFalse(document.getElementById('aboutModalBg').classList.contains('open'));
  openAboutModal();
  assertTrue(document.getElementById('aboutModalBg').classList.contains('open'));
  closeAboutModal();
  assertFalse(document.getElementById('aboutModalBg').classList.contains('open'));
});

// Note: unlike most of this app's modals, helpModalBg/aboutModalBg's own
// content is entirely static markup in the HTML shell, not written at
// runtime via innerHTML the way e.g. renderMain() populates #main — the JXA
// harness's fake getElementById() returns a cached element that starts
// genuinely empty (see "Tests" in CLAUDE.md) rather than one preloaded from
// the real page's static HTML, so there's nothing here for a test to read
// back and assert on. The content itself (Planning/Review/Dashboard/Roles/
// Data & sync sections, no Keyboard Shortcuts section) was
// verified directly in a real browser instead — see CLAUDE.md's own comment
// on this modal for what it covers and why.
