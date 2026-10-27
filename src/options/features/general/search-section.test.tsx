import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Settings from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { getElement, getTag, getTags } from '../../../../tests/react/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/react/options-page';
import { GeneralSearchSection } from './search-section';

const SOURCE_TYPES_KEY = Settings.searchResultSourceTypes.key;
const RESET = '_x_extension_search_result_source_types_reset_2026_unique_';

function setUp(stored: Record<string, unknown> = {}) {
  const hideTooltip = vi.fn();
  const view = renderOptionsView(<GeneralSearchSection />, { sync: stored, page: { hideTooltip } });
  const store = (setting: Setting<unknown>, raw: unknown) => view.settings.change(setting, raw);
  return { ...view, store, hideTooltip };
}

const sourceValues = (host: HTMLElement) => getTags(host, '#_x_extension_search_result_source_types_2026_unique_ label', 'label')
  .map((label) => label.dataset.value);

afterEach(cleanUpOptionsViews);

describe('Options General search results section', () => {
  it('shows the stored types and never writes them back on its own', async () => {
    const { host, writes, settings } = setUp({ [SOURCE_TYPES_KEY]: ['bookmark', 'bogus'] });
    await settings.settle();
    expect(getTag(host, '#_x_extension_search_result_source_bookmark_2026_unique_', 'input').checked).toBe(true);
    expect(getTag(host, '#_x_extension_search_result_source_history_2026_unique_', 'input').checked).toBe(false);
    expect(writes).toEqual([]);
  });

  it('keeps at least one type checked and saves the choice', async () => {
    const { host, writes, settings } = setUp({ [SOURCE_TYPES_KEY]: ['history'] });
    await settings.settle();
    const history = getTag(host, '#_x_extension_search_result_source_history_2026_unique_', 'input');
    expect(history.checked).toBe(true);
    act(() => history.click());
    expect(history.checked).toBe(true);
    await settings.settle();
    expect(writes).toEqual([]);
    act(() => getTag(host, '#_x_extension_search_result_source_bookmark_2026_unique_', 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [SOURCE_TYPES_KEY]: ['bookmark', 'history'] }]);
  });

  it('moves a type with Alt and the arrow keys and offers a reset until the defaults return', async () => {
    const { host, writes, hideTooltip, settings } = setUp({ [SOURCE_TYPES_KEY]: ['topSite', 'bookmark', 'history'] });
    expect(getTag(host, `#${RESET}`, 'button').hidden).toBe(true);
    const bookmark = getTag(host, '#_x_extension_search_result_source_bookmark_2026_unique_', 'input');
    act(() => {
      bookmark.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true }));
    });
    expect(sourceValues(host)).toEqual(['bookmark', 'topSite', 'history']);
    const reset = getTag(host, `#${RESET}`, 'button');
    expect(reset.hidden).toBe(false);
    expect(reset.dataset.tooltip).toBe('恢复默认');
    act(() => reset.click());
    expect(hideTooltip).toHaveBeenCalledTimes(1);
    await settings.settle();
    expect(writes).toEqual([{ [SOURCE_TYPES_KEY]: ['topSite', 'bookmark', 'history'] }]);
    expect(sourceValues(host)).toEqual(['topSite', 'bookmark', 'history']);
    expect(reset.hidden).toBe(true);
    expect(document.activeElement).toBe(getTag(host, '#_x_extension_search_result_source_top_site_2026_unique_', 'input'));
  });

  it('switches the first result priority and keeps the hidden select in step', async () => {
    const { host, writes, store, settings } = setUp();
    const buttons = getTags(host, '#_x_extension_search_result_priority_tabs_wrap_2026_unique_ button', 'button');
    expect(buttons.map((button) => button.dataset.active)).toEqual(['true', 'false']);
    act(() => buttons[1]?.click());
    await settings.settle();
    expect(writes).toContainEqual({ [Settings.searchResultPriority.key]: 'search' });
    expect(getTag(host, '#_x_extension_search_result_priority_select_2026_unique_', 'select').value).toBe('search');
    await store(Settings.searchResultPriority, 'autocomplete');
    expect(getTags(host, '#_x_extension_search_result_priority_tabs_wrap_2026_unique_ button', 'button')
      .map((button) => button.dataset.active)).toEqual(['true', 'false']);
  });

  it('saves the display limit from its slider', async () => {
    const { host, writes, store, settings } = setUp();
    await store(Settings.searchResultDisplayLimit, 7);
    const slider = getTag(host, '#_x_extension_search_result_display_limit_slider_2026_unique_', 'input');
    expect(slider.value).toBe('7');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(slider, '9');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settings.settle();
    expect(writes).toContainEqual({ [Settings.searchResultDisplayLimit.key]: 9 });
    expect(getElement(host, '#_x_extension_search_result_display_limit_setting_row_2026_unique_')).toBeTruthy();
  });

  it('saves the pinyin switch', async () => {
    const { host, writes, settings } = setUp({ [SOURCE_TYPES_KEY]: ['topSite', 'bookmark', 'history'] });
    act(() => getTag(host, '#_x_extension_search_fuzzy_pinyin_toggle_2026_unique_', 'input').click());
    await settings.settle();
    expect(writes).toEqual([
      { [Settings.searchFuzzyPinyinEnabled.key]: !Settings.searchFuzzyPinyinEnabled.parse(undefined) }
    ]);
  });
});
