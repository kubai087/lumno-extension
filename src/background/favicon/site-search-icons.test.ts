import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getSiteSearchProviderPageUrl } from '../../domain/favicon/shortcut-favicon/bundled-icons';
import { SITE_SEARCH_CACHE_OPTIONS, normalizeCacheMap, setCachedIcon } from '../../domain/favicon/shortcut-favicon/persisted';
import { newtabShortcutFaviconCache, newtabShortcutIcons } from '../../domain/settings/newtab-shortcuts';
import { LEGACY_SITE_SEARCH_ICON_KEYS } from '../../domain/settings/removed';
import { faviconEnhancedFetchEnabled, siteSearchCustom, siteSearchIconCache } from '../../domain/settings/search';
import { createShortcutRecord } from '../../domain/shortcuts/normalize';
import { createSiteSearchIconStore } from '../../platform/shortcut-favicon-store';
import { saveShortcuts } from '../../platform/shortcut-storage';
import type { FakeResponse, WorkerFake } from '../../../tests/fakes/worker';
import { installWorkerFake } from '../../../tests/fakes/worker';

// The worker warms icons for the user's own site-search providers as it
// starts, and follows the icon chosen for a shortcut to a provider's home page.

const APPROVED_SOURCE = /^(chrome-extension:\/\/lumno-test\/_favicon\/|https:\/\/t2\.gstatic\.cn\/faviconV2|https:\/\/favicon\.is\/)/;
const provider = (name: string) => ({ key: `c${name}`, name, template: `https://${name}.example.test/search?q={query}` });
const CUSTOM = ['alpha', 'beta', 'gamma', 'delta'].map(provider);
const pageOf = (name: string) => `https://${name}.example.test/`;
const serviceSource = (page: string) => `https://t2.gstatic.cn/faviconV2?url=${encodeURIComponent(page)}`;

function readBundledProviders(): { template: string }[] {
  const data: unknown = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../assets/data/site-search.json'), 'utf8'));
  const items: unknown = data && typeof data === 'object' ? Reflect.get(data, 'items') : undefined;
  return (Array.isArray(items) ? items : []).map((item: unknown) => ({
    template: String(item && typeof item === 'object' ? Reflect.get(item, 'template') : '')
  }));
}

// The page an icon request asks about.
function hostOf(resource: string): string {
  const params = new URL(resource).searchParams;
  try {
    return new URL(params.get('pageUrl') || params.get('url') || '').hostname;
  } catch {
    return resource;
  }
}

function writeProviderIcons(fake: WorkerFake, entries: { provider: ReturnType<typeof provider>; dataUrl: string }[]) {
  const cache = entries.reduce<unknown>((current, entry) => {
    const pageUrl = getSiteSearchProviderPageUrl(entry.provider);
    return setCachedIcon(current, pageUrl, entry.dataUrl, serviceSource(pageUrl), Date.now(), SITE_SEARCH_CACHE_OPTIONS);
  }, {});
  return createSiteSearchIconStore({ chromeApi: fake.chrome, storageArea: fake.chrome.storage.local }).writeAll(cache);
}

function readProviderIcons(fake: WorkerFake) {
  return normalizeCacheMap(fake.storage.local.values[siteSearchIconCache.key], Date.now(), SITE_SEARCH_CACHE_OPTIONS);
}

function localReads(fake: WorkerFake): unknown[] {
  return fake.chrome.storage.local.get.mock.calls.map(([keys]) => keys);
}

const notFound = (): FakeResponse => ({ ok: false, status: 404, json: async () => null, text: async () => '' });

describe('site-search provider icons', () => {
  it('warm custom providers two at a time from approved sources, reusing cached icons and leaving bundled tiles', async () => {
    const fetches: { url: string; redirect?: RequestRedirect }[] = [];
    const inFlight = new Map<string, number>();
    let maxInFlight = 0;
    const fake = installWorkerFake({
      sync: { [siteSearchCustom.key]: CUSTOM, [faviconEnhancedFetchEnabled.key]: true },
      local: Object.fromEntries(LEGACY_SITE_SEARCH_ICON_KEYS.map((key) => [key, { stale: true }]))
    });
    const packaged = fake.fetch.getMockImplementation();
    fake.fetch.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('chrome-extension://lumno-test/') && !url.includes('/_favicon/') && packaged) return packaged(input, init);
      fetches.push({ url, redirect: init && init.redirect });
      const host = hostOf(url);
      inFlight.set(host, (inFlight.get(host) || 0) + 1);
      maxInFlight = Math.max(maxInFlight, inFlight.size);
      await new Promise((done) => setTimeout(done, 30));
      const left = (inFlight.get(host) || 1) - 1;
      if (left > 0) inFlight.set(host, left);
      else inFlight.delete(host);
      return notFound();
    });
    await writeProviderIcons(fake, [{ provider: CUSTOM[1], dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }]);
    await import('../background');
    const warmedHosts = () => new Set(fetches.map((fetch) => hostOf(fetch.url)));

    await vi.waitFor(() => expect(['alpha', 'gamma', 'delta'].every((name) => warmedHosts().has(`${name}.example.test`))).toBe(true),
      { timeout: 3000 });
    expect(maxInFlight).toBeLessThanOrEqual(2);
    fetches.forEach((fetch) => {
      expect(fetch.url).toMatch(APPROVED_SOURCE);
      expect(fetch.redirect).toBe('error');
    });
    expect(warmedHosts().has('beta.example.test')).toBe(false);
    readBundledProviders().forEach((bundled) => {
      expect(warmedHosts().has(new URL(bundled.template.replace('{query}', 'x')).hostname)).toBe(false);
    });
    LEGACY_SITE_SEARCH_ICON_KEYS.forEach((key) => expect(fake.storage.local.values).not.toHaveProperty(key));
    expect(localReads(fake).flatMap((keys) => (Array.isArray(keys) ? keys : [keys]))).toContain(siteSearchIconCache.key);
  });

  it("take the icon chosen for a shortcut to the provider's home page, and give it back when the shortcut stops choosing one", async () => {
    const BROWSER_ICON = 'data:image/png;base64,QlJPV1NFUg==';
    const SERVICE_ICON = 'data:image/png;base64,U0VSVklDRQ==';
    const UPLOADED_ICON = 'data:image/png;base64,VVBMT0FE';
    const fetchedHosts = new Set<string>();
    const fake = installWorkerFake({ sync: { [siteSearchCustom.key]: CUSTOM, [faviconEnhancedFetchEnabled.key]: true } });
    const packaged = fake.fetch.getMockImplementation();
    fake.fetch.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('chrome-extension://lumno-test/') && !url.includes('/_favicon/') && packaged) return packaged(input, init);
      fetchedHosts.add(hostOf(url));
      return notFound();
    });
    await saveShortcuts(fake.chrome.storage.sync, [
      { id: 'alpha', title: 'Alpha', url: 'https://www.alpha.example.test/', iconSource: 'service' },
      { id: 'beta', title: 'Beta', url: pageOf('beta'), iconSource: 'custom' },
      // Not the home page, and a browser-cache choice: neither counts.
      { id: 'gamma', title: 'Gamma', url: 'https://gamma.example.test/docs', iconSource: 'service' },
      { id: 'delta', title: 'Delta', url: pageOf('delta'), iconSource: 'cache' },
      // Built-in providers keep their packaged tile.
      { id: 'github', title: 'GitHub', url: 'https://github.com/', iconSource: 'custom' }
    ].map((item) => createShortcutRecord(item)));
    await writeProviderIcons(fake, [{ provider: CUSTOM[0], dataUrl: BROWSER_ICON }, { provider: CUSTOM[3], dataUrl: BROWSER_ICON }]);
    await fake.chrome.storage.local.set({
      [newtabShortcutIcons.key]: { beta: UPLOADED_ICON, github: 'data:image/png;base64,R0lUSFVC' },
      [newtabShortcutFaviconCache.key]: ['https://www.alpha.example.test/', 'https://gamma.example.test/docs']
        .reduce<unknown>((cache, page) => setCachedIcon(cache, page, SERVICE_ICON, serviceSource(page)), {})
    });
    fake.chrome.storage.local.get.mockClear();
    await import('../background');

    await vi.waitFor(() => expect(fetchedHosts.has('gamma.example.test')).toBe(true), { timeout: 3000 });
    await vi.waitFor(() => expect(readProviderIcons(fake)[pageOf('beta')]).toMatchObject({ dataUrl: UPLOADED_ICON }), { timeout: 3000 });
    let cache = readProviderIcons(fake);
    expect(cache[pageOf('alpha')]).toMatchObject({ dataUrl: SERVICE_ICON, fromShortcut: true });
    expect(cache[pageOf('gamma')] && cache[pageOf('gamma')].fromShortcut).toBeFalsy();
    expect(cache[pageOf('delta')]).toMatchObject({ dataUrl: BROWSER_ICON });
    expect(cache['https://github.com/']).toBeUndefined();
    expect(fetchedHosts.has('alpha.example.test')).toBe(false);
    expect(fetchedHosts.has('beta.example.test')).toBe(false);
    expect(localReads(fake)).not.toContain(null);

    // The user switches the Beta shortcut back to the browser cache.
    fake.storage.local.externalSet({ [newtabShortcutIcons.key]: { github: 'data:image/png;base64,R0lUSFVC' } });
    await vi.waitFor(() => {
      const beta = readProviderIcons(fake)[pageOf('beta')];
      expect(beta && beta.fromShortcut).toBeFalsy();
    }, { timeout: 3000 });
    await vi.waitFor(() => expect(fetchedHosts.has('beta.example.test')).toBe(true), { timeout: 3000 });
    cache = readProviderIcons(fake);
    expect(cache[pageOf('alpha')]).toMatchObject({ dataUrl: SERVICE_ICON });
  });
});
