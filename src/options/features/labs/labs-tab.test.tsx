import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Settings from '../../../domain/settings';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/react/options-page';
import { LabsTab } from './labs-tab';
import { getElement, getTag, getTags } from '../../../../tests/react/dom';

const PIP_TOGGLE = '_x_extension_document_pip_toggle_2026_unique_';
const INSTANT_TOGGLE = '_x_extension_number_shortcut_instant_toggle_2026_unique_';
const MAC_CTRL_TOGGLE = '_x_extension_macos_ctrl_suggestion_navigation_toggle_2026_unique_';

function setUp(browserFamily = 'chrome') {
  const view = renderOptionsView(<LabsTab />, { page: { browserFamily } });
  return {
    ...view,
    // The page now shows these messages in another language.
    setLanguage(messages: string[]) {
      act(() => view.page.locale.store.setState({
        messages: Object.fromEntries(messages.map((key) => [key, { message: `en:${key}` }]))
      }));
    }
  };
}

afterEach(cleanUpOptionsViews);

describe('Options Labs tab', () => {
  it('draws each experiment off, with dividers between the rows', () => {
    const { host } = setUp();
    const rows = getTags(host, '._x_extension_setting_row_2024_unique_', 'div');
    expect(rows).toHaveLength(3);
    expect(getTags(host, '._x_extension_setting_divider_wrap_2024_unique_', 'div')).toHaveLength(2);
    [PIP_TOGGLE, INSTANT_TOGGLE, MAC_CTRL_TOGGLE].forEach((id) => {
      expect(getTag(host, `#${id}`, 'input').checked).toBe(false);
    });
  });

  it('binds every experiment and follows its stored value', async () => {
    const { host, settings } = setUp();
    await settings.change(Settings.numberShortcutInstantEnabled, true);
    expect(getTag(host, `#${INSTANT_TOGGLE}`, 'input').checked).toBe(true);
    await settings.change(Settings.documentPipEnabled, 'yes');
    expect(getTag(host, `#${PIP_TOGGLE}`, 'input').checked).toBe(false);
  });

  it('saves a switched experiment', async () => {
    const { host, writes, settings } = setUp();
    act(() => getTag(host, `#${MAC_CTRL_TOGGLE}`, 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.macosCtrlSuggestionNavigationEnabled.key]: true }]);
    expect(getTag(host, `#${MAC_CTRL_TOGGLE}`, 'input').checked).toBe(true);
  });

  it('shows web clip off and disabled where the browser lacks it, keeping the synced value', async () => {
    const { host, writes, settings } = setUp('firefox');
    await settings.change(Settings.documentPipEnabled, true);
    const row = getElement(host, '#_x_extension_document_pip_row_2026_unique_');
    const toggle = getTag(host, `#${PIP_TOGGLE}`, 'input');
    expect(row.dataset.browserUnsupported).toBe('firefox');
    expect(row.dataset.unsupported).toBe('true');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(toggle.checked).toBe(false);
    expect(toggle.disabled).toBe(true);
    await settings.settle();
    expect(writes).toEqual([]);
  });

  it('marks web clip as unsupported only on that browser', () => {
    const { host } = setUp('chrome');
    const row = getElement(host, '#_x_extension_document_pip_row_2026_unique_');
    expect(row.dataset.browserUnsupported).toBe('firefox');
    expect(row.dataset.unsupported).toBeUndefined();
    expect(getTag(host, `#${PIP_TOGGLE}`, 'input').disabled).toBe(false);
  });

  it('redraws its text in a new language', () => {
    const { host, setLanguage } = setUp();
    setLanguage(['settings_document_pip_title', 'settings_number_shortcut_instant_desc']);
    expect(host.textContent).toContain('en:settings_document_pip_title');
    expect(getElement(host, '._x_extension_info_button_2026_unique_').dataset.tooltip)
      .toBe('en:settings_number_shortcut_instant_desc');
  });
});
