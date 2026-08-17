const assert = require('assert');

const matcher = require('../src/shared/shortcut-key-matcher.js');

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

console.log('shortcut key matcher tests passed');
