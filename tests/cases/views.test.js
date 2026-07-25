function addItem(overrides) {
  const it = Object.assign({
    id: genId(), workstreamId: workstreams[0].id, type: 'scope',
    name: 'Item', owner: '', notes: '', status: 'green',
    startDate: todayStr(), dueDate: todayStr()
  }, overrides || {});
  items.push(it);
  return it;
}

test('setView switches the active view flag', function () {
  assertEqual(view, 'status');
  setView('timeline');
  assertEqual(view, 'timeline');
});

test('setFilterWorkstream narrows visibleWorkstreams to one', function () {
  document.getElementById('wsNameInput').value = 'Second';
  wsColorChoice = 'teal';
  saveWorkstream();
  assertEqual(visibleWorkstreams().length, 2);
  setFilterWorkstream(workstreams[1].id);
  const vis = visibleWorkstreams();
  assertEqual(vis.length, 1);
  assertEqual(vis[0].id, workstreams[1].id);
});

test('renderStatusView groups items under the correct workstream and shows RAG counts', function () {
  addItem({ status: 'red', name: 'Blocked task' });
  addItem({ status: 'red', name: 'Another blocked task' });
  addItem({ status: 'green', name: 'On track task' });
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'Blocked task');
  assertIncludes(html, '2 Off Track');
  assertIncludes(html, '1 On Track');
});

test('renderTimelineView renders one bar per scope item and one diamond per milestone', function () {
  addItem({ type: 'scope', name: 'Bar item' });
  addItem({ type: 'milestone', name: 'Diamond item', dueDate: todayStr() });
  view = 'timeline';
  renderMain();
  const html = document.getElementById('main').innerHTML;
  assertIncludes(html, 'tl-bar');
  assertIncludes(html, 'tl-milestone');
  assertIncludes(html, 'Bar item');
  assertIncludes(html, 'Diamond item');
});

test('renderMain shows an empty state with no workstreams', function () {
  workstreams = [];
  items = [];
  renderMain();
  assertIncludes(document.getElementById('main').innerHTML, 'No workstreams yet');
});
