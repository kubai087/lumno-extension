// The appearance panel's styles, alternate favicon and copy, as shipped.
import { describe, expect, it } from 'vitest';
import { parsePageCss, readRepoFile } from '../../fakes/css';
import type { CssRule } from '../../fakes/css';
import { required } from '../../fakes/dom';

const css = parsePageCss('newtab.html');
const rule = (selector: string): CssRule => required(css.rule(selector), selector);

describe('the appearance panel styles', () => {
  it('lay the favicon options out left to right in quarter-width square tiles', () => {
    const options = rule('.x-nt-favicon-options');
    expect(options.get('display')).toBe('flex');
    expect(options.get('justify-content')).toBe('flex-start');
    expect(options.get('gap')).toBe('var(--x-nt-panel-grid-gap)');
    expect(options.has('grid-template-columns')).toBe(false);

    const quarter = 'calc((100% - (var(--x-nt-panel-grid-gap) * 3)) / 4)';
    const option = rule('.x-nt-favicon-option');
    expect(String(option.get('width')).replace(/\s+/g, ' ')).toBe(quarter);
    expect(String(option.get('flex')).replace(/\s+/g, ' ')).toBe(`0 0 ${quarter}`);

    const thumb = rule('.x-nt-favicon-thumb');
    expect(thumb.get('width')).toBe('100%');
    expect(String(thumb.get('aspect-ratio')).replace(/\s+/g, '')).toBe('1/1');
    expect(thumb.has('height')).toBe(false);

    const selected = rule('.x-nt-favicon-option[data-selected="true"] .x-nt-favicon-thumb::after');
    expect(selected.get('inset')).toBe('0');
    expect(selected.get('border-radius')).toBe('inherit');
  });

  it('give segmented tab indicators and buttons one inner radius, derived from the full inset', () => {
    expect(rule('.x-nt-segmented-tabs').get('--x-nt-segmented-tabs-inner-radius'))
      .toMatch(/^calc\(.*--x-nt-segmented-tabs-radius.*--x-nt-segmented-tabs-border-width.*--x-nt-segmented-tabs-inset/);
    ['.x-nt-segmented-tabs-indicator', '.x-nt-segmented-tab'].forEach((selector) => {
      expect(rule(selector).get('border-radius')).toBe('var(--x-nt-segmented-tabs-inner-radius)');
    });
  });

  it('size the filter dropdown like the other row controls, as tall as the slider inputs', () => {
    expect(rule('.x-nt-row-select').get('flex')).toBe('0 0 var(--x-nt-row-control-width)');
    expect(rule('.x-nt-row-select ._x_extension_select_trigger_2024_unique_').get('height')).toBe('30px');
  });

  it('tint the alternate favicon preview from the page\'s dark theme', () => {
    const darkPreview = rule('body[data-theme="dark"] .x-nt-favicon-svg-preview');
    expect([darkPreview.get('color'), darkPreview.get('--x-nt-favicon-main-opacity')]).toEqual(['#f1f3f4', '0.72']);
  });
});

describe('the alternate favicon', () => {
  const svg = readRepoFile('assets/images/lumno-newtab-favicon.svg');

  it('is the supplied lumno1.svg, tintable from its root color', () => {
    expect(svg).toMatch(/M14\.1832/);
    expect(svg).toMatch(/M34\.0761/);
    expect(svg).toMatch(/currentColor/);
    expect(svg).not.toMatch(/fill="black"/i);
    expect(svg).not.toMatch(/url\(#paint/i);
  });

  it('adapts to the browser\'s dark theme', () => {
    expect(svg).toMatch(/prefers-color-scheme:\s*dark/);
    expect(svg).toMatch(/color:\s*#000000;/i);
    expect(svg).toMatch(/--x-nt-favicon-main-opacity:\s*0\.5/i);
    expect(svg).toMatch(/--x-nt-favicon-main-opacity:\s*0\.72/i);
  });
});

describe('the copy for the content above the search bar', () => {
  it.each([
    ['zh_CN', '搜索框上方内容', '品牌标识', '时间', '隐藏'],
    ['zh_TW', '搜尋框上方內容', '品牌標識', '時間', '隱藏'],
    ['en', 'Content above the search bar', 'Brand', 'Time', 'Hide'],
    ['ja', '検索ボックス上のコンテンツ', 'ブランド', '時刻', '非表示']
  ])('reads naturally in %s', (locale, title, brand, time, off) => {
    const messages: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    const message = (key: string): unknown => {
      const entry: unknown = typeof messages === 'object' && messages !== null ? Reflect.get(messages, key) : undefined;
      return typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'message') : undefined;
    };
    expect(['settings_newtab_wordmark_title', 'newtab_top_content_brand', 'newtab_top_content_time', 'newtab_top_content_off']
      .map(message)).toEqual([title, brand, time, off]);
  });
});
