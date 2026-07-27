// Color scheme picker (ported from mytasks — see "Color scheme system" in
// CLAUDE.md) — persistence via the same theme/mode plumbing, plus a guard
// against a typo'd or pre-scheme-era saved value.

test('setColorScheme updates state, the data-scheme attribute, and re-renders the picker', function () {
  setColorScheme('modern');
  assertEqual(colorScheme, 'modern');
  assertEqual(document.documentElement.getAttribute('data-scheme'), 'modern');
});

test('load() picks up a colorScheme saved in the data blob, same as theme', function () {
  localStorage.setItem('pulse-v1', JSON.stringify({
    programme: { name: 'X' }, workstreams: [], items: [], categories: [], reviewCycles: [],
    colorScheme: 'dracula'
  }));
  load();
  assertEqual(colorScheme, 'dracula');
});

test('load() ignores an unrecognized colorScheme rather than crashing', function () {
  colorScheme = 'dracula';
  localStorage.setItem('pulse-v1', JSON.stringify({
    programme: { name: 'X' }, workstreams: [], items: [], categories: [], reviewCycles: [],
    colorScheme: 'not-a-real-scheme'
  }));
  load();
  assertEqual(colorScheme, 'dracula', 'an invalid saved scheme should leave the current one alone');
});

test('save() round-trips colorScheme into the stored data blob', function () {
  setColorScheme('github');
  const saved = JSON.parse(localStorage.getItem('pulse-v1'));
  assertEqual(saved.colorScheme, 'github');
});

test('openThemeModal renders one option per THEME_SCHEMES entry, wired to setColorScheme', function () {
  setColorScheme('githubdimmed');
  openThemeModal();
  const html = document.getElementById('themeOptions').innerHTML;
  THEME_SCHEMES.forEach(s => {
    assertIncludes(html, s.name);
    assertIncludes(html, `setColorScheme('${s.id}')`);
  });
  assertIncludes(html, 'theme-option selected', 'the currently active scheme should render marked as selected');
});

test('every THEME_SCHEMES entry has a distinct, expected id', function () {
  // A cheap guard against typos: the scheme ids the picker offers should be
  // exactly the ones with a matching [data-scheme="..."] CSS block.
  const ids = THEME_SCHEMES.map(s => s.id).sort();
  assertDeepEqual(ids, ['dracula', 'github', 'githubdimmed', 'modern', 'standard']);
});
