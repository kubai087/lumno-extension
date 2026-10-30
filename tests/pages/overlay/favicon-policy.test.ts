import { describe, expect, it } from 'vitest';
import { bootOverlayPage, settle, suggestionOf, waitFor, type OverlayPage, type OverlayPageOptions } from './boot';
import { required } from '../../fakes/dom';

// The favicon policy in the overlay: excluded pages never reach a
// third-party icon service, the first rows wait for the policy, a policy
// change makes failed rows try again, and built-in rows use trusted icons.
// The worker answers icons the browser keeps (Lumno's own _favicon endpoint)
// for browser pages only, so the site rows depend on the icon service.

const ENHANCED_KEY = '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_';
const BLACKLIST_KEY = '_x_extension_favicon_request_blacklist_2026_unique_';
const OPEN_TABS_VISIBLE_KEY = '_x_extension_overlay_open_tabs_default_visible_2026_unique_';
const ICON_DATA = 'data:image/png;base64,iVBORw0KGgo=';
const TABS = [
  { id: 1, title: 'Public page', url: 'https://site.test/public', favIconUrl: 'https://site.test/favicon.ico' },
  { id: 2, title: 'Private page', url: 'https://site.test/private/inbox', favIconUrl: 'https://site.test/favicon.ico' },
  { id: 3, title: 'Extensions', url: 'chrome://extensions/', favIconUrl: '' }
];

function bootOpenTabsPage(settings: Record<string, unknown>, options: OverlayPageOptions = {}) {
  return bootOverlayPage({
    settings: { [OPEN_TABS_VISIBLE_KEY]: true, ...settings },
    respond(message) {
      if (message.action === 'getTabsForOverlay') return { tabs: TABS };
      if (message.action === 'getFaviconData') {
        const local = String(message.url).startsWith(chrome.runtime.getURL('_favicon/'));
        return local && String(message.pageUrl).startsWith('https://') ? {} : { data: ICON_DATA };
      }
      return undefined;
    },
    ...options
  });
}

const faviconRequestsFor = (page: OverlayPage, pageUrl: string) => page.messages
  .filter((message) => message.action === 'getFaviconData' && message.pageUrl === pageUrl)
  .map((message) => String(message.url));
const isOwnEndpoint = (url: string) => url.startsWith(chrome.runtime.getURL('_favicon/'));

function rowIcon(page: OverlayPage, title: string): string | null {
  const row = page.suggestions().find((item) => (item.textContent || '').includes(title));
  const img = row ? row.querySelector('img') : null;
  return img ? img.getAttribute('src') : null;
}

describe('Overlay favicon policy', () => {
  it('never sends an excluded page to an icon service, even before the settings load, and retries once it is allowed', async () => {
    // Storage answers after the tab list does.
    const page = await bootOpenTabsPage({ [ENHANCED_KEY]: true, [BLACKLIST_KEY]: ['site.test/private'] }, { storageDelayMs: 40 });
    const root = await page.open();
    await waitFor(() => (root.textContent || '').includes('Private page'), 'the open tabs did not render');
    await settle(200);
    expect(faviconRequestsFor(page, 'https://site.test/private/inbox').filter((url) => !isOwnEndpoint(url))).toEqual([]);
    const publicRequests = faviconRequestsFor(page, 'https://site.test/public');
    expect(publicRequests.filter((url) => !isOwnEndpoint(url)).length).toBeGreaterThan(0);
    // The site itself is never asked for its icon.
    publicRequests.forEach((url) => expect(url).not.toMatch(/^https:\/\/site\.test\//));
    expect(rowIcon(page, 'Public page')).toBe(ICON_DATA);
    // Nor does its row show the service's icon of the same site.
    expect(rowIcon(page, 'Private page')).not.toBe(ICON_DATA);
    expect(rowIcon(page, 'Private page') || '').not.toMatch(/^https?:/);

    page.changeSetting(BLACKLIST_KEY, []);
    await waitFor(() => rowIcon(page, 'Private page') === ICON_DATA, 'lifting the exclusion did not load the failed row\'s icon');
  });

  it('gives browser pages the icon the browser keeps and the theme switch the packaged Lumno icon', async () => {
    const page = await bootOpenTabsPage({ [ENHANCED_KEY]: false });
    const root = await page.open();
    await waitFor(() => (root.textContent || '').includes('Extensions'), 'the open tabs did not render');
    await waitFor(() => rowIcon(page, 'Extensions') === ICON_DATA, 'the browser page did not show its icon');
    const requests = faviconRequestsFor(page, 'chrome://extensions/');
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(isOwnEndpoint)).toBe(true);

    await page.type('/mode');
    const modeRow = required(page.suggestions().map(suggestionOf).find((item) => item.type === 'modeSwitch'), 'the theme switch row');
    expect(modeRow.favicon).toBe(chrome.runtime.getURL('assets/images/lumno.png'));
  });
});
