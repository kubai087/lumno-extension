const assert = require('assert');

const matcher = require('../../src/domain/shortcut-key-matcher.ts');
const { createOnboardingPage } = require('../helpers/onboarding-page');
const { getManifestContentScripts, getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

const macEvent = matcher.describeKeyboardEvent({
  code: 'KeyK',
  key: 'K',
  ctrlKey: false,
  altKey: false,
  shiftKey: true,
  metaKey: true
});

assert.deepStrictEqual(macEvent, {
  ctrlKey: false,
  altKey: false,
  shiftKey: true,
  metaKey: true,
  key: 'k'
});
assert.strictEqual(
  matcher.descriptorMatchesShortcut(macEvent, 'Command+Shift+K'),
  true,
  'the browser-configured macOS shortcut should match a normalized trusted key descriptor'
);
assert.strictEqual(
  matcher.descriptorMatchesShortcut(macEvent, 'Ctrl+Shift+K'),
  false,
  'a shortcut with different primary modifiers must not match'
);

const customSlashEvent = matcher.describeKeyboardEvent({
  code: 'Slash',
  key: '?',
  ctrlKey: true,
  altKey: true,
  shiftKey: true,
  metaKey: false
});
assert.strictEqual(
  matcher.descriptorMatchesShortcut(customSlashEvent, 'Ctrl+Alt+Shift+Slash'),
  true,
  'custom command shortcuts should use the physical code for punctuation keys'
);
assert.strictEqual(
  matcher.canBeChromeCommandShortcut(customSlashEvent),
  true,
  'a modified keydown should be eligible for one cold-start verification round trip'
);
assert.strictEqual(
  matcher.canBeChromeCommandShortcut(matcher.describeKeyboardEvent({ code: 'KeyA', key: 'a' })),
  false,
  'ordinary typing must not wake the extension background while the shortcut is loading'
);
assert.strictEqual(
  matcher.descriptorMatchesShortcut(macEvent, 'Command+Unknown+K'),
  false,
  'invalid configured shortcuts should fail closed'
);
assert.deepStrictEqual(matcher.parseShortcut('⌘⇧K'), {
  ctrl: false,
  alt: false,
  shift: true,
  meta: true,
  key: 'k'
});
assert.deepStrictEqual(matcher.parseShortcut('Ctrl+ArrowUp'), {
  ctrl: true,
  alt: false,
  shift: false,
  meta: false,
  key: 'ArrowUp'
});
assert.strictEqual(
  matcher.eventMatchesShortcut({
    code: 'Equal',
    key: '+',
    ctrlKey: true
  }, 'Ctrl+Equal'),
  true
);

const contentScripts = getManifestContentScripts();
assert(
  contentScripts.some((files) => runsBefore(files, 'src/domain/shortcut-key-matcher.ts', 'src/content/shortcut-key-observer.ts')),
  'the page shortcut observer should load the shared matcher first'
);
assert.strictEqual(
  contentScripts.filter((files) => files.includes('src/domain/shortcut-key-matcher.ts')).length,
  1,
  'the shared matcher should be injected once per frame, by the observer entry that uses it'
);
assert(
  runsBefore(getPageScripts('src/onboarding/onboarding.html'), 'src/domain/shortcut-key-matcher.ts', 'src/onboarding/onboarding-content.ts'),
  'onboarding should load the shared matcher before its content model'
);
assert(
  runsBefore(getPageScripts('newtab.html'), 'src/domain/shortcut-key-matcher.ts', 'src/newtab/app/main.ts'),
  'newtab should load the shared matcher before its runtime entry'
);

// Onboarding matches the browser's search shortcut (here ⌘K) to open the
// overlay it demonstrates, and ignores other combinations. (New Tab's
// fallback shortcut is in tests/newtab/test-newtab-shortcut-focus-route.js.)
async function testOnboardingMatchesTheShortcut() {
  const page = await createOnboardingPage({});
  await page.settle(300);
  // Opening imports the overlay the worker injects into web pages; counting
  // the URLs it asks for counts the opens.
  let opened = 0;
  const getURL = page.window.chrome.runtime.getURL;
  page.window.chrome.runtime.getURL = (resource) => {
    if (resource === 'build/injected/overlay.js') opened += 1;
    return getURL(resource);
  };
  const press = (init) => page.document.body.dispatchEvent(new page.window.KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, init)));
  press({ key: 'J', code: 'KeyJ', metaKey: true, shiftKey: true });
  await page.settle(100);
  assert.strictEqual(opened, 0, 'another combination should not open the overlay');
  press({ key: 'k', code: 'KeyK', metaKey: true });
  await page.settle(100);
  assert.strictEqual(opened, 1, 'the search shortcut should open the overlay');
  page.close();
}

testOnboardingMatchesTheShortcut().then(() => {
  console.log('shortcut key matcher tests passed');
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
