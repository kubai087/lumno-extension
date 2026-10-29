const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const selectionScriptRegistration = require('../../src/background/selection-script-registration.ts');
const selectionTarget = require('../../src/background/selection-target.ts');
const selectionActionIcons = require('../../src/domain/selection-action-icons.ts');
const { getBundleFiles, getManifestContentScripts } = require('../helpers/runtime-scripts');
const { readStylesheet } = require('../helpers/css-tokens');
const { parseCss } = require('../helpers/css-rules');

// What the selection toolbar needs from the manifest, its bundle, the Labs
// settings markup and the locales. Its behavior is covered by
// test-selection-quick-actions-dom.js, test-selection-quick-actions-listeners.js
// and tests/background/test-background-selection-quick-actions.js.

const repoRoot = path.resolve(__dirname, '..', '..');
const localeNames = ['en', 'ja', 'zh_CN', 'zh_TW'];
const readMessages = (locale) => JSON.parse(fs.readFileSync(path.join(repoRoot, `_locales/${locale}/messages.json`), 'utf8'));

assert(
  !getManifestContentScripts().some((files) => files.includes('src/content/selection-quick-actions.ts')),
  'the default-off selection toolbar should not load into every page from the manifest'
);
assert.deepStrictEqual(Array.from(selectionScriptRegistration.SCRIPT_FILES), ['build/selection-quick-actions.js']);
assert.strictEqual(selectionScriptRegistration.RUN_AT, 'document_idle');
assert.deepStrictEqual(
  getBundleFiles('selection-quick-actions').filter((file) => !file.startsWith('src/content/selection-quick-actions/')).sort(),
  ['src/content/selection-quick-actions.ts', 'src/domain/selection-action-icons.ts', 'src/domain/selection-intent.ts', 'src/domain/selection-text-features.ts', 'src/domain/settings/appearance.ts', 'src/domain/settings/define.ts', 'src/domain/settings/features.ts', 'src/domain/settings/locale.ts', 'src/domain/settings/newtab-page.ts', 'src/domain/settings/newtab-shortcuts.ts', 'src/domain/settings/page-cache.ts', 'src/domain/settings/schema.ts', 'src/domain/settings/sync-state.ts', 'src/platform/content-registry.ts', 'src/platform/messaging.ts', 'src/platform/provider-storage.ts', 'src/platform/setting-values.ts', 'src/platform/settings-areas.ts', 'src/platform/settings-storage.ts', 'src/platform/settings-store.ts', 'src/platform/storage-call.ts', 'src/shared/state/store.ts', 'src/shared/ui/toast-screen.ts', 'src/shared/ui/toast-style-gate.ts', 'src/shared/ui/toast.ts'],
  'the toolbar bundle should carry provider-aware settings, the selection classifier and the shared Toast, and nothing else'
);
assert.strictEqual(selectionTarget.DEFAULT_GROUP_TITLE, 'AI Search',
  'the selection group name should fall back to English, not a Chinese-only name');
assert.deepStrictEqual(Object.keys(selectionActionIcons), ['remix'], 'the action icons should come from Remix only');

const mark = new JSDOM(fs.readFileSync(path.join(repoRoot, 'assets/images/lumno-selection-mark.svg'), 'utf8'), { contentType: 'image/svg+xml' }).window.document;
assert.strictEqual(mark.documentElement.getAttribute('shape-rendering'), 'geometricPrecision');
assert.strictEqual(mark.querySelectorAll('path').length, 2, 'the selection mark should be the two-layer vector Lumno mark');

// The Settings rows are covered by src/options/options-general-features-section.test.tsx.
const optionsStyles = parseCss(readStylesheet('src/options/options.css'));
assert.strictEqual(
  optionsStyles.rule('._x_extension_theme_indicator_2024_unique_[data-ready="false"] ~ ._x_extension_theme_option_2024_unique_[data-active="true"]').get('background'),
  'var(--inline-tab-active-bg)',
  'segmented controls should show the active option before their indicator can be measured'
);
assert.strictEqual(parseCss(fs.readFileSync(path.join(repoRoot, 'src/shared/ui/custom-select.css'), 'utf8'))
  .rule('._x_extension_select_trigger_2024_unique_').get('gap'), '8px',
'the selected provider icon and label should use the same 8px gap as menu options');

localeNames.forEach((locale) => {
  const messages = readMessages(locale);
  [
    'settings_selection_quick_actions_title',
    'settings_selection_quick_actions_desc',
    'settings_selection_quick_actions_provider_title',
    'settings_selection_quick_actions_group_title',
    'settings_selection_quick_actions_group_desc',
    'selection_quick_actions_group_name',
    'selection_quick_action_ask',
    'selection_quick_action_translate',
    'selection_quick_action_explain',
    'selection_quick_action_summarize',
    'selection_quick_action_search',
    'selection_quick_action_calculate'
  ].forEach((key) => {
    assert(messages[key] && String(messages[key].message || '').trim(), `${locale} should localize ${key}`);
  });
});
const zhCnMessages = readMessages('zh_CN');
assert.strictEqual(zhCnMessages.settings_selection_quick_actions_group_title.message, '在后台查询');

const expectedGroupCopy = {
  en: ['AI Search', 'Collect all AI pages in the “AI Search” tab group'],
  ja: ['AI 検索', 'すべての AI ページを「AI 検索」タブグループにまとめます'],
  zh_CN: ['AI 查询', '所有 AI 网页皆归入「AI 查询」标签组'],
  zh_TW: ['AI 查詢', '所有 AI 網頁皆歸入「AI 查詢」分頁群組']
};
const expectedTaskLabels = {
  en: ['Answer', 'Translate', 'Explain', 'Summarize', 'Research', 'Calculate'],
  ja: ['回答', '翻訳', '説明', '要約', '調査', '計算'],
  zh_CN: ['解答', '翻译', '解释', '总结', '调研', '计算'],
  zh_TW: ['解答', '翻譯', '解釋', '總結', '研究', '計算']
};
localeNames.forEach((locale) => {
  const messages = readMessages(locale);
  assert.deepStrictEqual(
    [messages.selection_quick_actions_group_name.message, messages.settings_selection_quick_actions_group_desc.message],
    expectedGroupCopy[locale],
    `${locale} should use one localized AI group name in both runtime and settings copy`
  );
  assert.deepStrictEqual(
    ['ask', 'translate', 'explain', 'summarize', 'search', 'calculate'].map((intent) => messages[`selection_quick_action_${intent}`].message),
    expectedTaskLabels[locale],
    `${locale} should describe every toolbar item as a user task`
  );
});

console.log('selection quick actions wiring tests passed');
