import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Settings from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { getTag, getTags } from '../../../../tests/react/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/react/options-page';
import { GeneralNewtabSection } from './newtab-section';

const OPEN_KEY = Settings.newtabOpenInNewTab.key;

function setUp() {
  const view = renderOptionsView(<GeneralNewtabSection />);
  const store = (setting: Setting<unknown>, raw: unknown) => view.settings.change(setting, raw);
  return { ...view, store };
}

afterEach(cleanUpOptionsViews);

describe('Options General New Tab section', () => {
  it('shows both settings as stored and never rewrites them on its own', async () => {
    const { settings } = setUp();
    await settings.settle();
    expect(settings.writes).toEqual([]);
  });

  it('turns progress tracking on by default', () => {
    const { host } = setUp();
    expect(getTag(host, '#_x_extension_progress_tracking_toggle_2026_unique_', 'input').checked).toBe(true);
  });

  it('saves every surface together when one of them changes', async () => {
    const { host, writes, store, settings } = setUp();
    await store(Settings.newtabOpenInNewTab, { search: true });
    const group = getTag(host, '#_x_extension_newtab_open_in_new_tab_2026_unique_', 'div');
    const boxes = getTags(group, 'input', 'input');
    expect(boxes.map((input) => input.checked)).toEqual([true, false, false, false]);
    expect(getTags(group, 'label', 'label').map((label) => label.textContent)).toEqual(['搜索结果', '快捷方式', '书签', '站点卡片']);
    act(() => getTag(host, '#_x_extension_newtab_open_in_new_tab_bookmarks_2026_unique_', 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [OPEN_KEY]: { search: true, shortcuts: false, bookmarks: true, recentSites: false } }]);
  });

  it('lets every surface open in the current tab', async () => {
    const { host, writes, store, settings } = setUp();
    await store(Settings.newtabOpenInNewTab, { search: true });
    act(() => getTag(host, '#_x_extension_newtab_open_in_new_tab_search_2026_unique_', 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [OPEN_KEY]: { search: false, shortcuts: false, bookmarks: false, recentSites: false } }]);
  });
});
