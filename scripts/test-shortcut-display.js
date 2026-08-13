const assert = require('assert');
const fs = require('fs');
const path = require('path');

const shortcutDisplay = require('../src/shared/shortcut-display.js');
const shortcutReference = require('../src/shared/shortcut-reference.js');

const macNavigator = {
  platform: 'Linux x86_64',
  userAgentData: { platform: 'macOS' },
  userAgent: 'Mozilla/5.0'
};
const windowsNavigator = {
  platform: 'Win32',
  userAgentData: { platform: 'Windows' },
  userAgent: 'Mozilla/5.0'
};

assert.strictEqual(
  shortcutDisplay.getNavigatorPlatform(macNavigator),
  'mac',
  'User-Agent Client Hints should identify macOS even when navigator.platform is reduced'
);
assert.strictEqual(
  shortcutDisplay.getNavigatorPlatform(windowsNavigator),
  'windows',
  'Windows should keep the text modifier convention'
);

assert.strictEqual(
  shortcutDisplay.formatShortcutReference('Alt+ArrowUp / Alt+ArrowDown', {
    navigatorLike: macNavigator
  }),
  '⌥↑ / ⌥↓',
  'macOS input history shortcuts should use Option and arrow symbols'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference('Alt+ArrowUp / Alt+ArrowDown', {
    navigatorLike: windowsNavigator
  }),
  'Alt+↑ / Alt+↓',
  'Windows input history shortcuts should keep Alt and use arrow symbols'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference('Enter / release Alt', {
    navigatorLike: macNavigator
  }),
  '↩ / ⌥↑',
  'macOS release instructions should not leak the Alt label'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference('Enter / release Alt', {
    navigatorLike: windowsNavigator
  }),
  'Enter / Alt↑',
  'Windows release instructions should retain the Alt label'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference('Tab Tab', {
    navigatorLike: macNavigator
  }),
  '⇥ ⇥',
  'macOS should render the double-Tab sequence as two distinct Tab presses'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference('Tab Tab', {
    navigatorLike: windowsNavigator
  }),
  'Tab Tab',
  'Windows should keep the double-Tab sequence readable without chord punctuation'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutChord('Alt+Q', { navigatorLike: macNavigator }),
  '⌥Q',
  'macOS Alt shortcuts should render with the Option symbol'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutChord('Alt+Q', { navigatorLike: windowsNavigator }),
  'Alt+Q',
  'Windows Alt shortcuts should remain textual'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutTemplate('Press {shortcut}', 'Alt+Q', {
    navigatorLike: macNavigator
  }),
  'Press ⌥Q',
  'shortcut placeholders should render with the current platform convention'
);

const shortcutDefinitions = shortcutReference
  .getBrowserShortcutDefinitions()
  .concat(shortcutReference.getFixedShortcutDefinitions());
const doubleTabDefinition = shortcutDefinitions.find((definition) => (
  definition.id === 'search-open-scope-menu'
));
assert.ok(doubleTabDefinition, 'Options should list the double-Tab search scope shortcut');
assert.strictEqual(doubleTabDefinition.shortcut, 'Tab Tab');
const numberJumpDefinition = shortcutDefinitions.find((definition) => (
  definition.id === 'search-number-jump'
));
assert.ok(numberJumpDefinition, 'Options should list the number jump mode shortcut');
assert.deepStrictEqual(numberJumpDefinition.defaultShortcut, {
  default: 'Ctrl 0.4s → 0–9',
  mac: 'Command 0.4s → 0–9'
});
assert.strictEqual(
  numberJumpDefinition.shortcutLabelKey,
  'shortcut_reference_search_number_jump_shortcut'
);
const searchShortcutGroup = shortcutReference
  .getShortcutReferenceGroups({ platform: 'mac' })
  .find((group) => group.id === 'search');
assert.ok(
  searchShortcutGroup && searchShortcutGroup.items.some((item) => (
    item.id === 'search-open-scope-menu'
  )),
  'the double-Tab shortcut should appear in the global Options shortcut reference'
);
const macNumberJump = searchShortcutGroup.items.find((item) => (
  item.id === 'search-number-jump'
));
const macSearchNavigate = searchShortcutGroup.items.find((item) => (
  item.id === 'search-navigate'
));
const windowsNumberJump = shortcutReference
  .getShortcutReferenceGroups({ platform: 'windows' })
  .find((group) => group.id === 'search')
  .items.find((item) => item.id === 'search-number-jump');
const windowsSearchNavigate = shortcutReference
  .getShortcutReferenceGroups({ platform: 'windows' })
  .find((group) => group.id === 'search')
  .items.find((item) => item.id === 'search-navigate');
assert.strictEqual(macNumberJump.shortcut, 'Command 0.4s → 0–9');
assert.strictEqual(windowsNumberJump.shortcut, 'Ctrl 0.4s → 0–9');
assert.strictEqual(
  macSearchNavigate.shortcut,
  'ArrowUp / ArrowDown / Ctrl+P / Ctrl+N'
);
assert.strictEqual(
  windowsSearchNavigate.shortcut,
  'ArrowUp / ArrowDown'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference(macNumberJump.shortcut, {
    platform: 'mac'
  }),
  'Command 0.4s → 0–9'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference(windowsNumberJump.shortcut, {
    platform: 'windows'
  }),
  'Ctrl 0.4s → 0–9'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference(macSearchNavigate.shortcut, {
    platform: 'mac'
  }),
  '↑ / ↓ / ⌃P / ⌃N'
);
assert.strictEqual(
  shortcutDisplay.formatShortcutReference(windowsSearchNavigate.shortcut, {
    platform: 'windows'
  }),
  '↑ / ↓'
);
['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', `_locales/${locale}/messages.json`),
    'utf8'
  ));
  [
    'shortcut_reference_search_number_jump_title',
    'shortcut_reference_search_number_jump_desc',
    'shortcut_reference_search_number_jump_shortcut',
    'search_number_jump_release_hint'
  ].forEach((key) => {
    assert.ok(
      messages[key] && String(messages[key].message || '').trim(),
      `${locale} should localize ${key}`
    );
  });
});
shortcutDefinitions.forEach((definition) => {
  const macSource = definition.shortcut ||
    (definition.defaultShortcut && definition.defaultShortcut.mac) ||
    '';
  const windowsSource = definition.shortcut ||
    (definition.defaultShortcut && definition.defaultShortcut.default) ||
    '';
  const macLabel = shortcutDisplay.formatShortcutReference(macSource, {
    platform: 'mac'
  });
  const windowsLabel = shortcutDisplay.formatShortcutReference(windowsSource, {
    platform: 'windows'
  });
  assert.doesNotMatch(
    macLabel,
    /\bAlt\b|Arrow(?:Up|Down|Left|Right)/,
    `${definition.id} should not expose Alt or raw Arrow key names on macOS`
  );
  assert.doesNotMatch(
    windowsLabel,
    /Arrow(?:Up|Down|Left|Right)/,
    `${definition.id} should not expose raw Arrow key names on Windows`
  );
});

const optionsSource = fs.readFileSync(
  path.join(__dirname, '..', 'src/options/options.js'),
  'utf8'
);
assert.match(
  optionsSource,
  /const keyMapDefault = \{[\s\S]*ArrowUp: '↑',[\s\S]*ArrowDown: '↓',[\s\S]*ArrowLeft: '←',[\s\S]*ArrowRight: '→'/,
  'editable shortcuts should use arrow symbols on non-Mac platforms too'
);
assert.match(
  optionsSource,
  /const effectiveShortcut = shortcut \|\| defaultShortcut;\s*setFallbackShortcutLabel\(effectiveShortcut\);/,
  'the stored shortcut should remain parseable and only be formatted at render time'
);
assert.match(
  optionsSource,
  /shortcutsStatus\.textContent = currentShortcutLabel[\s\S]*formatShortcutForDisplay\(currentShortcutLabel\)/,
  'the shortcut status chip should format the raw shortcut for the current platform'
);
assert.match(
  optionsSource,
  /item\.shortcutLabelKey[\s\S]*?modifier:\s*isMacPlatform \? '⌘' : 'Ctrl'[\s\S]*?shortcutLabel:\s*customShortcutLabel/,
  'Options should render the localized long-hold instruction with the platform modifier'
);

console.log('shortcut display tests passed');
