test('startRenameProgramme shows the input pre-filled with the current name and hides the display span', function () {
  programme.name = 'Q3 Delivery';
  render();
  startRenameProgramme();
  assertEqual(document.getElementById('programmeNameInput').value, 'Q3 Delivery');
  assertEqual(document.getElementById('programmeNameInput').style.display, '');
  assertEqual(document.getElementById('programmeNameDisplay').style.display, 'none');
  assertTrue(renamingProgramme);
});

test('commitRenameProgramme saves the new name and swaps back to the display span', function () {
  startRenameProgramme();
  document.getElementById('programmeNameInput').value = 'New Programme Name';
  commitRenameProgramme();
  assertEqual(programme.name, 'New Programme Name');
  assertEqual(document.getElementById('programmeNameDisplay').textContent, 'New Programme Name');
  assertEqual(document.getElementById('programmeNameInput').style.display, 'none');
  assertFalse(renamingProgramme);
});

test('commitRenameProgramme falls back to the previous name rather than saving a blank one', function () {
  programme.name = 'Original Name';
  startRenameProgramme();
  document.getElementById('programmeNameInput').value = '   ';
  commitRenameProgramme();
  assertEqual(programme.name, 'Original Name');
});

test('cancelRenameProgramme discards the in-progress edit without saving', function () {
  programme.name = 'Kept Name';
  startRenameProgramme();
  document.getElementById('programmeNameInput').value = 'Discarded edit';
  cancelRenameProgramme();
  assertEqual(programme.name, 'Kept Name');
  assertFalse(renamingProgramme);
});

test('a stale blur firing after cancel does not re-commit the discarded edit', function () {
  // cancelRenameProgramme() clears renamingProgramme and calls blur() to hide
  // the input, which in a real browser fires the input's onblur -> this same
  // commitRenameProgramme() — the guard at its top must stop that stale call.
  programme.name = 'Kept Name';
  startRenameProgramme();
  document.getElementById('programmeNameInput').value = 'Discarded edit';
  cancelRenameProgramme();
  commitRenameProgramme(); // simulates the blur commitRenameProgramme() itself triggers
  assertEqual(programme.name, 'Kept Name');
});
