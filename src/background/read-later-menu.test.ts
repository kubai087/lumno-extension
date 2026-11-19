import { describe, expect, it, vi } from 'vitest';
import { readLaterPages, pinnedRecentSites } from '../domain/settings/recent-sites';
import { bootWorker, browserTab } from '../../tests/fakes/worker';

describe('read later entry points', () => {
  it('saves the link targeted by the context menu, and the current page through the popup', async () => {
    const tab = browserTab({ id: 5, url: 'https://example.com/page', title: 'Current page', active: true });
    const fake = await bootWorker({ tabs: [tab], uiLanguage: 'zh-CN' });
    await vi.waitFor(() => expect(fake.chrome.contextMenus.items.get('lumno-read-later')).toMatchObject({
      title: '添加到稍后再读', contexts: ['page', 'link']
    }));
    fake.chrome.contextMenus.onClicked.fire({ menuItemId: 'lumno-read-later', linkUrl: 'https://other.example/article',
      pageUrl: tab.url, editable: false }, tab);
    await vi.waitFor(() => expect(fake.storage.local.values[readLaterPages.key]).toMatchObject([
      { url: 'https://other.example/article' }
    ]));
    expect(await fake.sendMessage({ action: 'readLaterAdd', tabId: 5 })).toEqual({ status: 'added' });
    expect(await fake.sendMessage({ action: 'readLaterAdd', tabId: 5 })).toEqual({ status: 'added' });
    expect(fake.storage.sync.values[pinnedRecentSites.key]).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: tab.url }), expect.objectContaining({ url: 'https://other.example/article' })
    ]));
    expect(fake.storage.local.values[readLaterPages.key]).toHaveLength(3);
    expect(fake.storage.sync.values[readLaterPages.key]).toBeUndefined();
  });
});
