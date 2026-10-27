const assert = require('assert');
const { buildShortcutReference, getCtrlTabLink } = require('../../src/options/features/shortcuts/shortcut-copy.ts');

const MESSAGES = {
  settings_tab_switcher_ctrl_tab_link: 'Switch with {shortcut}, like Arc',
  settings_tab_switcher_ctrl_tab_guide: 'Guide: {shortcut} like Arc'
};

// Builds the shortcut list from a chrome.commands snapshot and returns the
// rows the view would receive plus the tab switcher row's link.
function render(shortcut, isMacPlatform) {
  const state = {
    read: true,
    commands: [
      { name: 'show-search', shortcut: '⇧⌘K' },
      { name: 'show-tab-switcher', shortcut }
    ]
  };
  const getMessage = (key, fallback) => MESSAGES[key] || fallback;
  const rendered = buildShortcutReference(state, isMacPlatform, getMessage);
  const link = getCtrlTabLink(state, isMacPlatform, getMessage, 'https://lumno.kubai.design/en/help/tab-switcher/#ctrl-tab');
  const items = rendered.groups.flatMap((group) => group.items);
  const label = (id) => items.find((item) => item.id === id).shortcutLabel;
  return { link, label };
}

const unbound = render('⌥Q', true);
assert.ok(unbound.link, 'the tab switcher row should get its link once commands load');
assert.strictEqual(unbound.link.href, 'https://lumno.kubai.design/en/help/tab-switcher/#ctrl-tab');
assert.strictEqual(unbound.link.label, 'Switch with ⌃Tab, like Arc');
assert.strictEqual(unbound.link.bound, false);
assert.strictEqual(unbound.label('tab-switcher-cycle'), 'Q / ⇥ / ↑↓←→');
assert.strictEqual(unbound.label('tab-switcher-confirm'), '↩ / ⌥↑');

assert.strictEqual(render('Alt+Q', false).link.label, 'Switch with Ctrl+Tab, like Arc',
  'Windows and Linux should name the keys as they are printed');

const boundMac = render('⌃⇥', true);
assert.strictEqual(boundMac.link.label, 'Guide: ⌃Tab like Arc',
  'once Ctrl+Tab is bound the link becomes the guide, which also says how to change it back');
assert.strictEqual(boundMac.link.bound, true);
assert.strictEqual(boundMac.link.href, 'https://lumno.kubai.design/en/help/tab-switcher/#ctrl-tab');
assert.strictEqual(boundMac.label('tab-switcher-cycle'), '⇥ / ↑↓←→',
  'with Ctrl+Tab the switcher cycles with Tab alone');
assert.strictEqual(boundMac.label('tab-switcher-confirm'), '↩ / ⌃↑',
  'with Ctrl+Tab the switcher commits when Control is released');

const boundWindows = render('Ctrl+Tab', false);
assert.strictEqual(boundWindows.link.label, 'Guide: Ctrl+Tab like Arc');
assert.strictEqual(boundWindows.label('tab-switcher-confirm'), 'Enter / Ctrl↑');

const slash = render('Ctrl+Shift+/', false);
assert.strictEqual(slash.label('show-tab-switcher'), 'Ctrl+Shift+/',
  'a shortcut ending in a slash should not be split as a list');
assert.strictEqual(slash.label('tab-switcher-cycle'), '/ / Tab / ↑↓←→');
assert.strictEqual(slash.label('tab-switcher-confirm'), 'Enter / Ctrl↑',
  'Shift is held along, so releasing Control commits');

const unset = render('', true);
assert.strictEqual(unset.label('tab-switcher-cycle'), 'Q / ⇥ / ↑↓←→',
  'without a shortcut the rows fall back to the default Alt+Q');
assert.strictEqual(unset.label('tab-switcher-confirm'), '↩ / ⌥↑');

console.log('options shortcut reference tests passed');
