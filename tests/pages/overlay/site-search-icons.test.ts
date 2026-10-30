import { describe, expect, it } from 'vitest';
import { bootOverlayPage, bundledSiteSearchProviders, click, waitFor } from './boot';
import { getElement, required } from '../../fakes/dom';
import { parseCss, readStylesheet } from '../../fakes/css';
import { createSiteSearchIconStore } from '../../../src/platform/shortcut-favicon-store';
import { getSiteSearchProviderPageUrl } from '../../../src/domain/favicon/shortcut-favicon/bundled-icons';
import { SITE_SEARCH_CACHE_OPTIONS, setCachedIcon } from '../../../src/domain/favicon/shortcut-favicon/persisted';
import { siteSearchIconCache } from '../../../src/domain/settings/search';

// Provider icons in the overlay's search scope menu: packaged tiles for
// bundled providers, the worker's cached icons for the user's own, and a
// live update when the worker caches a new one.

const CUSTOM = { key: 'cdocs', name: 'Docs', template: 'https://docs.example.test/search?q={query}' };
const CACHED_ICON = 'data:image/png;base64,Y2FjaGVk';
const FRESH_ICON = 'data:image/png;base64,ZnJlc2g=';

// The storage.local items the worker's icon store writes for these icons.
async function iconCacheItems(dataUrl: string): Promise<Record<string, unknown>> {
  const items: Record<string, unknown> = {};
  const store = createSiteSearchIconStore({
    chromeApi: { runtime: {} },
    storageArea: {
      get: (_keys, callback) => callback?.({ ...items }),
      set: (values, callback) => {
        Object.assign(items, structuredClone(values));
        callback?.();
      }
    }
  });
  const pageUrl = getSiteSearchProviderPageUrl(CUSTOM);
  await store.writeAll(setCachedIcon({}, pageUrl, dataUrl,
    `https://t2.gstatic.cn/faviconV2?url=${encodeURIComponent(pageUrl)}`, Date.now(), SITE_SEARCH_CACHE_OPTIONS));
  return items;
}

function menuIcon(root: ShadowRoot, providerKey: string): string | null {
  const img = root.querySelector(`[data-mode-id="provider:${providerKey}"] img`);
  return img ? img.getAttribute('src') : null;
}

describe('Overlay site search icons', () => {
  it('shows cached and packaged provider icons in the scope menu and adopts a newly cached one', async () => {
    // Storage is slow: the menu still renders with the cached icons.
    const page = await bootOverlayPage({ local: await iconCacheItems(CACHED_ICON), stylesheetsLoad: 5, storageDelayMs: 30 });
    const root = await page.open({ siteSearchProviders: bundledSiteSearchProviders().concat(CUSTOM) });
    click(getElement(root, '[data-search-scope-action="true"]'));
    await waitFor(() => root.querySelector('[data-mode-id="provider:cdocs"]'), 'the scope menu did not list the providers');

    expect(menuIcon(root, 'cdocs')).toBe(CACHED_ICON);
    expect(menuIcon(root, 'bi')).toBe(chrome.runtime.getURL('assets/images/site-search/tile-bi.png'));
    // A packaged tile is never hydrated through the favicon service.
    expect(page.messages.some((message) => message.action === 'getFaviconData' &&
      /bing\.com/.test(String(message.pageUrl || message.url || '')))).toBe(false);
    expect(page.storageReads.some((read) => read.area === 'local' && read.keys.includes(siteSearchIconCache.key))).toBe(true);

    Object.entries(await iconCacheItems(FRESH_ICON)).forEach(([key, value]) => page.changeSetting(key, value, 'local'));
    await waitFor(() => menuIcon(root, 'cdocs') === FRESH_ICON, 'the open menu did not adopt the icon the worker just cached');
  });
});

describe('Overlay scope label stylesheet', () => {
  it('hides the current-scope label until revealed, clipping only its own expansion', () => {
    const css = parseCss(readStylesheet('src/shared/search/search-input.css'));
    const slot = required(css.rule('.x-lumno-search-input-mode__prefix [data-search-input-mode-current]'), 'the current-scope slot');
    expect([slot.get('overflow'), slot.priority('overflow')]).toEqual(['hidden', 'important']);
    expect([slot.get('display'), slot.priority('display')]).toEqual(['none', 'important']);
    const revealed = required(css.entries.find((entry) => entry.selectors.some((selector) =>
      selector.includes('[data-current-visible="true"]') && selector.endsWith('[data-search-input-mode-current]'))), 'the reveal state');
    expect([revealed.style.getPropertyValue('display'), revealed.style.getPropertyPriority('display')]).toEqual(['inline-flex', 'important']);
  });
});
