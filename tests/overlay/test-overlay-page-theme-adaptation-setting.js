const assert = require('assert');
const fs = require('fs');
const settings = require('../../src/domain/settings/index.ts');
const pageTheme = require('../../src/overlay/dom/page-theme.ts');
const { parseCss } = require('../helpers/css-rules');
const { readStylesheet } = require('../helpers/css-tokens');
const { createOptionsPage } = require('../helpers/options-page');
const { createOverlayPage } = require('../helpers/overlay-runtime-harness');

// The "adapt theme colors to each webpage" setting: its Settings row, the
// overlay following it live, and the shared theme policy.

const ADAPTATION_KEY = settings.overlayPageThemeAdaptationEnabled.key;
const THEME_KEY = '_x_extension_theme_mode_2024_unique_';
const ROW_ID = '_x_extension_overlay_page_theme_adaptation_row_2026_unique_';

async function testSettingsMarkup() {
  const page = await createOptionsPage();
  const follows = (later, earlier) => Boolean(earlier.compareDocumentPosition(later) & 4);
  const tab = page.document.querySelector('._x_extension_settings_content_2024_unique_[data-content="appearance"]');
  assert.deepStrictEqual(Array.from(tab.querySelectorAll('._x_extension_section_title_2024_unique_'), (title) => title.textContent),
    ['全局', '网页聚焦搜索浮层', '新标签页'], 'webpage overlay settings should appear above New Tab settings');
  const size = page.byId('_x_extension_overlay_size_tabs_wrap_2026_unique_');
  const animation = page.byId('_x_extension_overlay_enter_animation_tabs_wrap_2026_unique_');
  const row = page.byId(ROW_ID);
  assert.ok(follows(animation, size));
  assert.ok(follows(row, animation), 'webpage theme adaptation should be the last overlay appearance setting');
  assert.ok(row.nextElementSibling.classList.contains('_x_extension_setting_divider_wrap_2024_unique_'),
    'the overlay section should end with webpage theme adaptation');
  assert.strictEqual(page.byId('_x_extension_overlay_page_theme_adaptation_toggle_2026_unique_').checked, true,
    'webpage theme adaptation should default to on');
  assert.strictEqual(row.querySelector('[title]'), null, 'the row should not fall back to a native title tooltip');
  page.close();

  const css = parseCss(readStylesheet('src/options/options.css'));
  ['light', 'dark'].forEach((mode) => {
    const hidden = css.rule(`html[data-options-theme-mode="${mode}"] #${ROW_ID}`);
    assert.deepStrictEqual(hidden && [hidden.get('display'), hidden.priority('display')], ['none', 'important'],
      `an explicit ${mode} mode should hide the row before the page script runs`);
  });
}

async function testSettingsRowFollowsTheThemeMode() {
  const page = await createOptionsPage();
  const row = page.byId(ROW_ID);
  assert.strictEqual(row.hidden, false, 'the row should show while the theme follows the system');
  const info = row.querySelector('._x_extension_info_button_2026_unique_');
  assert.strictEqual(info.getAttribute('data-tooltip'), '仅在“深浅色模式”=“跟随系统”时显示，关闭后将不再基于网页主题色变更深浅模式。',
    'the InfoButton should explain when the setting applies');
  await page.click(page.document.querySelector('[data-mode="light"]._x_extension_theme_option_2024_unique_'));
  await page.settle(400);
  assert.strictEqual(row.hidden, true, 'an explicit theme should hide the row');
  await page.click(page.document.querySelector('[data-mode="system"]._x_extension_theme_option_2024_unique_'));
  await page.settle(400);
  assert.strictEqual(row.hidden, false);
  page.close();
}

async function testOverlayFollowsTheSettingLive() {
  const lightPage = '<!doctype html><html><head><meta name="color-scheme" content="light"></head><body>Page</body></html>';
  const themeOf = (root) => root.getElementById('_x_extension_overlay_2024_unique_').getAttribute('data-theme');
  const bgOf = (root) => root.getElementById('_x_extension_overlay_2024_unique_').style.getPropertyValue('--x-ov-bg');

  const page = await createOverlayPage({ html: lightPage, darkSystem: true });
  const root = await page.open();
  assert.strictEqual(themeOf(root), 'light', 'following the system, the overlay should match a light page');
  page.changeSetting(ADAPTATION_KEY, false);
  await page.settle();
  assert.strictEqual(themeOf(root), 'dark', 'turning adaptation off should follow the dark system at once');
  page.changeSetting(ADAPTATION_KEY, true);
  await page.settle();
  assert.strictEqual(themeOf(root), 'light');
  page.close();

  const forced = await createOverlayPage({ html: lightPage, settings: { [THEME_KEY]: 'dark' } });
  const forcedRoot = await forced.open();
  assert.strictEqual(themeOf(forcedRoot), 'dark', 'an explicit dark theme should stay dark on a light page');
  const strongBg = bgOf(forcedRoot);
  forced.close();
  const darkPage = await createOverlayPage({
    html: '<!doctype html><html><head><meta name="color-scheme" content="dark"></head><body>Page</body></html>',
    settings: { [THEME_KEY]: 'dark' }
  });
  const darkRoot = await darkPage.open();
  assert.notStrictEqual(bgOf(darkRoot), strongBg, 'the dark panel should use a stronger background only over light pages');
  darkPage.close();
}

assert.strictEqual(
  settings.overlayPageThemeAdaptationEnabled.key,
  '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_'
);
assert(settings.BROWSER_SYNC_KEYS.includes(
  settings.overlayPageThemeAdaptationEnabled.key
));
assert.strictEqual(settings.overlayPageThemeAdaptationEnabled.parse(undefined), true);
assert.strictEqual(settings.overlayPageThemeAdaptationEnabled.parse(false), false);

const cases = [
  [{ mode: 'system', pageTheme: 'light', systemTheme: 'dark' }, 'light'],
  [{ mode: 'system', pageTheme: 'light', systemTheme: 'dark', pageThemeAdaptationEnabled: false }, 'dark'],
  [{ mode: 'system', pageTheme: 'dark', systemTheme: 'light', pageThemeAdaptationEnabled: false }, 'light'],
  [{ mode: 'light', pageTheme: 'dark', systemTheme: 'dark', pageThemeAdaptationEnabled: false }, 'light'],
  [{ mode: 'dark', pageTheme: 'light', systemTheme: 'light', pageThemeAdaptationEnabled: false }, 'dark']
];
cases.forEach(([input, expected]) => {
  assert.strictEqual(pageTheme.resolveOverlayTheme(input), expected);
});

const backgroundCases = [
  [{ resolvedTheme: 'dark', pageTheme: 'light' }, true],
  [{ resolvedTheme: 'dark', pageTheme: 'dark' }, false],
  [{ resolvedTheme: 'dark', pageTheme: null }, false],
  [{ resolvedTheme: 'light', pageTheme: 'dark' }, false]
];
backgroundCases.forEach(([input, expected]) => {
  assert.strictEqual(pageTheme.shouldStrengthenDarkOverlayBackground(input), expected);
});
const observationCases = [
  [{ mode: 'dark', pageThemeAdaptationEnabled: false, systemTheme: 'light' }, true],
  [{ mode: 'light', pageThemeAdaptationEnabled: true, systemTheme: 'dark' }, false],
  [{ mode: 'system', pageThemeAdaptationEnabled: true, systemTheme: 'light' }, true],
  [{ mode: 'system', pageThemeAdaptationEnabled: false, systemTheme: 'dark' }, true],
  [{ mode: 'system', pageThemeAdaptationEnabled: false, systemTheme: 'light' }, false]
];
observationCases.forEach(([input, expected]) => {
  const events = [];
  const actual = pageTheme.syncPageThemeObservation({
    ...input,
    start: () => events.push('start'),
    stop: () => events.push('stop')
  });
  assert.strictEqual(actual, expected);
  assert.deepStrictEqual(events, [expected ? 'start' : 'stop']);
});

const expectedCopy = {
  en: {
    title: 'Adapt theme colors to each webpage',
    tooltip: 'Shown only when Theme mode is set to Follow system. When turned off, light/dark mode will no longer adapt to the webpage theme color.',
    systemLabel: 'Follow system'
  },
  ja: {
    title: 'Web ページの色に合わせてテーマを自動変更',
    tooltip: '「テーマ」が「システムに従う」の場合にのみ表示されます。オフにすると、Web ページのテーマカラーに応じたライト／ダークモードの切り替えを行いません。',
    systemLabel: 'システムに従う'
  },
  zh_CN: {
    title: '基于网页色彩自动变更主题色',
    tooltip: '仅在“深浅色模式”=“跟随系统”时显示，关闭后将不再基于网页主题色变更深浅模式。',
    systemLabel: '跟随系统设置'
  },
  zh_TW: {
    title: '依網頁色彩自動變更主題色',
    tooltip: '僅在「深淺色模式」=「跟隨系統」時顯示，關閉後將不再依網頁主題色變更深淺模式。',
    systemLabel: '跟隨系統設定'
  }
};
Object.entries(expectedCopy).forEach(([locale, expected]) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  const title = messages.settings_overlay_page_theme_adaptation_title.message;
  const tooltip = messages.settings_overlay_page_theme_adaptation_tooltip.message;
  const systemLabel = messages.settings_theme_system.message;
  assert.strictEqual(title, expected.title);
  assert.strictEqual(tooltip, expected.tooltip);
  assert.strictEqual(systemLabel, expected.systemLabel);
});

(async () => {
  await testSettingsMarkup();
  await testSettingsRowFollowsTheThemeMode();
  await testOverlayFollowsTheSettingLive();
  console.log('overlay page theme adaptation setting tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
