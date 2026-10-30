import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { searchBlacklist } from '../../../src/domain/settings';
import { createBrowserFake } from '../../fakes/browser';
import { expectElement, expectTag, getElementById, getTags, required } from '../../fakes/dom';
import { bootOptionsPage, settle } from './boot';

const TOAST = '_x_extension_toast_2024_unique_';

function announcement(): Array<string | null> {
  const toast = getElementById(TOAST);
  return ['role', 'aria-live', 'aria-atomic'].map((name) => toast.getAttribute(name));
}

function button(id: string): HTMLButtonElement {
  return expectTag(document.getElementById(id), 'button', `#${id}`);
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
  await settle();
}

describe('Options accessibility', () => {
  it('announces errors assertively and status updates politely', async () => {
    const browser = createBrowserFake({
      sync: { [searchBlacklist.key]: [{ pattern: 'a.com', matchModes: ['suffix'] }] },
      respond: ({ action }) => (action === 'openExtensionShortcutsPage' ? { ok: false } : undefined)
    });
    await bootOptionsPage(browser);
    expect(announcement()).toEqual(['status', 'polite', 'true']);

    await click(getElementById('_x_extension_open_shortcuts_page_2026_unique_'));
    expect(announcement()).toEqual(['alert', 'assertive', 'true']);

    // Removing a rule is a status update.
    const rule = Array.from(document.querySelectorAll('span')).find((span) => span.textContent === 'a.com');
    const card = expectElement(rule?.closest(':has(._x_extension_shortcut_remove_2024_unique_)'), 'the a.com rule card');
    expect(button('_x_extension_blacklist_clear_2026_unique_').disabled).toBe(false);
    await click(expectElement(card.querySelector('._x_extension_shortcut_remove_2024_unique_')));
    await click(required(
      getTags(document, '._x_extension_popconfirm_2024_unique_[data-open="true"] button', 'button').pop(),
      'the confirmation\'s confirm button'
    ));
    expect(browser.storage.sync.values[searchBlacklist.key]).toEqual([]);
    expect(announcement()).toEqual(['status', 'polite', 'true']);
  });

  it('keeps the clear-all buttons unavailable while their lists are empty', async () => {
    await bootOptionsPage(createBrowserFake());
    [
      '_x_extension_custom_clear_2024_unique_',
      '_x_extension_aggregate_search_clear_2026_unique_',
      '_x_extension_favicon_blacklist_clear_2026_unique_',
      '_x_extension_blacklist_clear_2026_unique_'
    ].forEach((id) => {
      expect(button(id).disabled, id).toBe(true);
    });
  });

  it('closes a header confirmation on Escape and gives focus back to its trigger', async () => {
    await bootOptionsPage(createBrowserFake());
    const reset = button('_x_extension_builtin_reset_2024_unique_');
    const confirm = getElementById('_x_extension_builtin_reset_2024_unique__popconfirm');
    reset.focus();
    await click(reset);
    expect(confirm.getAttribute('data-open')).toBe('true');
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    await settle();
    expect(confirm.getAttribute('data-open')).toBe('false');
    expect(document.activeElement).toBe(reset);
  });
});
