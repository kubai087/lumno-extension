import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Settings from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { getElement, getTag, getTags } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { GeneralShortcutsSection } from './shortcuts-section';

function setUp() {
  const view = renderOptionsView(<GeneralShortcutsSection />, { page: { isMacPlatform: true } });
  const store = (setting: Setting<unknown>, raw: unknown) => view.settings.change(setting, raw);
  return { ...view, store };
}

afterEach(cleanUpOptionsViews);

describe('Options General shortcuts section', () => {
  it('opens the browser\'s shortcuts page and reports a failure', () => {
    const { host, sendMessage, page } = setUp();
    act(() => getTag(host, '#_x_extension_open_shortcuts_page_2026_unique_', 'button').click());
    expect(sendMessage.mock.calls.map(([message]) => message)).toEqual([{ action: 'openExtensionShortcutsPage' }]);
    expect(page.showToast).not.toHaveBeenCalled();
    sendMessage.mockImplementation((_message: unknown, callback?: (reply: unknown) => void) => {
      if (callback) callback({ ok: false });
    });
    act(() => getTag(host, '#_x_extension_open_shortcuts_page_2026_unique_', 'button').click());
    expect(page.showToast).toHaveBeenCalledWith('操作失败，请重试。', true);
  });

  it('shows the search shortcut once the browser answers, or its default', () => {
    const { host, page } = setUp();
    const status = getElement(host, '#_x_extension_shortcuts_status_2024_unique_');
    expect(status.textContent).toBe('未设置');
    act(() => page.commands.store.setState({ read: true, commands: [{ name: 'show-search', shortcut: ' ⌥K ' }] }));
    expect(status.textContent).toBe('⌥K');
    act(() => page.commands.store.setState({ read: true, commands: undefined }));
    expect(status.textContent).toBe('⌘⇧K');
    const dia = getElement(host, '._x_extension_shortcuts_dia_badge_2026_unique_');
    expect(dia.dataset.browserOnly).toBe('chromium');
    expect(dia.dataset.tooltip).toContain('Dia');
  });

  it('saves the restricted page action together with the one-time setting step', async () => {
    const { host, writes, store, settings } = setUp();
    await store(Settings.restrictedAction, 'lumno');
    const buttons = getTags(host, '#_x_extension_restricted_action_tabs_wrap_2024_unique_ button', 'button');
    expect(buttons.map((button) => button.dataset.active)).toEqual(['true', 'false']);
    act(() => buttons[1]?.click());
    await settings.settle();
    expect(writes).toEqual([{
      [Settings.restrictedAction.key]: 'none',
      [Settings.restrictedActionAutoBrowserSettingDone.key]: true
    }]);
    expect(getTag(host, '#_x_extension_restricted_action_select_2024_unique_', 'select').value).toBe('none');
    expect(getElement(host, '#_x_extension_restricted_action_info_2026_unique_ ._x_extension_info_button_2026_unique_').dataset.tooltip)
      .toContain('受限页');
  });

  it('lists the shortcuts once the browser answers', () => {
    const { host, page } = setUp();
    expect(getElement(host, '#_x_extension_shortcut_reference_list_2026_unique_').childElementCount).toBe(0);
    act(() => page.commands.store.setState({ read: true, commands: [{ name: 'show-tab-switcher', shortcut: '⌥Q' }] }));
    expect(getElement(host, '[data-shortcut-id="show-tab-switcher"]').textContent).toContain('⌥Q');
  });

  it('keeps quick switching on', async () => {
    const { host, store } = setUp();
    const toggle = () => getTag(host, '#_x_extension_overlay_tab_quick_switch_2024_unique_', 'input');
    expect(toggle().checked).toBe(true);
    await store(Settings.overlayTabPriority, false);
    expect(toggle().checked).toBe(true);
  });
});
