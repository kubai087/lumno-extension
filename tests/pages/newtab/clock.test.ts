import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import newtabHtml from '../../../newtab.html?raw';
import {
  NEWTAB_TIME_FONTS,
  NEWTAB_TOP_CONTENT_TIME,
  newtabTimeFont,
  newtabTimeFontWeight,
  newtabTimeSecondsVisible,
  newtabTopContentMode
} from '../../../src/domain/settings/newtab-time';
import { createBrowserFake } from '../../fakes/browser';
import { REPO_ROOT, parsePageCss, readRepoFile } from '../../fakes/css';
import { getElement, required } from '../../fakes/dom';
import { bootReadyNewtab } from './boot';
import { pause } from './search-page';

// The New Tab clock follows its font, weight and seconds settings; its faces
// and its seconds swap ship with the page.
describe('New Tab clock', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('lang');
  });

  it('draws the stored face, weight and seconds and follows changes from Settings', async () => {
    const browser = createBrowserFake({
      sync: {
        [newtabTopContentMode.key]: NEWTAB_TOP_CONTENT_TIME,
        [newtabTimeSecondsVisible.key]: true,
        [newtabTimeFont.key]: 'jetbrains-mono',
        [newtabTimeFontWeight.key]: 600
      }
    });
    // The page's markup names its language before its scripts set it.
    document.documentElement.lang = 'zh-CN';
    await bootReadyNewtab(browser);
    await pause(100);
    const clock = () => getElement(document, '#_x_extension_newtab_wordmark_2026_unique_ time.x-nt-time-mark');
    const font = required(NEWTAB_TIME_FONTS.find((item) => item.id === 'jetbrains-mono'), 'the JetBrains Mono face');

    expect(clock().getAttribute('data-time-font')).toBe('jetbrains-mono');
    expect(clock().getAttribute('data-show-seconds')).toBe('true');
    expect(clock().getAttribute('datetime')).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(clock().getAttribute('style') || '').toContain(font.family.split(',')[0]);
    expect(clock().getAttribute('style') || '').toMatch(/font-weight: 600/);

    await act(async () => browser.storage.sync.externalSet({ [newtabTimeSecondsVisible.key]: false }));
    await pause(150);
    expect(clock().getAttribute('data-show-seconds')).toBe('false');
    expect(document.querySelectorAll('.x-nt-time-seconds-digit')).toHaveLength(0);
    await act(async () => browser.storage.sync.externalSet({ [newtabTimeFontWeight.key]: 400 }));
    await pause(150);
    expect(clock().getAttribute('style') || '').toMatch(/font-weight: 400/);
  });

  it('declares every Lumno Clock face with its weight range, and New Tab links them', () => {
    const clockFontsCss = readRepoFile('assets/fonts/clock/clock-fonts.css');
    NEWTAB_TIME_FONTS.filter((font) => font.family.startsWith('"Lumno Clock')).forEach((font) => {
      const family = required(font.family.match(/^"([^"]+)"/), `${font.id} family`)[1];
      const face = required(clockFontsCss.match(
        new RegExp(`font-family: "${family}";\\s*src: url\\("\\./([^"]+)"\\)[\\s\\S]*?font-weight: (\\d+) (\\d+);`)
      ), `${family} in clock-fonts.css`);
      expect(existsSync(join(REPO_ROOT, 'assets/fonts/clock', face[1]))).toBe(true);
      expect([Number(face[2]), Number(face[3])]).toEqual([font.minWeight, font.maxWeight]);
    });
    const page = new DOMParser().parseFromString(newtabHtml, 'text/html');
    expect(page.querySelector('link[rel="stylesheet"][href$="assets/fonts/clock/clock-fonts.css"]')).not.toBeNull();
  });

  it('swaps the seconds with a slight scale, without blinking or moving off the line', () => {
    const css = parsePageCss('newtab.html');
    const frames = required(css.keyframes('_x_nt_time_seconds_soft_swap_2026_unique_'), 'the seconds swap keyframes');
    expect([frames['0%'].getPropertyValue('transform'), frames['100%'].getPropertyValue('transform')]).toEqual(['scale(0.985)', 'scale(1)']);
    expect(Object.values(frames).map((frame) => frame.cssText).join(' ')).not.toMatch(/opacity|translate/);
    const digit = required(css.rule('.x-nt-time-seconds-digit', '*'), 'the seconds digit style');
    expect(css.entries.filter((entry) => entry.selectors.some((selector) => selector.includes('.x-nt-time-seconds-digit')))
      .map((entry) => entry.style.getPropertyValue('animation')).join(' ')).toMatch(/_x_nt_time_seconds_soft_swap_2026_unique_ 120ms/);
    expect(digit.has('filter')).toBe(false);
    expect(digit.has('will-change')).toBe(false);
  });

  it.each([
    ['en', 'Time font', 'Time font weight', 'Show seconds'],
    ['ja', '時刻のフォント', '時刻の文字の太さ', '秒を表示'],
    ['zh_CN', '时间字体', '时间字重', '显示秒数'],
    ['zh_TW', '時間字體', '時間字重', '顯示秒數']
  ])('names the clock settings in %s', (locale, fontTitle, weightTitle, secondsTitle) => {
    const messages: Record<string, { message?: string } | undefined> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    expect([messages.newtab_time_font_title?.message, messages.newtab_time_font_weight_title?.message, messages.newtab_time_show_seconds_title?.message])
      .toEqual([fontTitle, weightTitle, secondsTitle]);
  });
});
