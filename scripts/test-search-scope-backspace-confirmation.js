const assert = require('assert');
const fs = require('fs');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

function readSource(path) {
  return fs.readFileSync(path, 'utf8');
}

const sharedSource = readSource('src/shared/search-input-mode.js');
const newtabSource = readNewtabRuntimeSource();
const overlaySource = readSource('src/overlay/search-panel.js');
const overlayRuntimeSource = readSource('src/overlay/runtime.js');
const backgroundSource = readSource('src/background/background.js');
const optionsSource = readSource('src/options/options.js');
const toastSource = readSource('src/shared/toast.js');

assert.ok(
  sharedSource.includes('function shouldRemoveModeTagOnBackspace(event)') &&
    sharedSource.includes('if (event && event.repeat)') &&
    sharedSource.includes('DEFAULT_MODE_TAG_REMOVAL_CONFIRMATION_DURATION'),
  'shared input mode should own the timed two-press Backspace confirmation state'
);

for (const [surface, source, expectedRemovalBranches] of [
  ['New Tab', newtabSource, 2],
  ['overlay', overlaySource, 3]
]) {
  const guardedBranches = source.match(
    /if \(!shouldRemoveSearchModeTagOnBackspace\([^)]*\)\) \{/g
  ) || [];
  assert.strictEqual(
    guardedBranches.length,
    expectedRemovalBranches,
    `${surface} should guard every active search-scope Backspace removal branch`
  );
  assert.ok(
    source.includes("'search_scope_remove_confirmation'") &&
      source.includes('onModeTagRemovalConfirmationReset'),
    `${surface} should show and reset the localized confirmation Toast`
  );
}

assert.ok(
  toastSource.includes('function createToastController(toastElement, options)') &&
    overlaySource.includes('const OVERLAY_TOAST = globalThis.LumnoToast;'),
  'overlay should use the shared lightweight Toast runtime'
);
assert.ok(
  backgroundSource.includes("'src/shared/toast.js'") &&
    backgroundSource.indexOf("'src/shared/toast.js'") <
      backgroundSource.indexOf("'src/overlay/search-panel.js'"),
  'overlay injection should load the shared Toast runtime before the panel'
);

const expectedMessages = {
  en: 'Press Backspace again to remove the scope.',
  ja: 'もう一度 Backspace を押すと検索範囲を解除します。',
  zh_CN: '再按一次退格键，移除搜索范围。',
  zh_TW: '再按一次退格鍵，移除搜尋範圍。'
};

for (const [locale, expectedMessage] of Object.entries(expectedMessages)) {
  const messages = JSON.parse(readSource(`_locales/${locale}/messages.json`));
  assert.strictEqual(
    messages.search_scope_remove_confirmation &&
      messages.search_scope_remove_confirmation.message,
    expectedMessage,
    `${locale} should localize the Backspace confirmation Toast`
  );
}

for (const [surface, source] of [
  ['New Tab', newtabSource],
  ['overlay', overlaySource]
]) {
  assert.ok(
    source.includes("'Press Backspace again to remove the scope.'") &&
      !source.includes("'Press Backspace again to remove the current search scope'"),
    `${surface} should use the concise English fallback`
  );
}

for (const [runtime, source] of [
  ['New Tab', newtabSource],
  ['overlay', overlayRuntimeSource],
  ['background', backgroundSource],
  ['options', optionsSource]
]) {
  assert.ok(
    source.includes("fetch(localePath, { cache: 'no-store' })"),
    `${runtime} locale loading should not reuse a stale language-file cache`
  );
}

assert.ok(
  overlaySource.includes('function loadPreferredLocaleMessages(locale, fallbackMessages)') &&
    overlaySource.includes('currentMessages = await loadPreferredLocaleMessages(targetLocale, null);') &&
    !overlaySource.includes('_x_extension_language_messages_2024_unique_'),
  'overlay should load packaged locale messages without a synced cache payload'
);

console.log('search scope Backspace confirmation tests passed');
