import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { recentCount, recentMode, readLaterPages, pinnedRecentSites } from '../../../src/domain/settings/recent-sites';
import { createBrowserFake, type FakeHistoryItem } from '../../fakes/browser';
import { getElements } from '../../fakes/dom';
import { bootReadyNewtab, waitFor } from './boot';

async function bootWithHistory(history: FakeHistoryItem[]): Promise<void> {
  await bootReadyNewtab(createBrowserFake({
    sync: { [recentCount.key]: 8, [recentMode.key]: 'latest' },
    history,
    tabs: [{ id: 1, windowId: 1, index: 0, url: 'chrome://newtab/', title: 'New Tab', active: true, pinned: false }]
  }));
}

describe('New Tab recent sites', () => {
  it('names recent sites after their brands', async () => {
    await bootWithHistory([
      { url: 'https://docs.github.com/en/get-started', title: 'Documentation', lastVisitTime: Date.now(), visitCount: 3 },
      { url: 'https://weibo.com/home', title: 'Home', lastVisitTime: Date.now() - 1000, visitCount: 3 }
    ]);

    const names = getElements(document, '.x-nt-recent-card img[alt]').map((image) => image.getAttribute('alt'));
    expect(names).toEqual(expect.arrayContaining(['GitHub', 'Weibo']));
  });

  it('leaves out the browser New Tab page but keeps other browser pages', async () => {
    const now = Date.now();
    await bootWithHistory([
      { url: 'chrome://newtab/', title: 'New Tab', lastVisitTime: now, visitCount: 9 },
      { url: 'chrome://settings/', title: 'Settings', lastVisitTime: now - 500, visitCount: 2 },
      { url: 'https://a.example/', title: 'A', lastVisitTime: now - 1000, visitCount: 3 }
    ]);

    expect(getElements(document, '.x-nt-recent-card').map((card) => card.getAttribute('aria-label'))).toEqual(['Open Settings', 'Open A']);
  });
});


describe('New Tab read later cards', () => {
  const page = { url: 'https://example.com/article', title: 'Saved article' };
  it('uses ordinary pinned ordering and marks saved cards with a tag', async () => {
    await bootReadyNewtab(createBrowserFake({
      sync: { [recentCount.key]: 8, [recentMode.key]: 'latest', [pinnedRecentSites.key]: [page] },
      local: { [readLaterPages.key]: [page] },
      history: [{ url: 'https://history.example/', title: 'History', lastVisitTime: Date.now(), visitCount: 3 }]
    }));
    expect(getElements(document, '.x-nt-recent-title').map((card) => card.textContent)).toEqual(['Saved article', 'History']);
    expect(getElements(document, '.x-nt-read-later-tag')).toHaveLength(1);
  });
  it('uses the ordinary row limit in the saved mode', async () => {
    const pages = Array.from({ length: 9 }, (_, i) => ({ url: `https://site${i}.example/article`, title: `Saved ${i}` }));
    const fake = createBrowserFake({ sync: { [recentCount.key]: 4, [recentMode.key]: 'readLater' }, local: { [readLaterPages.key]: pages } });
    await bootReadyNewtab(fake);
    expect(getElements(document, '.x-nt-recent-card')).toHaveLength(4);
    await act(async () => { await fake.storage.local.set({ [readLaterPages.key]: [] }); });
    expect(getElements(document, '.x-nt-recent-card')).toHaveLength(0);
    expect(document.getElementById('_x_extension_newtab_recent_sites_2024_unique_')?.getAttribute('data-visible')).toBe('true');
  });
  it('does not force an unpinned saved card back into other modes', async () => {
    const fake = createBrowserFake({ sync: { [recentCount.key]: 4, [recentMode.key]: 'latest', [pinnedRecentSites.key]: [page] },
      local: { [readLaterPages.key]: [page] }, history: [] });
    await bootReadyNewtab(fake);
    expect(getElements(document, '.x-nt-read-later-tag')).toHaveLength(1);
    await act(async () => { await fake.storage.sync.set({ [pinnedRecentSites.key]: [] }); });
    expect(getElements(document, '.x-nt-read-later-tag')).toHaveLength(0);
    expect(fake.storage.local.values[readLaterPages.key]).toHaveLength(1);
  });
});


it('keeps the empty saved mode visible and allows switching back to recent visits', async () => {
  const fake = createBrowserFake({
    sync: { [recentCount.key]: 4, [recentMode.key]: 'readLater' },
    history: [{ url: 'https://history.example/', title: 'History', lastVisitTime: Date.now(), visitCount: 1 }]
  });
  await bootReadyNewtab(fake);
  const section = document.getElementById('_x_extension_newtab_recent_sites_2024_unique_');
  expect(section?.getAttribute('data-visible')).toBe('true');
  expect(section?.querySelector('.x-nt-recent-mode-switch')).not.toBeNull();
  expect(getElements(document, '.x-nt-recent-card')).toHaveLength(0);
  await act(async () => { await fake.storage.sync.set({ [recentMode.key]: 'latest' }); });
  await waitFor(() => getElements(document, '.x-nt-recent-card').length > 0, 'Recent visits did not load');
  expect(section?.getAttribute('data-visible')).toBe('true');
  await act(async () => { await fake.storage.sync.set({ [recentMode.key]: 'readLater' }); });
  await waitFor(() => getElements(document, '.x-nt-recent-card').length === 0, 'Saved mode did not clear the cards');
  expect(section?.getAttribute('data-visible')).toBe('true');
});

it('still hides site cards when the person switches the module off', async () => {
  await bootReadyNewtab(createBrowserFake({ sync: { [recentCount.key]: 0, [recentMode.key]: 'readLater' } }));
  expect(document.getElementById('_x_extension_newtab_recent_sites_2024_unique_')?.getAttribute('data-visible')).toBe('false');
});
