import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Settings from '../../../domain/settings';
import { serializeAggregateSearches } from '../../../domain/search/aggregate-search-store';
import { getSiteSearchPinnedIconAssetPath } from '../../../domain/favicon/shortcut-favicon/bundled-icons';
import { getElement, getElements, getTag, getTags, required } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import siteSearchCatalog from '../../../../assets/data/site-search.json';
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

// A custom copy of the YouTube built-in under a new trigger, which turned
// the built-in off.
const OVERRIDE = {
  id: 'source-tube',
  key: 'tube',
  builtinKey: 'yt',
  name: 'Tube',
  template: 'https://www.youtube.com/results?search_query={query}',
  category: 'searchEngine'
};

// The tab with the bundled providers and the stored ones read, as the page
// reads them once it starts.
async function setUpWithProviders(stored: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => siteSearchCatalog })));
  const view = setUp(stored);
  await act(async () => {
    await view.page.siteSearchProviders.refresh();
  });
  await view.settings.settle();
  const saved = () => ({
    custom: readKeys(view.settings.data.sync[Settings.siteSearchCustom.key]),
    disabled: view.settings.data.sync[Settings.siteSearchDisabled.key]
  });
  return { ...view, saved };
}

function readKeys(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value.map((item: unknown) => (typeof item === 'object' && item !== null && 'key' in item ? item.key : null))
    : [];
}

const listCards = (host: HTMLElement, listId: string) => getElements(host, `#${listId} [data-provider-id]`);

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

  it('puts the aggregate searches after the custom search and its form, before the built-in scopes, and clears them after a confirmation', async () => {
    const definitions = serializeAggregateSearches([
      { id: 'research', key: 'rs', name: 'Research', sourceRefs: ['builtin:gg', 'builtin:bi'] },
      { id: 'broken', key: 'br2', name: 'Broken', sourceRefs: ['builtin:gg', 'custom:missing'] }
    ]);
    const { host, writes, settings, page } = await setUpWithProviders({ [Settings.aggregateSearches.key]: definitions });
    await act(async () => {
      await page.aggregateSearches.refresh();
    });
    await settings.settle();
    const order = [
      '#_x_extension_site_search_custom_list_2024_unique_',
      '._x_extension_shortcuts_section_2024_unique_ > ._x_extension_shortcut_form_2024_unique_',
      '#_x_extension_aggregate_search_group_2026_unique_',
      '#_x_extension_site_search_builtin_list_2024_unique_'
    ].map((selector) => getElement(host, selector));
    const follows = (earlier: Node, later: Node) => Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
    order.slice(1).forEach((element, index) => expect(follows(required(order[index]), element)).toBe(true));
    const clear = getTag(host, '#_x_extension_aggregate_search_group_2026_unique_ #_x_extension_aggregate_search_clear_2026_unique_', 'button');
    expect(clear.classList.contains('_x_extension_shortcut_group_action_2024_unique_')).toBe(true);
    expect(getElement(host, '#_x_extension_aggregate_search_list_2026_unique_')).toBeTruthy();

    act(() => clear.click());
    const popconfirm = getElement(host, '#_x_extension_aggregate_search_clear_2026_unique__popconfirm');
    expect(popconfirm.getAttribute('data-open')).toBe('true');
    expect(writes.some((write) => Object.hasOwn(write, Settings.aggregateSearches.key))).toBe(false);
    const buttons = getTags(popconfirm, 'button', 'button');
    const confirmButton = buttons.find((button) => !/取消|Cancel/.test(button.textContent || ''));
    expect(buttons).toHaveLength(2);
    await act(async () => {
      confirmButton?.click();
      await Promise.resolve();
    });
    await settings.settle();
    const cleared = writes.filter((write) => Object.hasOwn(write, Settings.aggregateSearches.key)).pop();
    expect(cleared?.[Settings.aggregateSearches.key]).toEqual(serializeAggregateSearches([]));
  });

  it('puts the auto-group switch with the aggregate searches, before their list, under a title that leaves out the section name', () => {
    const { host } = setUp();
    const toggle = getTag(host, `#${AUTO_GROUP_TOGGLE}`, 'input');
    expect(toggle.closest('#_x_extension_aggregate_search_group_2026_unique_')).not.toBeNull();
    expect(toggle.compareDocumentPosition(getElement(host, '#_x_extension_aggregate_search_list_2026_unique_')) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const row = required(toggle.closest('._x_extension_setting_row_2024_unique_'), 'the switch row');
    expect(getElement(row, '._x_extension_setting_title_2024_unique_ span').textContent).toBe('自动创建标签页组');
  });

  it('places the custom entry first and the built-in search engines last, in a list of their own', () => {
    const { host } = setUp();
    const follows = (earlier: string, later: string) => Boolean(getElement(host, `#${earlier}`)
      .compareDocumentPosition(getElement(host, `#${later}`)) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows('_x_extension_site_search_custom_list_2024_unique_', '_x_extension_site_search_builtin_list_2024_unique_')).toBe(true);
    expect(follows('_x_extension_site_search_builtin_list_2024_unique_', '_x_extension_site_search_ai_group_2026_unique_')).toBe(true);
    expect(follows('_x_extension_site_search_ai_group_2026_unique_', '_x_extension_search_engine_group_2026_unique_')).toBe(true);
    expect(getElement(host, '#_x_extension_search_engine_builtin_list_2026_unique_').classList
      .contains('_x_extension_shortcut_list_2024_unique_')).toBe(true);
    // The add form picks the group a custom provider shows in, site search first.
    const categories = getTags(host, '._x_extension_site_search_category_tabs_2026_unique_ [data-site-search-category]', 'button');
    expect(categories.map((button) => [button.dataset.siteSearchCategory, button.getAttribute('aria-pressed')]))
      .toEqual([['site', 'true'], ['searchEngine', 'false']]);
    expect(getElement(host, '._x_extension_site_search_category_tabs_2026_unique_').getAttribute('role')).toBe('group');
  });

  it('lists the built-in search engines in their own group, badged and with their bundled tiles', async () => {
    const { host } = await setUpWithProviders();
    const engines = siteSearchCatalog.items.filter((item) => 'category' in item && item.category === 'searchEngine');
    const cards = listCards(host, '_x_extension_search_engine_builtin_list_2026_unique_');
    expect(engines.length).toBeGreaterThan(0);
    expect(cards.map((card) => card.dataset.key).sort()).toEqual(engines.map((item) => item.key).sort());
    cards.forEach((card) => {
      const badges = getElements(card, '._x_extension_shortcut_badge_2024_unique_').map((badge) => badge.textContent);
      expect(badges).toContain('内置');
      const engine = required(engines.find((item) => item.key === card.dataset.key), card.dataset.key);
      expect(getTag(card, 'img', 'img').getAttribute('src'))
        .toBe(`chrome-extension://lumno/${getSiteSearchPinnedIconAssetPath(engine)}`);
    });
    const siteCards = listCards(host, '_x_extension_site_search_builtin_list_2024_unique_');
    expect(siteCards.length).toBeGreaterThan(0);
    expect(siteCards.every((card) => card.dataset.providerCategory !== 'searchEngine')).toBe(true);
  });

  it('turns a built-in back on when its renamed custom copy is removed', async () => {
    const { host, saved, settings } = await setUpWithProviders({
      [Settings.siteSearchCustom.key]: [OVERRIDE],
      [Settings.siteSearchDisabled.key]: ['yt']
    });
    const card = getElement(host, '#_x_extension_site_search_custom_list_2024_unique_ [data-key="tube"]');
    act(() => getTag(card, '._x_extension_shortcut_remove_2024_unique_', 'button').click());
    await act(async () => {
      getTags(card, '._x_extension_popconfirm_2024_unique_[data-open="true"] button', 'button').at(-1)?.click();
    });
    await settings.settle();
    expect(saved()).toEqual({ custom: [], disabled: [] });
  });

  it('drops renamed custom copies of built-ins when the built-ins are reset', async () => {
    const { host, saved, settings } = await setUpWithProviders({
      [Settings.siteSearchCustom.key]: [OVERRIDE],
      [Settings.siteSearchDisabled.key]: ['yt']
    });
    await confirm(host, '_x_extension_builtin_reset_2024_unique_');
    await settings.settle();
    expect(saved()).toEqual({ custom: [], disabled: [] });
  });

  it('turns the built-ins back on in the same write that clears the custom providers', async () => {
    const { host, saved, settings, writes } = await setUpWithProviders({
      [Settings.siteSearchCustom.key]: [OVERRIDE],
      [Settings.siteSearchDisabled.key]: ['yt']
    });
    const before = writes.length;
    await confirm(host, '_x_extension_custom_clear_2024_unique_');
    await settings.settle();
    expect(saved()).toEqual({ custom: [], disabled: [] });
    const clearing = writes.slice(before).filter((write) => Settings.siteSearchCustom.key in write);
    expect(clearing).toEqual([{ [Settings.siteSearchCustom.key]: [], [Settings.siteSearchDisabled.key]: [] }]);
  });

  it('labels the query insert button of the add form in the page language', () => {
    const { host } = setUp();
    expect(getTag(host, '#_x_extension_site_search_insert_query_2026_unique_', 'button').textContent).toBe('插入查询变量');
  });
});
