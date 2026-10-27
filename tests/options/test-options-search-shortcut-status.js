const assert = require('assert');
const { getSearchShortcutLabel } = require('../../src/options/features/shortcuts/shortcut-copy');

// The status chip names the browser's current search shortcut, formatted
// for the platform, and the platform default when the browser has none.
const t = (key, fallback) => fallback;

assert.strictEqual(getSearchShortcutLabel({ read: false, commands: undefined }, false, t), '未设置',
  'before the browser answers the chip says nothing is set');
assert.strictEqual(getSearchShortcutLabel({ read: true, commands: [] }, false, t), 'Ctrl+Shift+K',
  'without a bound command the platform default shows');
assert.strictEqual(getSearchShortcutLabel({ read: true, commands: [{ name: 'show-search', shortcut: ' ⌥K ' }] }, true, t), '⌥K',
  'the bound chord shows, trimmed and formatted');
assert.strictEqual(getSearchShortcutLabel({ read: true, commands: undefined }, true, t), '⌘⇧K',
  'browsers without commands, or a failed read, fall back to the platform default');

console.log('options search shortcut status tests passed');
