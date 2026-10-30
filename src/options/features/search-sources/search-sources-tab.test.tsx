import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Settings from '../../../domain/settings';
import { getElement, getTag, getTags } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { SearchSourcesTab } from './search-sources-tab';

const AUTO_GROUP_KEY = Settings.aggregateSearchAutoGroupEnabled.key;
const AUTO_GROUP_TOGGLE = '_x_extension_aggregate_search_auto_group_toggle_2026_unique_';

function setUp(stored: Record<string, unknown> = {}) {
  return renderOptionsView(<SearchSourcesTab />, { sync: stored });
}

async function confirm(host: HTMLElement, id: string): Promise<void> {
  act(() => getTag(host, `#${id}`, 'button').click());
  const buttons = getTags(host, `#${id}_popconfirm button`, 'button');
  await act(async () => {
    buttons[buttons.length - 1]?.click();
    await Promise.resolve();
  });
}

const chips = (host: HTMLElement) => getTags(host, '#_x_extension_search_source_group_order_2026_unique_ [data-group]', 'div')
  .map((chip) => chip.dataset.group);

afterEach(cleanUpOptionsViews);

describe('Options Search sources tab', () => {
  it('draws the groups in their order, with the list hosts the page and its tests read', () => {
    const { host, page } = setUp();
    expect(chips(host)).toEqual(page.sourceOrder.getOrder().groups);
    [
      '_x_extension_site_search_custom_list_2024_unique_',
      '_x_extension_aggregate_search_group_2026_unique_',
      '_x_extension_aggregate_search_list_2026_unique_',
      '_x_extension_site_search_builtin_list_2024_unique_',
      '_x_extension_site_search_ai_group_2026_unique_',
      '_x_extension_search_engine_builtin_list_2026_unique_'
    ].forEach((id) => expect(getElement(host, `#${id}`)).toBeTruthy());
  });

  it('moves a group chip with Alt and the arrow keys and keeps it focused', () => {
    const { host } = setUp();
    const before = chips(host);
    const chip = getElement(host, `[data-group="${before[2]}"]`);
    chip.focus();
    act(() => {
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true }));
    });
    expect(chips(host)).toEqual([before[0], before[2], before[1], ...before.slice(3)]);
    expect(document.activeElement).toBe(getElement(host, `[data-group="${before[2]}"]`));
  });

  it('shows the custom providers and only then allows clearing them', async () => {
    const { host, page } = setUp();
    const clear = () => getTag(host, '#_x_extension_custom_clear_2024_unique_', 'button');
    expect(clear().disabled).toBe(true);
    act(() => page.siteSearchProviders.store.setState({
      custom: [{ id: 'source-1', key: 'ex', name: 'Example', template: 'https://example.com/?q={query}', aliases: [] }]
    }));
    expect(getElement(host, '#_x_extension_site_search_custom_list_2024_unique_ [data-provider-id="custom:ex"]')).toBeTruthy();
    expect(clear().disabled).toBe(false);
    const clearCustom = vi.spyOn(page.siteSearchProviders, 'clearCustom').mockResolvedValue();
    await confirm(host, '_x_extension_custom_clear_2024_unique_');
    expect(clearCustom).toHaveBeenCalledTimes(1);
  });

  it('asks before resetting the built-in list', async () => {
    const { host, page } = setUp();
    const reset = getTag(host, '#_x_extension_builtin_reset_2024_unique_', 'button');
    expect(reset.disabled).toBe(false);
    expect(reset.dataset.tooltip).toBe('重置为初始列表');
    const resetBuiltins = vi.spyOn(page.siteSearchProviders, 'resetBuiltins').mockResolvedValue();
    await confirm(host, '_x_extension_builtin_reset_2024_unique_');
    expect(resetBuiltins).toHaveBeenCalledTimes(1);
  });

  it('derives the auto-group switch from older aggregate searches and saves it once', async () => {
    // An install with no aggregate searches yet gets grouping on.
    const { host, writes, settings } = setUp({ [Settings.aggregateSearches.key]: [] });
    await settings.settle();
    expect(getTag(host, `#${AUTO_GROUP_TOGGLE}`, 'input').checked).toBe(true);
    expect(writes).toEqual([{ [AUTO_GROUP_KEY]: true }]);
  });

  it('keeps a stored auto-group choice and follows changes to it', async () => {
    const { host, settings, writes } = setUp({ [AUTO_GROUP_KEY]: true });
    await settings.settle();
    expect(writes).toEqual([]);
    await settings.change(Settings.aggregateSearchAutoGroupEnabled, false);
    expect(getTag(host, `#${AUTO_GROUP_TOGGLE}`, 'input').checked).toBe(false);
    act(() => getTag(host, `#${AUTO_GROUP_TOGGLE}`, 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [AUTO_GROUP_KEY]: true }]);
    expect(getTag(host, `#${AUTO_GROUP_TOGGLE}`, 'input').getAttribute('aria-label')).toBe('聚合搜索自动创建标签页组');
  });
});
