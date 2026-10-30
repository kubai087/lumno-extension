// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parsePageCss, parseStylesheet, type ParsedCss } from '../fakes/css';
import { readLocaleMessages } from './repository';

// Simple mode strips the result rows down; the URL line then takes the room
// the title leaves, on both search surfaces.
describe('simple mode setting', () => {
  it.each([
    ['New Tab', () => parsePageCss('newtab.html'), '.x-nt-suggestion-url-line'],
    ['the overlay', () => parseStylesheet('src/overlay/suggestions-view.css'), '.x-ov-suggestion-url-line']
  ])('lets the URL line on %s use the room the title leaves', (_surface, read: () => ParsedCss, selector) => {
    const rule = read().entries.find((entry) => entry.selectors.some((text) => text.endsWith(selector)) && entry.style.getPropertyValue('flex'));

    expect(rule ? [rule.style.getPropertyValue('flex'), parseFloat(rule.style.getPropertyValue('min-width')), rule.style.getPropertyValue('max-width')] : null)
      .toEqual(['0 1000 auto', 0, '']);
  });

  it.each([
    ['en', 'Minimal mode', 'Remove more decorative elements for a cleaner search box'],
    ['ja', 'シンプルモード', '装飾要素を減らし、検索ボックスをすっきり表示します'],
    ['zh_CN', '简洁模式', '移除更多提示元素，使搜索框更简洁'],
    ['zh_TW', '簡潔模式', '移除更多裝飾元素，讓搜尋框更整潔']
  ])('names and explains the setting in %s', (locale, title, description) => {
    const messages = readLocaleMessages(locale);

    expect(messages.settings_simple_mode_title).toBe(title);
    expect(messages.settings_simple_mode_desc).toBe(description);
  });
});
