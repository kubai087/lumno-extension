import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Settings from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { getElement, getTag, getTags } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { GeneralFeaturesSection } from './features-section';

const TAB_SWITCHER_TOGGLE = '_x_extension_tab_switcher_toggle_2026_unique_';
const SELECTION_TOGGLE = '_x_extension_selection_quick_actions_toggle_2026_unique_';
const GROUP_TOGGLE = '_x_extension_selection_quick_actions_group_toggle_2026_unique_';
const PROVIDER_SELECT = '_x_extension_selection_quick_actions_provider_select_2026_unique_';
const AUTO_PIP_TOGGLE = '_x_extension_auto_pip_toggle_2024_unique_';

function setUp(browserFamily = 'chromium') {
  const view = renderOptionsView(<GeneralFeaturesSection />, { page: { browserFamily, isMacPlatform: true } });
  const store = (setting: Setting<unknown>, raw: unknown) => view.settings.change(setting, raw);
  return { ...view, store };
}

const toggle = (host: HTMLElement, id: string) => getTag(host, `#${id}`, 'input');

afterEach(cleanUpOptionsViews);

describe('Options General features section', () => {
  it('starts from each setting\'s default', () => {
    const { host } = setUp();
    expect(toggle(host, TAB_SWITCHER_TOGGLE).checked).toBe(true);
    expect(toggle(host, '_x_extension_tab_switcher_current_window_only_toggle_2026_unique_').checked).toBe(false);
    expect(toggle(host, AUTO_PIP_TOGGLE).checked).toBe(true);
    expect(toggle(host, '_x_extension_pinned_tab_recovery_toggle_2026_unique_').checked).toBe(false);
    expect(toggle(host, SELECTION_TOGGLE).checked).toBe(false);
    expect(toggle(host, GROUP_TOGGLE).checked).toBe(false);
  });

  it('opens the tab switcher\'s window option only while the switcher is on', async () => {
    const { host, writes, store, settings } = setUp();
    const subrows = getElement(host, '#_x_extension_tab_switcher_subrows_2026_unique_');
    expect(subrows.dataset.expanded).toBe('true');
    expect(subrows.dataset.motion).toBe('off');
    act(() => toggle(host, TAB_SWITCHER_TOGGLE).click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.tabSwitcherEnabled.key]: false }]);
    expect(subrows.dataset.expanded).toBe('false');
    expect(subrows.hasAttribute('inert')).toBe(true);
    await store(Settings.tabSwitcherEnabled, true);
    expect(subrows.dataset.expanded).toBe('true');
  });

  it('fills the platform shortcut into the tab switcher\'s hint', () => {
    const { host } = setUp();
    const row = getTag(host, `#${TAB_SWITCHER_TOGGLE}`, 'input').closest('._x_extension_setting_row_2024_unique_');
    const info = row ? getElement(row, '._x_extension_info_button_2026_unique_') : null;
    expect(info?.dataset.tooltip).toBe('快速切换最近标签页，默认 ⌥Q，可自定义');
  });

  it('shows the Ctrl+Tab guide beside the tab switcher once the shortcut is known', () => {
    const { host, page } = setUp();
    expect(host.querySelector('#_x_extension_tab_switcher_ctrl_tab_link_2026_unique_')).toBeNull();
    act(() => page.commands.store.setState({ read: true, commands: [{ name: 'show-tab-switcher', shortcut: '⌥Q' }] }));
    const link = getTag(host, '#_x_extension_tab_switcher_ctrl_tab_link_2026_unique_', 'a');
    expect(link.href).toContain('tab-switcher');
    expect(link.href).toContain('#ctrl-tab');
    expect(link.textContent).toBe('像 Arc 一样用 ⌃Tab 切换');
    expect(link.dataset.browserOnly).toBe('chromium');
    expect(link.dataset.bound).toBe('false');
  });

  it('locks the selection provider and grouping while the toolbar is off', async () => {
    const { host, store } = setUp();
    const providerRow = getElement(host, '#_x_extension_selection_quick_actions_provider_row_2026_unique_');
    expect(providerRow.dataset.disabled).toBe('true');
    expect(getTag(host, `#${PROVIDER_SELECT}`, 'select').disabled).toBe(true);
    expect(toggle(host, GROUP_TOGGLE).disabled).toBe(true);
    await store(Settings.selectionQuickActionsEnabled, true);
    expect(providerRow.dataset.disabled).toBe('false');
    expect(getTag(host, `#${PROVIDER_SELECT}`, 'select').disabled).toBe(false);
    expect(toggle(host, GROUP_TOGGLE).disabled).toBe(false);
    expect(getElement(host, '#_x_extension_selection_quick_actions_subrows_2026_unique_').dataset.expanded).toBe('true');
  });

  it('pairs each selection provider with its bundled tile and describes grouping as a background query', async () => {
    const { host, store } = setUp();
    await store(Settings.selectionQuickActionsEnabled, true);
    const options = getTags(host, `#${PROVIDER_SELECT} option`, 'option');
    expect(options.length).toBeGreaterThanOrEqual(8);
    const groupRow = getElement(host, '#_x_extension_selection_quick_actions_group_row_2026_unique_');
    expect(getElement(groupRow, '._x_extension_setting_title_with_icon_2024_unique_ > span').textContent).toBe('在后台查询');
    expect(getElement(groupRow, '._x_extension_info_button_2026_unique_').dataset.tooltip).toBe('所有 AI 网页皆归入「AI 查询」标签组');
  });

  it('saves the chosen provider', async () => {
    const { host, writes, store, settings } = setUp();
    await store(Settings.selectionQuickActionsEnabled, true);
    const frame = getElement(host, `[data-select="${PROVIDER_SELECT}"]`);
    await act(async () => {
      getTag(frame, '._x_extension_select_trigger_2024_unique_', 'button').click();
    });
    await act(async () => {
      getElement(frame, '[data-value="gm"]').click();
    });
    await settings.settle();
    expect(writes).toEqual([{ [Settings.selectionQuickActionsProvider.key]: 'gm' }]);
  });

  it('keeps picture-in-picture off and disabled on Firefox without touching the synced value', async () => {
    const { host, writes, store, settings } = setUp('firefox');
    await store(Settings.autoPipEnabled, true);
    const input = toggle(host, AUTO_PIP_TOGGLE);
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(true);
    const row = input.closest('._x_extension_setting_row_2024_unique_');
    expect(row?.getAttribute('data-unsupported')).toBe('true');
    await settings.settle();
    expect(writes).toEqual([]);
  });
});
