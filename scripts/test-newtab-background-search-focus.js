const assert = require('assert');
const path = require('path');

require(path.join('..', 'src', 'newtab', 'background-search-focus.js'));

const {
  createBackgroundFocusHandler,
  shouldFocusSearchFromPointer
} = globalThis.LumnoNewtabBackgroundSearchFocus;

const body = { name: 'body' };
const root = { name: 'search root' };
const searchLayer = { name: 'search layer' };
const backgroundTargets = [body, root, searchLayer];

function createPointerEvent(target, overrides) {
  return {
    target,
    defaultPrevented: false,
    ...(overrides || {})
  };
}

function assertFocuses(target, message) {
  assert.strictEqual(
    shouldFocusSearchFromPointer(createPointerEvent(target), backgroundTargets),
    true,
    message
  );
}

function assertDoesNotFocus(target, message) {
  assert.strictEqual(
    shouldFocusSearchFromPointer(createPointerEvent(target), backgroundTargets),
    false,
    message
  );
}

assertFocuses(body, 'clicking the page background should focus search');
assertFocuses(root, 'clicking the exposed search shell should focus search');
assertFocuses(searchLayer, 'clicking the exposed search layer should focus search');

[
  'bookmark card',
  'bookmark breadcrumb',
  'bookmark pager',
  'bookmark cascade menu',
  'recent site card',
  'shortcut tile',
  'mode menu',
  'wallpaper control',
  'feedback control',
  'dialog'
].forEach((name) => {
  assertDoesNotFocus({ name }, `clicking ${name} should not focus search`);
});

assert.strictEqual(
  shouldFocusSearchFromPointer(createPointerEvent(body, { defaultPrevented: true }), backgroundTargets),
  false,
  'handled pointer events should not focus search'
);
assert.strictEqual(
  shouldFocusSearchFromPointer(null, backgroundTargets),
  false,
  'missing pointer events should not focus search'
);

let focusCount = 0;
const handleBackgroundPointerFocus = createBackgroundFocusHandler({
  getBackgroundTargets: () => backgroundTargets,
  focusSearch: () => {
    focusCount += 1;
  }
});

assert.strictEqual(handleBackgroundPointerFocus(createPointerEvent(body)), true);
assert.strictEqual(focusCount, 1, 'background pointer events should focus search once');
assert.strictEqual(handleBackgroundPointerFocus(createPointerEvent({ name: 'bookmark card' })), false);
assert.strictEqual(focusCount, 1, 'component pointer events should leave search focus unchanged');

console.log('newtab background search focus tests passed');
