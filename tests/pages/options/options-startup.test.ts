import { describe, expect, it, vi } from 'vitest';
import { language, resolveSupportedLocale } from '../../../src/domain/settings';
import { createBrowserFake } from '../../fakes/browser';
import { getElementById } from '../../fakes/dom';
import { bootOptionsPage } from './boot';

describe('Options startup', () => {
  it('reads its startup settings together, marks itself ready and opens the General tab', async () => {
    const browser = createBrowserFake();
    const reads = vi.spyOn(browser.storage.sync, 'get');
    await bootOptionsPage(browser);
    await vi.waitFor(() => {
      expect(document.documentElement.getAttribute('data-lumno-options-ready')).toBe('true');
    });
    const largestRead = Math.max(...reads.mock.calls.map(([keys]) => (Array.isArray(keys) ? keys.length : 1)));
    expect(largestRead).toBeGreaterThanOrEqual(30);
    const active = document.querySelector('._x_extension_settings_tab_button_2024_unique_[data-active="true"]');
    expect(active?.getAttribute('data-tab')).toBe('general');
  });

  it('follows the browser language for a stored one Lumno no longer ships', async () => {
    await bootOptionsPage(createBrowserFake({ sync: { [language.key]: 'it' } }));
    const select = getElementById('_x_extension_language_select_2024_unique_');
    expect(select instanceof HTMLSelectElement && select.value).toBe('system');
    expect(resolveSupportedLocale(document.documentElement.lang)).toBeTruthy();
  });
});
