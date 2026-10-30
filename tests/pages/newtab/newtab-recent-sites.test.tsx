import { describe, expect, it } from 'vitest';
import { recentCount, recentMode } from '../../../src/domain/settings/recent-sites';
import { createBrowserFake, type FakeHistoryItem } from '../../fakes/browser';
import { getElements } from '../../fakes/dom';
import { bootReadyNewtab } from './boot';

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
