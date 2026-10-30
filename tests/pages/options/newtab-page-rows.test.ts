import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BROWSER_SYNC_KEYS } from '../../../src/domain/settings/registry';
import { newtabAppearanceButtonVisible, newtabFeedbackButtonVisible, newtabInputAutoFocusEnabled } from '../../../src/domain/settings/newtab-page';
import { progressTrackingEnabled } from '../../../src/domain/settings/recent-sites';
import {
  NEWTAB_TIME_FONTS,
  NEWTAB_TOP_CONTENT_BRAND,
  newtabTimeFont,
  newtabTopContentMode,
  resolveNewtabTimeFontWeight
} from '../../../src/domain/settings/newtab-time';
import { createBrowserFake } from '../../fakes/browser';
import { getElement, getElementById, getElements, getTag, required } from '../../fakes/dom';
import { bootOptionsPage, settle } from './boot';

// Settings' rows for the New Tab page: the clock's options under the top
// content choice, input auto-focus, the page button switches and progress
// tracking.
const TOP_CONTENT_TABS = '_x_extension_newtab_top_content_tabs_wrap_2026_unique_';
const AUTO_FOCUS_TOGGLE = '_x_extension_newtab_input_auto_focus_toggle_2026_unique_';
const TIME_SUBROWS = '_x_extension_newtab_time_subrows_2026_unique_';
const timeRow = (name: string) => `_x_extension_newtab_time_${name}_row_2026_unique_`;
const follows = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
const wait = (ms: number) => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, ms));
});

async function bootWithClockFolded() {
  const browser = createBrowserFake({ sync: { [newtabTopContentMode.key]: NEWTAB_TOP_CONTENT_BRAND } });
  await bootOptionsPage(browser);
  return browser;
}

describe('Settings rows for the New Tab page', () => {
  it('places the clock font, weight and seconds right after the top content choice, folded while it shows the wordmark', async () => {
    await bootWithClockFolded();
    const order = [TOP_CONTENT_TABS, timeRow('font'), timeRow('font_weight'), timeRow('seconds'), AUTO_FOCUS_TOGGLE].map(getElementById);
    order.slice(1).forEach((element, index) => expect(follows(order[index], element)).toBe(true));

    const subrows = getElementById(TIME_SUBROWS);
    expect([subrows.getAttribute('data-expanded'), subrows.hasAttribute('inert')]).toEqual(['false', true]);
    ['font', 'font_weight', 'font_size', 'opacity', 'ink', 'seconds', '12_hour'].forEach((name) => {
      expect(subrows.contains(getElementById(timeRow(name)))).toBe(true);
    });
    expect(getTag(document, '#_x_extension_newtab_time_seconds_toggle_2026_unique_', 'input').type).toBe('checkbox');
    const twelveHour = getTag(document, '#_x_extension_newtab_time_12_hour_toggle_2026_unique_', 'input');
    expect([twelveHour.type, twelveHour.getAttribute('data-i18n-aria-label')]).toEqual(['checkbox', 'newtab_time_12_hour_title']);
  });

  it('reveals the clock options with a weight slider over the chosen face when the clock is chosen', async () => {
    await bootWithClockFolded();
    await act(async () => {
      getElement(document, `#${TOP_CONTENT_TABS} [data-newtab-top-content="time"]`).click();
    });
    await wait(400);
    await settle();

    expect(getElementById(TIME_SUBROWS).getAttribute('data-expanded')).toBe('true');
    const slider = getTag(document, `#${timeRow('font_weight')} input[type="range"]`, 'input');
    const font = required(NEWTAB_TIME_FONTS.find((item) => item.id === newtabTimeFont.parse(undefined)), 'the default clock face');
    expect([slider.min, slider.max, slider.step, slider.value])
      .toEqual([String(font.minWeight), String(font.maxWeight), '1', String(resolveNewtabTimeFontWeight(font.id, undefined))]);
  });

  it('offers input auto-focus as a labelled switch, off by default, and keeps the shortcuts switch', async () => {
    await bootOptionsPage(createBrowserFake());
    const toggle = getTag(document, `#${AUTO_FOCUS_TOGGLE}`, 'input');

    expect([toggle.type, toggle.checked, toggle.getAttribute('data-i18n-aria-label')]).toEqual(['checkbox', false, 'newtab_input_auto_focus_title']);
    expect(document.getElementById('_x_extension_newtab_shortcuts_toggle_2026_unique_')).not.toBeNull();
    expect(newtabInputAutoFocusEnabled.key).toBe('_x_extension_newtab_input_auto_focus_enabled_2026_unique_');
    expect(BROWSER_SYNC_KEYS).toContain(newtabInputAutoFocusEnabled.key);
  });

  it.each([
    [newtabFeedbackButtonVisible, '_x_extension_newtab_feedback_button_visible_toggle_2026_unique_', 'settings_newtab_feedback_button_visible_title',
      '_x_extension_newtab_feedback_button_visible_2026_unique_'],
    [newtabAppearanceButtonVisible, '_x_extension_newtab_appearance_button_visible_toggle_2026_unique_', 'settings_newtab_appearance_button_visible_title',
      '_x_extension_newtab_appearance_button_visible_2026_unique_']
  ])('shows the page button by default and saves turning it off (%#)', async (setting, toggleId, labelKey, storageKey) => {
    const browser = createBrowserFake();
    const set = vi.spyOn(browser.storage.sync, 'set');
    await bootOptionsPage(browser);
    const toggle = getTag(document, `#${toggleId}`, 'input');

    expect(setting.key).toBe(storageKey);
    expect(toggle.checked).toBe(true);
    expect(toggle.getAttribute('data-i18n-aria-label')).toBe(labelKey);
    await act(async () => toggle.click());
    await wait(50);
    expect(set.mock.calls.some((call) => call[0][storageKey] === false)).toBe(true);
  });

  it('offers progress tracking in General’s New Tab section, on by default', async () => {
    await bootOptionsPage(createBrowserFake());
    const toggle = getTag(document, '#_x_extension_progress_tracking_toggle_2026_unique_', 'input');
    const general = getElement(document, '[data-content="general"]');
    const headings = getElements(general, '._x_extension_section_title_2024_unique_');
    const heading = required(headings.find((node) => node.textContent === 'New Tab Settings'), 'the New Tab heading');
    const next = headings[headings.indexOf(heading) + 1];

    expect([toggle.type, toggle.checked]).toEqual(['checkbox', true]);
    expect(general.contains(toggle)).toBe(true);
    expect(follows(heading, toggle)).toBe(true);
    if (next) expect(follows(toggle, next)).toBe(true);
    expect(progressTrackingEnabled.parse(undefined)).toBe(true);
    expect(progressTrackingEnabled.parse(false)).toBe(false);
  });
});
