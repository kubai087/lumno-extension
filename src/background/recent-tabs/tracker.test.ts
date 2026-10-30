import { describe, expect, it } from 'vitest';
import type { TrackableTab } from './types';
import { createRecentTabTracker } from './tracker';

const createTracker = () => createRecentTabTracker({
  limit: 5,
  thumbnailLimit: 4,
  thumbnailTtlMs: Number.MAX_SAFE_INTEGER,
  shouldIncludeTab: (tab) => Boolean(tab && tab.url)
});

const tab = (id: number, url: string, title: string, windowId = 10): TrackableTab => ({ id, windowId, url, title });
const ONE = 'data:image/jpeg;base64,b25l';

describe('the recent tab tracker', () => {
  it('shows the five most recently visited switchable tabs', () => {
    const tracker = createRecentTabTracker({ limit: 5, shouldIncludeTab: (each) => /^https?:/.test(each.url || '') });
    [
      tab(1, 'https://one.example/', 'One'),
      tab(2, 'https://two.example/', 'Two'),
      tab(3, 'chrome://extensions/', 'Extensions'),
      tab(4, 'https://four.example/', 'Four', 11),
      tab(5, 'https://five.example/', 'Five', 11),
      tab(6, 'https://six.example/', 'Six', 12),
      tab(7, 'https://seven.example/', 'Seven', 12),
      tab(2, 'https://two.example/', 'Two again')
    ].forEach((each) => tracker.recordTab(each, Number(each.id) * 1000));
    const open = [
      tab(1, 'https://one.example/', 'One'),
      tab(2, 'https://two.example/', 'Two again'),
      tab(4, 'https://four.example/', 'Four', 11),
      tab(5, 'https://five.example/', 'Five', 11),
      tab(6, 'https://six.example/', 'Six', 12),
      tab(7, 'https://seven.example/', 'Seven', 12),
      { ...tab(8, 'https://eight.example/', 'Eight', 12), incognito: true }
    ];

    expect(tracker.getRecentTabs(open).map((each) => each.id)).toEqual([2, 7, 6, 5, 4]);
  });

  it('shows a thumbnail only for the page it shows, also after the state is restored', () => {
    const tracker = createTracker();
    const history = 'data:image/jpeg;base64,aGlzdG9yeQ==';
    tracker.recordTab(tab(11, 'chrome://history/', 'History'), 100);
    tracker.setThumbnail(11, history, 150, { url: 'chrome://history/' });

    expect(tracker.getThumbnail(11, 'chrome://history/')).toBe(history);
    expect(tracker.getThumbnail(11, 'chrome://downloads/')).toBe('');

    const hydrated = createTracker();
    hydrated.hydrateState(tracker.exportState({ now: 200 }), { now: 250 });
    expect(hydrated.getRecentTabs([tab(11, 'chrome://history/', 'History')]).map((each) => [each.id, each._xSwitcherThumbnail]))
      .toEqual([[11, history]]);
  });

  it('keeps the matching thumbnail when the same tab is recorded again', () => {
    const tracker = createTracker();
    tracker.recordTab(tab(12, 'https://one.example/', 'One'), 100);
    tracker.setThumbnail(12, ONE, 120, { url: 'https://one.example/' });
    tracker.recordTab(tab(12, 'https://one.example/', 'One again'), 200);

    expect(tracker.getRecentTabs([tab(12, 'https://one.example/', 'One again')])[0])
      .toMatchObject({ _xSwitcherThumbnail: ONE, _xSwitcherThumbnailStatus: 'ok' });
  });

  it('reports the thumbnail status and why, keeps it across a restore, and calls a moved page stale', () => {
    const tracker = createTracker();
    const recent = (url: string) => tracker.getRecentTabs([tab(21, url, 'One')])[0];
    tracker.recordTab(tab(21, 'https://one.example/', 'One'), 100);

    tracker.setThumbnailStatus(21, 'pending', 110, { url: 'https://one.example/', reason: 'activated' });
    expect(recent('https://one.example/')).toMatchObject({
      _xSwitcherThumbnail: '', _xSwitcherThumbnailStatus: 'pending', _xSwitcherThumbnailReason: 'activated'
    });
    tracker.setThumbnailStatus(21, 'failed', 120, { url: 'https://one.example/', reason: 'inactive-tab' });
    expect(recent('https://one.example/')).toMatchObject({ _xSwitcherThumbnailStatus: 'failed', _xSwitcherThumbnailReason: 'inactive-tab' });
    tracker.setThumbnail(21, ONE, 130, { url: 'https://one.example/' });
    expect(recent('https://one.example/')).toMatchObject({
      _xSwitcherThumbnail: ONE, _xSwitcherThumbnailStatus: 'ok', _xSwitcherThumbnailReason: ''
    });
    expect(recent('https://two.example/')).toMatchObject({
      _xSwitcherThumbnail: '', _xSwitcherThumbnailStatus: 'stale', _xSwitcherThumbnailReason: 'url-mismatch'
    });

    tracker.recordTab(tab(22, 'chrome://extensions/', 'Extensions'), 200);
    tracker.setThumbnailStatus(22, 'restricted', 210, { url: 'chrome://extensions/', reason: 'chrome-restricted-page' });
    const hydrated = createTracker();
    hydrated.hydrateState(tracker.exportState({ now: 220 }), { now: 230 });
    expect(hydrated.getRecentTabs([tab(22, 'chrome://extensions/', 'Extensions')])[0])
      .toMatchObject({ _xSwitcherThumbnailStatus: 'restricted', _xSwitcherThumbnailReason: 'chrome-restricted-page' });
  });

  it('merges a stored state into a worker that already recorded a tab, keeping its cover while a capture is pending', () => {
    const persisted = createTracker();
    persisted.recordTab(tab(31, 'https://one.example/', 'One'), 100);
    persisted.recordTab(tab(32, 'https://two.example/', 'Two'), 90);
    persisted.setThumbnail(31, 'data:image/jpeg;base64,b25lLW9sZA==', 110, { url: 'https://one.example/' });
    const tracker = createTracker();
    tracker.recordTab(tab(31, 'https://one.example/', 'One focused'), 1000);
    tracker.setThumbnailStatus(31, 'pending', 1010, { url: 'https://one.example/', reason: 'visible' });

    tracker.hydrateState(persisted.exportState({ now: 120 }), { now: 1020, merge: true });
    const recent = tracker.getRecentTabs([tab(31, 'https://one.example/', 'One focused'), tab(32, 'https://two.example/', 'Two')]);

    expect(recent.map((each) => each.id)).toEqual([31, 32]);
    expect(recent[0]).toMatchObject({
      _xSwitcherThumbnail: 'data:image/jpeg;base64,b25lLW9sZA==', _xSwitcherThumbnailStatus: 'pending', _xSwitcherThumbnailReason: 'visible'
    });
  });
});
