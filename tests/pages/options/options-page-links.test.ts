import { act } from 'react';
import { describe, expect, it } from 'vitest';
import enMessages from '../../../_locales/en/messages.json';
import { createBrowserFake } from '../../fakes/browser';
import { getElement, getElementById } from '../../fakes/dom';
import { bootOptionsPage, settle, unmountOptionsPage } from './boot';

// Links on the Settings page that depend on the platform and on how the
// user clicks.

function messagesWith(browser: ReturnType<typeof createBrowserFake>, action: string): unknown[] {
  return browser.runtime.sendMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => typeof message === 'object' && message !== null && 'action' in message && message.action === action);
}

function tabSwitcherHint(): string | undefined {
  const row = getElementById('_x_extension_tab_switcher_toggle_2026_unique_').closest('._x_extension_setting_row_2024_unique_');
  return row ? getElement(row, '._x_extension_info_button_2026_unique_').dataset.tooltip : undefined;
}

describe('Options page links', () => {
  it('opens the release page from the version badge in a new tab, behind it on a modified or middle click, never on a right click', async () => {
    const browser = createBrowserFake();
    await bootOptionsPage(browser);
    const badge = getElementById('_x_extension_settings_version_2024_unique_');
    expect(badge.tagName).toBe('BUTTON');
    expect(badge.getAttribute('type')).toBe('button');
    expect(badge.classList.contains('_x_extension_settings_version_badge_2024_unique_')).toBe(true);
    expect(badge.dataset.tooltip).toBe(enMessages.settings_version_tooltip.message);
    const press = (type: string, init: MouseEventInit) => {
      badge.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
    };
    await act(async () => {
      press('click', { button: 0 });
      press('click', { button: 0, metaKey: true });
      press('auxclick', { button: 1 });
      press('auxclick', { button: 2 });
    });
    await settle();
    expect(messagesWith(browser, 'openReleasePage')).toEqual([
      { action: 'openReleasePage', reason: 'options-version', disposition: 'newTab' },
      { action: 'openReleasePage', reason: 'options-version', disposition: 'backgroundTab' },
      { action: 'openReleasePage', reason: 'options-version', disposition: 'backgroundTab' }
    ]);
  });

  it('opens the onboarding guide from its tile', async () => {
    const browser = createBrowserFake();
    await bootOptionsPage(browser);
    await act(async () => {
      getElementById('_x_extension_open_onboarding_page_2026_unique_').click();
    });
    expect(messagesWith(browser, 'openOnboardingPage')).toEqual([{ action: 'openOnboardingPage' }]);
  });

  it('writes the tab switcher shortcut the way the platform does', async () => {
    await bootOptionsPage(createBrowserFake(), { platform: 'MacIntel' });
    expect(tabSwitcherHint()).toMatch(/⌥Q/);
    unmountOptionsPage();
    await bootOptionsPage(createBrowserFake(), { platform: 'Win32' });
    expect(tabSwitcherHint()).toMatch(/Alt\+Q/);
    expect(tabSwitcherHint()).not.toMatch(/\{shortcut\}/);
  });
});
