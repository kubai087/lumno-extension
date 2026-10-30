import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { isStringArray, readLocaleMessages, readRepoJson } from './repository';

// What the overlay font and opening animation settings need from the
// manifests and the locales. How the overlay applies them is covered by
// tests/pages/overlay/font.test.ts and entry-motion.test.ts.

const require = createRequire(import.meta.url);

function readFirefoxManifest(manifest: Record<string, unknown>): Record<string, unknown> {
  const exported: unknown = require('../../scripts/build/firefox-manifest.js');
  const convert = typeof exported === 'object' && exported !== null && 'toFirefoxManifest' in exported ? exported.toFirefoxManifest : null;
  if (typeof convert !== 'function') {
    throw new Error('scripts/build/firefox-manifest.js exports no toFirefoxManifest');
  }
  const converted: unknown = Reflect.apply(convert, undefined, [manifest, {
    lazyBackgroundDeps: ['build/pinyin-data.js'],
    importShim: 'build/firefox-import-shim.js'
  }]);
  if (typeof converted !== 'object' || converted === null) {
    throw new Error('toFirefoxManifest returned no manifest');
  }
  return Object.fromEntries(Object.entries(converted));
}

const permissionsOf = (manifest: Record<string, unknown>, field: string) => {
  const value = manifest[field];
  return isStringArray(value) ? value : [];
};

describe('overlay font wiring', () => {
  it('asks for fontSettings at install in Chrome, which cannot grant it at run time, and not in Firefox', () => {
    const manifest = readRepoJson('manifest.json');
    expect(permissionsOf(manifest, 'permissions')).toContain('fontSettings');
    expect(permissionsOf(manifest, 'optional_permissions')).not.toContain('fontSettings');
    expect(permissionsOf(readFirefoxManifest(manifest), 'permissions')).not.toContain('fontSettings');
  });

  it.each([
    ['en', ['Local font', 'Default', 'Search fonts', 'No matching fonts', 'Local fallback font', 'None'], /not synced/],
    ['ja', ['ローカルフォント', 'デフォルト', 'フォントを検索', '一致するフォントがありません', 'ローカルフォールバックフォント', 'なし'], /同期されません/],
    ['zh_CN', ['本地字体', '默认', '搜索字体', '没有匹配的字体', '本地回退字体', '无'], /不会同步/],
    ['zh_TW', ['本機字型', '預設', '搜尋字型', '沒有符合的字型', '本機後備字型', '無'], /不會同步/]
  ])('has the %s copy, saying the fonts are not synced and naming a missing font', (locale, labels, notSynced) => {
    const messages = readLocaleMessages(locale);
    expect([
      messages.settings_overlay_font_title,
      messages.settings_overlay_font_default,
      messages.settings_overlay_font_search_placeholder,
      messages.settings_overlay_font_no_results,
      messages.settings_overlay_font_fallback_title,
      messages.settings_overlay_font_fallback_none
    ]).toEqual(labels);
    expect(messages.settings_overlay_font_fallback_desc).toBeTruthy();
    expect(messages.settings_overlay_font_unsupported_tooltip).toBeTruthy();
    expect(messages.settings_overlay_font_desc).toMatch(notSynced);
    expect(messages.settings_overlay_font_missing).toMatch(/\{font\}/);
    expect(messages.settings_overlay_font_fallback_missing).toMatch(/\{font\}/);
    expect(messages.settings_overlay_font_missing_reset).toBeTruthy();
    expect(messages.settings_overlay_font_fallback_missing_reset).toBeTruthy();
  });
});

describe('overlay opening animation copy', () => {
  it.each([
    ['en', ['Opening animation', 'Spring', 'Fade']],
    ['ja', ['表示時のアニメーション', 'スプリング', 'フェード']],
    ['zh_CN', ['进入动画', '弹性', '淡入']],
    ['zh_TW', ['進入動畫', '彈性', '淡入']]
  ])('names the choices in %s', (locale, labels) => {
    const messages = readLocaleMessages(locale);
    expect([
      messages.settings_overlay_enter_animation_title,
      messages.overlay_enter_animation_elastic,
      messages.overlay_enter_animation_fade
    ]).toEqual(labels);
  });
});
