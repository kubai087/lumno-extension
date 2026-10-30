import { describe, expect, it } from 'vitest';
import { bootOverlayPage, click, settle, waitFor } from './boot';
import { getElement, getTags, required } from '../../fakes/dom';

// What a web page cannot do to the overlay: reach into its shadow root, or
// drive a privileged action with a synthetic click. How the key router
// treats synthetic keys is covered by src/overlay/keyboard.test.ts.

const trustedClick = () => new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0 });

describe('Overlay security boundaries', () => {
  it('mounts in a closed shadow root and closes other tabs only on a real click', async () => {
    const page = await bootOverlayPage({
      stylesheetsLoad: 5,
      settings: { _x_extension_overlay_open_tabs_default_visible_2026_unique_: true },
      respond: (message) => {
        if (message.action === 'getTabsForOverlay') {
          return { tabs: [{ id: 1, title: 'One', url: 'https://one.test/' }, { id: 2, title: 'Two', url: 'https://two.test/' }], currentTabId: 1 };
        }
        return message.action === 'closeOtherTabsForOverlay' ? { ok: true } : undefined;
      }
    });
    const root = await page.open();
    expect(page.host()?.shadowRoot).toBeNull();
    await waitFor(() => root.querySelector('.x-ov-close-other-tabs'), 'the close-other-tabs action did not show with the open tabs');

    const closeRequests = () => page.messages.filter((message) => message.action === 'closeOtherTabsForOverlay').length;
    const button = getElement(root, '.x-ov-close-other-tabs');
    page.trusted(button, trustedClick());
    await settle(30);
    const dialog = required(root.getElementById(button.getAttribute('aria-controls') || ''), 'the confirmation');
    expect(dialog.getAttribute('data-open')).toBe('true');
    const confirm = required(getTags(dialog, 'button', 'button').at(-1), 'the confirm button');

    click(confirm);
    await settle(30);
    expect(closeRequests()).toBe(0);
    page.trusted(confirm, trustedClick());
    await settle(30);
    expect(closeRequests()).toBe(1);
  });
});
