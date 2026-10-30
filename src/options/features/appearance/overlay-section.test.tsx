import { readFileSync } from 'node:fs';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Settings from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { AppearanceOverlaySection } from './overlay-section';
import { getElement, getTag, getTags } from '../../../../tests/fakes/dom';
import enMessages from '../../../../_locales/en/messages.json';
import zhCnMessages from '../../../../_locales/zh_CN/messages.json';

// The fonts the next section reads as installed.
let installedFonts: Promise<chrome.fontSettings.FontName[]> = Promise.resolve([]);
vi.mock('../../options-installed-fonts', () => ({ listInstalledFonts: () => installedFonts }));

const FONT = '_x_extension_overlay_font_select_2026_unique_';
const FALLBACK = '_x_extension_overlay_font_fallback_select_2026_unique_';
const ADAPTATION_ROW = '_x_extension_overlay_page_theme_adaptation_row_2026_unique_';
const FONTS = [
  { fontId: 'PingFangSC', displayName: '苹方-简' },
  { fontId: 'Inter', displayName: 'Inter' },
  { fontId: 'Inter', displayName: 'Inter Duplicate' }
];

async function setUp({ fonts = FONTS, browserFamily = 'chromium' } = {}) {
  installedFonts = Promise.resolve(fonts);
  const view = renderOptionsView(<AppearanceOverlaySection />, { page: { browserFamily } });
  act(() => view.page.locale.store.setState({
    messages: { settings_overlay_font_missing: { message: '{font} is missing' } }
  }));
  // The installed fonts arrive after the first draw.
  await view.settings.settle();
  const store = (setting: Setting<unknown>, raw: unknown) => view.settings.change(setting, raw);
  const removed = () => view.settings.removals.sync.flat();
  return { ...view, store, removed };
}

function slide(host: HTMLElement, value: number) {
  const slider = getTag(host, '#_x_extension_overlay_width_slider_2026_unique_', 'input');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(slider, String(value));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return slider;
}

function openMenu(selectId: string) {
  act(() => getElement(document, `[aria-controls="${selectId}_control_listbox"]`).click());
  return getTags(document, `#${selectId}_control_menu [role="option"]`, 'div');
}

function pick(selectId: string, value: string) {
  openMenu(selectId);
  const option = getElement(document, `#${selectId}_control_menu [role="option"][data-value="${value}"]`);
  act(() => {
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    option.click();
  });
}

afterEach(cleanUpOptionsViews);

describe('Options Appearance webpage overlay section', () => {

  it('saves the size, and the width follows it until set apart', async () => {
    const { host, writes, removed, store, settings } = await setUp();
    const slider = getTag(host, '#_x_extension_overlay_width_slider_2026_unique_', 'input');
    const standard = Settings.getOverlaySizePreset('standard').width;
    const large = Settings.getOverlaySizePreset('large').width;
    expect(slider.value).toBe(String(standard));
    act(() => getElement(host, '[data-overlay-size="large"]').click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.overlaySizeMode.key]: 'large' }]);
    expect(slider.value).toBe(String(large));

    slide(host, 900);
    await settings.settle();
    expect(writes.at(-1)).toEqual({ [Settings.overlayWidth.key]: 900 });
    slide(host, large);
    await settings.settle();
    expect(removed()).toEqual([Settings.overlayWidth.key]);

    await store(Settings.overlayWidth, 700);
    await store(Settings.overlaySizeMode, 'compact');
    expect(slider.value).toBe('700');
  });

  it('saves the opening animation', async () => {
    const { host, writes, settings } = await setUp();
    const pressed = () => getTags(host, '[data-overlay-enter-animation]', 'button').map((button) => button.getAttribute('aria-checked'));
    expect(pressed()).toEqual(['true', 'false']);
    act(() => getElement(host, '[data-overlay-enter-animation="fade"]').click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.overlayEnterAnimation.key]: 'fade' }]);
    expect(pressed()).toEqual(['false', 'true']);
  });

  it('offers the opening animation as one radio group right after the size, spring first', async () => {
    const { host } = await setUp();
    const size = getElement(host, '#_x_extension_overlay_size_tabs_wrap_2026_unique_');
    const animation = getElement(host, '#_x_extension_overlay_enter_animation_tabs_wrap_2026_unique_');
    expect(size.compareDocumentPosition(animation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(animation.getAttribute('role')).toBe('radiogroup');
    expect(getTags(host, '[data-overlay-enter-animation]', 'button').map((button) => button.dataset.overlayEnterAnimation))
      .toEqual(['elastic', 'fade']);
  });

  it('lists the default, then each installed font once by name, and keeps a choice on this device', async () => {
    const { host, localWrites, settings } = await setUp();
    expect(openMenu(FONT).map((option) => [option.dataset.value, option.textContent])).toEqual([
      ['', '默认'],
      ['Inter', 'Inter'],
      ['PingFangSC', '苹方-简']
    ]);
    expect(getElement(host, `[data-select="${FONT}"]`).dataset.selectSearchable).toBe('true');
    pick(FONT, 'PingFangSC');
    pick(FALLBACK, 'Inter');
    await settings.settle();
    expect(localWrites).toEqual([
      { [Settings.overlayFontFamily.key]: 'PingFangSC', [Settings.overlayFontLabels.key]: { PingFangSC: '苹方-简' } },
      {
        [Settings.overlayFontFallback.key]: 'Inter',
        [Settings.overlayFontLabels.key]: { PingFangSC: '苹方-简', Inter: 'Inter' }
      }
    ]);
  });

  it('names a chosen font this device lacks and clears it in one click', async () => {
    const { host, localWrites, store, settings } = await setUp();
    await store(Settings.overlayFontLabels, { 'Missing Sans': 'Missing Sans Display' });
    await store(Settings.overlayFontFamily, 'Missing Sans');
    const notice = getElement(host, '#_x_extension_overlay_font_missing_2026_unique_');
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toContain('Missing Sans Display is missing');
    expect(openMenu(FONT).at(-1)?.textContent).toBe('Missing Sans Display');
    expect(getElement(host, '#_x_extension_overlay_font_fallback_missing_2026_unique_').hidden).toBe(true);
    act(() => getTag(notice, '._x_extension_overlay_font_reset_2026_unique_', 'button').click());
    await settings.settle();
    expect(localWrites.at(-1)).toEqual({ [Settings.overlayFontFamily.key]: '', [Settings.overlayFontLabels.key]: {} });
    expect(notice.hidden).toBe(true);
  });

  it('puts the font rows between the opening animation and page theme adaptation', async () => {
    const { host } = await setUp();
    const row = (name: string) => getElement(host, `#_x_extension_${name}_2026_unique_`);
    const follows = (earlier: HTMLElement, later: HTMLElement) => Boolean(earlier.compareDocumentPosition(later) &
      Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(row('overlay_enter_animation_tabs_wrap'), row('overlay_font_row'))).toBe(true);
    expect(follows(row('overlay_font_row'), row('overlay_font_fallback_row'))).toBe(true);
    expect(follows(row('overlay_font_fallback_row'), row('overlay_page_theme_adaptation_row'))).toBe(true);
  });

  it('offers the same fonts as an optional, searchable fallback and keeps both choices out of browser sync', async () => {
    const { host, writes, settings } = await setUp();
    expect(getElement(host, `[data-select="${FALLBACK}"]`).dataset.selectSearchable).toBe('true');
    expect(openMenu(FALLBACK).map((option) => option.textContent)).toEqual(['无', 'Inter', '苹方-简']);
    pick(FONT, 'PingFangSC');
    pick(FALLBACK, 'Inter');
    await settings.settle();
    expect(writes).toEqual([]);
  });

  it('shows a font chosen on another Settings page', async () => {
    const { store } = await setUp();
    await store(Settings.overlayFontFamily, 'Inter');
    expect(getElement(document, `#${FONT}_control_value`).textContent).toBe('Inter');
  });

  it('words the missing font notice in the page language', async () => {
    const { host, page, store } = await setUp();
    await store(Settings.overlayFontFamily, 'Missing Sans');
    const notice = getElement(host, '#_x_extension_overlay_font_missing_2026_unique_');
    act(() => page.locale.store.setState({ messages: zhCnMessages }));
    expect(notice.textContent).toContain('这台设备');
    act(() => page.locale.store.setState({ messages: enMessages }));
    expect(notice.textContent).toContain('Missing Sans');
    expect(notice.textContent).not.toContain('这台设备');
  });

  it('flags nothing as missing when the font list could not be read', async () => {
    const { host, store } = await setUp({ fonts: [] });
    await store(Settings.overlayFontFamily, 'Inter');
    expect(getElement(host, '#_x_extension_overlay_font_missing_2026_unique_').hidden).toBe(true);
    expect(openMenu(FONT).map((option) => option.dataset.value)).toEqual(['', 'Inter']);
  });

  it('keeps the font rows visible but inert on Firefox', async () => {
    const { host } = await setUp({ fonts: [], browserFamily: 'firefox' });
    ['_x_extension_overlay_font_row_2026_unique_', '_x_extension_overlay_font_fallback_row_2026_unique_'].forEach((id) => {
      const row = getElement(host, `#${id}`);
      expect([row.dataset.browserUnsupported, row.dataset.unsupported]).toEqual(['firefox', 'true']);
      expect(row.dataset.unsupportedReasonKey).toBe('settings_overlay_font_unsupported_tooltip');
    });
    expect(getElement(host, `[data-select="${FONT}"]`).dataset.disabled).toBe('true');
  });

  it('shows page theme adaptation only while the color mode follows the system', async () => {
    const { host, writes, page, settings } = await setUp();
    const row = getElement(host, `#${ADAPTATION_ROW}`);
    expect(row.hidden).toBe(false);
    act(() => page.pageTheme.store.setState({ mode: 'dark' }));
    expect([row.hidden, row.getAttribute('aria-hidden')]).toEqual([true, 'true']);
    act(() => page.pageTheme.store.setState({ mode: 'light' }));
    expect(row.hidden).toBe(true);
    act(() => page.pageTheme.store.setState({ mode: 'system' }));
    expect(row.hidden).toBe(false);
    act(() => getTag(host, '#_x_extension_overlay_page_theme_adaptation_toggle_2026_unique_', 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.overlayPageThemeAdaptationEnabled.key]: false }]);
  });

  it('ends the section with page theme adaptation, on by default and explained in an InfoButton', async () => {
    const { host } = await setUp();
    const row = getElement(host, `#${ADAPTATION_ROW}`);
    const follows = (earlier: Element, later: Element) => Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
    const size = getElement(host, '#_x_extension_overlay_size_tabs_wrap_2026_unique_');
    const animation = getElement(host, '#_x_extension_overlay_enter_animation_tabs_wrap_2026_unique_');
    expect(follows(size, animation)).toBe(true);
    expect(follows(animation, row)).toBe(true);
    expect(getTag(host, '#_x_extension_overlay_page_theme_adaptation_toggle_2026_unique_', 'input').checked).toBe(true);
    expect(row.querySelector('[title]')).toBeNull();
    expect(getElement(row, '._x_extension_info_button_2026_unique_').getAttribute('data-tooltip'))
      .toBe('仅在“深浅色模式”=“跟随系统”时显示，关闭后将不再基于网页主题色变更深浅模式。');
  });

  it.each([
    ['en', 'Adapt theme colors to each webpage',
      'Shown only when Theme mode is set to Follow system. When turned off, light/dark mode will no longer adapt to the webpage theme color.',
      'Follow system'],
    ['ja', 'Web ページの色に合わせてテーマを自動変更',
      '「テーマ」が「システムに従う」の場合にのみ表示されます。オフにすると、Web ページのテーマカラーに応じたライト／ダークモードの切り替えを行いません。',
      'システムに従う'],
    ['zh_CN', '基于网页色彩自动变更主题色',
      '仅在“深浅色模式”=“跟随系统”时显示，关闭后将不再基于网页主题色变更深浅模式。', '跟随系统设置'],
    ['zh_TW', '依網頁色彩自動變更主題色', '僅在「深淺色模式」=「跟隨系統」時顯示，關閉後將不再依網頁主題色變更深淺模式。', '跟隨系統設定']
  ])('words page theme adaptation in %s with the system theme label it refers to', (locale, title, tooltip, systemLabel) => {
    const messages: unknown = JSON.parse(readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
    const message = (key: string) => {
      const entry: unknown = typeof messages === 'object' && messages !== null ? Reflect.get(messages, key) : null;
      return typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'message') : null;
    };
    expect(message('settings_overlay_page_theme_adaptation_title')).toBe(title);
    expect(message('settings_overlay_page_theme_adaptation_tooltip')).toBe(tooltip);
    expect(message('settings_theme_system')).toBe(systemLabel);
  });

  it('lists the installed fonts once they arrive', async () => {
    let resolveFonts: (fonts: chrome.fontSettings.FontName[]) => void = () => {};
    installedFonts = new Promise((resolve) => { resolveFonts = resolve; });
    renderOptionsView(<AppearanceOverlaySection />);
    expect(openMenu(FONT).map((option) => option.dataset.value)).toEqual(['']);
    await act(async () => resolveFonts(FONTS));
    expect(openMenu(FONT).map((option) => option.dataset.value)).toEqual(['', 'Inter', 'PingFangSC']);
  });
});
