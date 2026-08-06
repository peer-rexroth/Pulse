// JXA test harness — no build step, no Node, no dependencies (matches the
// rest of this project's apps). Run via ./tests/run.sh from anywhere, or
// directly: osascript -l JavaScript tests/harness.js [nameFilter]
//
// How it works: extracts the inline <script> block from pulse.html, appends
// a resetState() glue function plus every tests/cases/*.test.js file, and
// evaluates all of it in ONE eval() call so test files can read and
// reassign the app's real top-level state (programme, workstreams, items,
// etc.) by bare name, and call any of its real functions directly.
//
// A test file just calls test('description', function(){ ... }) at its top
// level. Before each test, the harness calls resetState() (fresh seeded
// workstream + normalizeData()) and clears the fake DOM element cache, so
// tests never see state left over from another test.
// Use assertEqual/assertDeepEqual/assertTrue/assertFalse/assertIncludes.

async function run(argv) {
  ObjC.import('Foundation');
  ObjC.import('stdlib');

  const nameFilter = argv[0] || '';
  const cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
  const appPath = cwd + '/pulse.html';
  const casesDir = cwd + '/tests/cases';

  function readFile(path) {
    const str = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
    if (!str) throw new Error('Could not read file: ' + path);
    return str.js;
  }
  function listDir(path) {
    const arr = $.NSFileManager.defaultManager.contentsOfDirectoryAtPathError(path, null);
    if (!arr) throw new Error('Could not list directory: ' + path);
    const out = [];
    for (let i = 0; i < arr.count; i++) out.push(ObjC.unwrap(arr.objectAtIndex(i)));
    return out.sort();
  }

  // ---- extract the inline <script> block from pulse.html ----
  const html = readFile(appPath);
  const openTag = '<script>';
  const openIdx = html.indexOf(openTag);
  const closeIdx = openIdx === -1 ? -1 : html.indexOf('</script>', openIdx);
  if (openIdx === -1 || closeIdx === -1) {
    throw new Error('Could not find an inline <script>...</script> block in pulse.html — did the markup change?');
  }
  const appCode = html.slice(openIdx + openTag.length, closeIdx);

  // ---- minimal fake DOM element ----
  // Deliberately loose: every element supports every property/method any
  // code path touches, so tests never crash on a missing mock — the
  // assertions are what should catch real bugs, not the harness.
  function makeFakeElement() {
    const classSet = new Set();
    const attrs = {};
    return {
      innerHTML: '', textContent: '', value: '', className: '',
      style: {}, dataset: {}, disabled: false, checked: false,
      tabIndex: 0, offsetParent: {},
      classList: {
        add() { for (const c of arguments) classSet.add(c); },
        remove() { for (const c of arguments) classSet.delete(c); },
        toggle(c, force) {
          const on = force === undefined ? !classSet.has(c) : !!force;
          if (on) classSet.add(c); else classSet.delete(c);
          return on;
        },
        contains(c) { return classSet.has(c); }
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
      removeAttribute(k) { delete attrs[k]; },
      addEventListener() {}, removeEventListener() {},
      appendChild(c) { return c; }, removeChild() {}, remove() {},
      focus() {}, blur() {}, click() {}, scrollIntoView() {}, select() {},
      closest() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  }

  const elCache = new Map();
  globalThis.document = {
    documentElement: makeFakeElement(),
    activeElement: null,
    getElementById(id) {
      if (!elCache.has(id)) elCache.set(id, makeFakeElement());
      return elCache.get(id);
    },
    createElement() { return makeFakeElement(); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}
  };
  globalThis.window = {
    matchMedia() { return { matches: false }; },
    addEventListener() {}, removeEventListener() {}
  };
  globalThis.navigator = {};
  globalThis.location = { protocol: 'file:' }; // skips service-worker registration
  globalThis.localStorage = (function () {
    let store = {};
    return {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
      clear() { store = {}; }
    };
  })();
  globalThis.setTimeout = function () { return 0; };
  globalThis.clearTimeout = function () {};
  globalThis.setInterval = function () { return 0; };
  globalThis.clearInterval = function () {};
  globalThis.confirm = function () { return true; };
  globalThis.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; globalThis.__lastBlob = this; };
  globalThis.URL = { createObjectURL() { return 'blob:mock'; }, revokeObjectURL() {} };
  // JXA's JavaScriptCore has no Web Crypto (unlike every real browser this
  // app targets) — pulse.html's role password hashing (hashRolePassword()/
  // verifyRolePassword()) calls crypto.subtle.digest()/crypto.getRandomValues()
  // and new TextEncoder(), so this stubs just enough for that code to run
  // under test. NOT real SHA-256 (a proper UTF-8 encoder feeding a
  // deliberately simple, non-cryptographic mixing function instead) —
  // nothing here depends on matching an actual browser's digest bytes, only
  // on hashing being deterministic (same input, same output) and different
  // inputs almost never colliding, which is all a hash-then-compare
  // round-trip needs to test correctly.
  globalThis.TextEncoder = function () {};
  globalThis.TextEncoder.prototype.encode = function (str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      else bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
    }
    return new Uint8Array(bytes);
  };
  globalThis.crypto = {
    getRandomValues(arr) {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    subtle: {
      async digest(algo, data) {
        const bytes = new Uint8Array(data.buffer || data);
        let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
        for (let i = 0; i < bytes.length; i++) {
          h1 = ((h1 ^ bytes[i]) * 0x01000193) >>> 0;
          h2 = (((h2 << 5) - h2) + bytes[i]) >>> 0;
        }
        const out = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          h1 = (h1 * 0x01000193 + i) >>> 0;
          h2 = (((h2 << 5) - h2) + i) >>> 0;
          out[i] = (h1 ^ h2) & 0xFF;
        }
        return out.buffer;
      }
    }
  };

  // ---- test registration + assertions (real globals, visible from the eval'd code too) ----
  globalThis.__TESTS__ = [];
  globalThis.test = function (name, fn) { globalThis.__TESTS__.push({ name, fn }); };
  function show(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  globalThis.assertEqual = function (actual, expected, msg) {
    if (actual !== expected) throw new Error((msg ? msg + ': ' : '') + 'expected ' + show(expected) + ' but got ' + show(actual));
  };
  globalThis.assertDeepEqual = function (actual, expected, msg) {
    const a = show(actual), e = show(expected);
    if (a !== e) throw new Error((msg ? msg + ': ' : '') + 'expected ' + e + ' but got ' + a);
  };
  globalThis.assertTrue = function (cond, msg) { if (!cond) throw new Error(msg || 'expected a truthy value'); };
  globalThis.assertFalse = function (cond, msg) { if (cond) throw new Error(msg || 'expected a falsy value'); };
  globalThis.assertIncludes = function (haystack, needle, msg) {
    if (!haystack || !haystack.includes(needle)) throw new Error((msg ? msg + ': ' : '') + show(haystack) + ' does not include ' + show(needle));
  };
  globalThis.assertNotIncludes = function (haystack, needle, msg) {
    if (haystack && haystack.includes(needle)) throw new Error((msg ? msg + ': ' : '') + show(haystack) + ' should not include ' + show(needle));
  };

  // ---- glue appended directly after the app code, sharing its lexical scope ----
  const glue = `
;function resetState(){
  seedDefaults();
  // seedDefaults() itself no longer creates a workstream (a fresh real
  // programme starts with zero — see pulse.html), but nearly every test in
  // this suite assumes workstreams[0] already exists as a baseline
  // convenience, so the harness adds one back here rather than touching
  // every individual test.
  workstreams.push({ id: genId(), name: 'Workstream 1', color: 'blue', order: 0 });
  mode = 'planning'; theme = 'light'; colorScheme = 'standard'; filterWorkstreamId = null;
  // Default to the top of the role ladder so every existing test — written
  // before RBAC existed, and testing functionality rather than permissions —
  // keeps exercising full behavior unimpeded. Tests that specifically cover
  // role gating set userRole to a lower tier themselves (see role.test.js).
  userRole = 'admin';
  editingWsId = null; wsColorChoice = WS_COLORS[0]; editingItemId = null;
  editingItemType = 'scope'; journeyConnectItemId = null;
  editingMilestones = []; expandedItemIds = new Set(); revealedActualIds = new Set(); revealedDueIds = new Set(); revealedActionLogDueIds = new Set(); revealedLogTextFields = new Set();
  unassignedQuickAddOpen = false; journeyQuickAddOpen = false; subJourneyQuickAddOpenFor = null; planningSearchQuery = ''; planningStatusFilters = new Set(); planningDependencyFilter = false;
  journeysSearchQuery = ''; actionLogSearchQuery = ''; decisionLogSearchQuery = '';
  journeysStatusFilters = new Set(); journeysDependencyFilter = false; actionLogStatusFilters = new Set(); actionLogFlaggedFilter = false; decisionLogFlaggedFilter = false;
  editingCategoryId = null; editingCategoryMilestones = [];
  minutesModalCycleId = null; editingMinutesActionItems = []; reviewTab = 'scope'; planningTab = 'scope'; dashboardTab = 'overview';
  renamingProgramme = false;
  pendingImportData = null; modalTarget = null; toastUndoAction = null;
  fileHandle = null; lastSyncedSnapshot = null; lastSyncedAt = 0; syncConflictLog = [];
  backupDirHandle = null; lastBackupWrittenDate = null;
  normalizeData();
}
`;

  // ---- load every tests/cases/*.test.js file ----
  const fileNames = listDir(casesDir).filter(f => f.endsWith('.test.js'));
  if (fileNames.length === 0) throw new Error('No *.test.js files found in ' + casesDir);
  const testSrc = fileNames.map(f => '\n// --- ' + f + ' ---\n' + readFile(casesDir + '/' + f)).join('\n');

  // ---- one combined eval: app code + resetState glue + all test registrations ----
  eval(appCode + glue + testSrc);

  // ---- run ----
  const toRun = globalThis.__TESTS__.filter(t => !nameFilter || t.name.includes(nameFilter));
  if (toRun.length === 0) {
    console.log('No tests matched filter "' + nameFilter + '" (of ' + globalThis.__TESTS__.length + ' total).');
    $.exit(1);
  }

  let pass = 0, fail = 0;
  for (const t of toRun) {
    try {
      resetState();
      elCache.clear();
      document.documentElement = makeFakeElement();
      await t.fn();
      pass++;
      console.log('  ok  ' + t.name);
    } catch (e) {
      fail++;
      console.log('FAIL  ' + t.name + ' — ' + (e && e.message ? e.message : e));
    }
  }

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed' +
    (nameFilter ? ' (filter: "' + nameFilter + '", ' + globalThis.__TESTS__.length + ' total)' : ''));

  $.exit(fail > 0 ? 1 : 0);
}
