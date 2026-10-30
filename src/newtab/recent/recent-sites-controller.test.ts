import { afterEach, describe, expect, it, vi } from 'vitest';
import * as progressHistory from '../../domain/progress-history';
import * as progressMatch from '../../domain/progress-match';
import type { RecentSite } from '../../domain/recent-sites-store';
import { pinnedRecentSites, progressHistory as progressHistorySetting, progressTrackingEnabled } from '../../domain/settings/recent-sites';
import { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { createOptionsTestSettings } from '../../../tests/fakes/options-settings';
import { createSelectMenuController } from '../react/select-menu';
import { createRecentSitesController } from './recent-sites-controller';
import { RecentSitesShown } from './recent-sites-shown';

// Following an episode or a chapter on a pinned recent site card (Labs): the
// card's switch and menu, pinning that starts it, and restoring a version.
const PINNED_KEY = pinnedRecentSites.key;
const HISTORY_KEY = progressHistorySetting.key;

function site(url: string, title: string, fields: Partial<RecentSite> = {}): RecentSite {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { url, title, host, siteName: host, lastVisitTime: 0, visitCount: 0, pinnedAt: 0, ...fields };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// The pinned cards as stored.
function storedCards(data: Record<string, unknown>): Record<string, unknown>[] {
  const cards = data[PINNED_KEY];
  return Array.isArray(cards) ? cards.filter(isRecord) : [];
}

async function setUp(pinned: unknown[], history: unknown, trackingEnabled = true) {
  const settings = createOptionsTestSettings({
    sync: { [PINNED_KEY]: pinned, [progressTrackingEnabled.key]: trackingEnabled },
    local: { [HISTORY_KEY]: history }
  });
  // The page reads the Labs switch with its other settings.
  await settings.store.include(progressTrackingEnabled);
  const toasts: Array<{ message: string; isError: boolean | undefined }> = [];
  const controller = createRecentSitesController({
    settings: settings.store,
    t: (_key, fallback) => fallback,
    showToast: (message, isError) => { toasts.push({ message, isError }); },
    openExternalNewTabUrl() {},
    hasShortcutForSite: () => false,
    addSiteToShortcuts() {},
    hideCursorTooltip() {},
    hideTopActionTooltip() {},
    normalizeHost: (host) => String(host || '').toLowerCase().replace(/^www\./, ''),
    getCanonicalPageUrlForFavicon: (url) => url,
    sanitizeDisplayText: (text) => String(text || '').trim(),
    getSiteDisplayName: (host) => host,
    shouldExcludeFromRecentSites: () => false,
    isBrowserPageRecentUrl: () => false,
    progressMatch,
    progressHistory,
    recentContextMenuSelectController: createSelectMenuController(),
    recentShown: new RecentSitesShown(),
    locale: new SurfaceLocale(settings.store, async () => ({})),
    otherContextMenus: []
  });
  await controller.followStoredSites();
  await settings.settle();
  return {
    controller,
    toasts,
    pinned: () => storedCards(settings.data.sync),
    history: () => settings.data.local[HISTORY_KEY]
  };
}

const tracked = site('https://vidhub3.top/vodplay/55357-1-3.html', '某剧 第3集', { progressTracking: true, progressId: 'p1' });
const history = {
  p1: [
    { url: 'https://vidhub3.top/vodplay/55357-1-2.html', title: '某剧 第2集', updatedAt: 300 },
    { url: 'https://vidhub3.top/vodplay/55357-1-1.html', title: '某剧 第1集', updatedAt: 200 }
  ]
};
const episode = site('https://vidhub3.top/vodplay/55357-1-1.html', '某剧 第1集');
const docs = site('https://example.com/docs/getting-started', 'Getting started');
const menuValues = (controller: Awaited<ReturnType<typeof setUp>>['controller'], item: RecentSite) =>
  controller.getRecentContextMenuOptions({ item, element: document.createElement('div') }).map((option) => option.value);

describe('recent site progress tracking', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the badge and the menu items while the Labs switch is on', async () => {
    const { controller } = await setUp([tracked], history);

    expect(controller.getRecentProgressState(tracked)).toBe('tracking');
    expect(menuValues(controller, tracked)).toEqual(['open-in-new-tab', 'add-shortcut', 'stop-progress', 'progress-history', 'remove']);
    expect(menuValues(controller, site('https://example.com/', 'Example'))).toEqual(['open-in-new-tab', 'add-shortcut', 'track-progress', 'remove']);
  });

  it('offers no badge, menu items or switch while the Labs switch is off', async () => {
    const { controller } = await setUp([tracked], history, false);

    expect(controller.getRecentProgressState(tracked)).toBe('');
    expect(menuValues(controller, tracked)).toEqual(['open-in-new-tab', 'add-shortcut', 'remove']);
  });

  it('turns tracking on and off from a pinned card’s switch, and offers none on an unpinned card', async () => {
    const { controller } = await setUp([docs], {});

    expect(controller.getRecentProgressState(docs)).toBe('available');
    expect(controller.getRecentProgressState(site('https://other.com/', 'Other'))).toBe('');
    await expect(controller.toggleRecentProgressTracking(docs)).resolves.toBe(true);
    expect(controller.getRecentProgressState(docs)).toBe('tracking');
    await expect(controller.toggleRecentProgressTracking(docs)).resolves.toBe(true);
    expect(controller.getRecentProgressState(docs)).toBe('available');
    await expect(controller.toggleRecentProgressTracking(site('https://other.com/', ''))).resolves.toBe(false);
  });

  it('folds pages of the tracked work into its card and still shows and pins another video of the site', async () => {
    const trackedBili = site('https://www.bilibili.com/video/BV11LEA6eEuj?p=3', '合集名 第3集_哔哩哔哩_bilibili', { progressTracking: true, progressId: 'pa' });
    const { controller, pinned } = await setUp([trackedBili], {});
    const merged = controller.mergeRecentSitesWithPinned([
      { url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '饼干童子军_哔哩哔哩_bilibili', lastVisitTime: 30 },
      { url: 'https://www.bilibili.com/video/BV11LEA6eEuj?p=2', title: '合集名 第2集_哔哩哔哩_bilibili', lastVisitTime: 20 },
      { url: 'https://github.com/', title: 'GitHub', lastVisitTime: 10 }
    ], 4);

    expect(merged.map((item) => item.url)).toEqual([trackedBili.url, 'https://www.bilibili.com/video/BV1xx411c7mD', 'https://github.com/']);
    const otherVideo = site('https://www.bilibili.com/video/BV1xx411c7mD', '饼干童子军');
    expect(controller.isRecentSitePinned(otherVideo)).toBe(false);
    await expect(controller.togglePinnedRecentSite(otherVideo)).resolves.toMatchObject({ pinned: true });
    expect(pinned().map((item) => item.url)).toEqual([otherVideo.url, trackedBili.url]);
  });

  it('pins a card to track it, and keeps it pinned without the tracking fields when stopped', async () => {
    const { controller, pinned, toasts } = await setUp([], {});
    const item = site('https://www.bilibili.com/video/BV11LEA6eEuj?p=2', '合集 P2');

    await expect(controller.setProgressTracking(item, true)).resolves.toBe(true);
    expect(pinned()[0]).toMatchObject({ url: item.url, progressTracking: true, progressId: expect.stringMatching(/^p[a-z0-9]+$/) });
    expect(controller.getRecentProgressState(item)).toBe('tracking');
    expect(toasts.pop()?.isError).toBe(false);
    await expect(controller.setProgressTracking(item, false)).resolves.toBe(true);
    expect(pinned()[0].url).toBe(item.url);
    expect(pinned()[0]).not.toHaveProperty('progressTracking');
    expect(pinned()[0]).not.toHaveProperty('progressId');
  });

  it('explains the pin limit when there is no room to track another card', async () => {
    const full = [1, 2, 3].map((n) => site(`https://site${n}.com/`, `${n}`));
    const { controller, toasts } = await setUp(full, {});

    await expect(controller.setProgressTracking(site('https://new.com/', 'New'), true)).resolves.toBe(false);
    expect(toasts.pop()?.isError).toBe(true);
  });

  it('starts tracking when an episode is pinned, and pins other pages quietly', async () => {
    const { controller, pinned, toasts } = await setUp([], {});

    await expect(controller.togglePinnedRecentSite(episode)).resolves.toMatchObject({ pinned: true });
    expect(pinned()[0]).toMatchObject({ progressTracking: true, progressId: expect.stringMatching(/^p[a-z0-9]+$/) });
    expect(toasts.pop()?.isError).toBe(false);
    await controller.togglePinnedRecentSite(docs);
    expect(pinned().find((item) => item.url === docs.url)).not.toHaveProperty('progressTracking');
    expect(toasts).toHaveLength(0);
  });

  it('does not start tracking on a pin while the Labs switch is off', async () => {
    const { controller, pinned } = await setUp([], {}, false);
    await controller.togglePinnedRecentSite(episode);

    expect(pinned()[0]).not.toHaveProperty('progressTracking');
  });

  it('keeps the pinned site card when a series of the site is pinned', async () => {
    const home = site('https://www.bilibili.com/', '哔哩哔哩');
    const { controller, pinned } = await setUp([home], {});
    const series = site('https://www.bilibili.com/video/BV11LEA6eEuj?p=2', '合集 P2');

    await expect(controller.togglePinnedRecentSite(series)).resolves.toMatchObject({ pinned: true });
    expect(pinned().map((item) => item.url)).toEqual([series.url, home.url]);
  });

  it('asks an open tab with the page when the title and URL cannot tell, and pins anyway when it does not answer', async () => {
    let answer = (message: { url?: unknown }, callback: (reply: unknown) => void) => callback({ ok: true, series: message.url === 'https://example.com/v/abc' });
    const sendMessage = vi.fn((message: { url?: unknown }, callback: (reply: unknown) => void) => answer(message, callback));
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage } });
    const { controller, pinned } = await setUp([], {});
    const video = site('https://example.com/v/abc', '某视频');

    await controller.togglePinnedRecentSite(video);
    expect(pinned()[0].progressTracking).toBe(true);
    expect(sendMessage.mock.calls.map((call) => call[0])).toEqual([{ action: 'probeProgressSeries', url: 'https://example.com/v/abc' }]);
    await controller.togglePinnedRecentSite(video);
    await controller.togglePinnedRecentSite(episode);
    expect(sendMessage).toHaveBeenCalledTimes(1);

    answer = () => {};
    const started = Date.now();
    await expect(controller.togglePinnedRecentSite(site('https://example.com/docs', 'Docs'))).resolves.toMatchObject({ pinned: true });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(pinned().find((item) => item.url === 'https://example.com/docs')).not.toHaveProperty('progressTracking');
  });

  it('swaps a restored version with the current one in the card and its history', async () => {
    const { controller, pinned, history: storedHistory } = await setUp([{ ...tracked, siteName: '某剧 第3集' }], history);

    await expect(controller.restoreProgressVersion({ cardId: 'p1', url: tracked.url, title: tracked.title, updateHistory: history.p1 }, history.p1[1], 1))
      .resolves.toBe(true);
    expect(pinned()[0]).toMatchObject({ url: 'https://vidhub3.top/vodplay/55357-1-1.html', title: '某剧 第1集', progressTracking: true });
    expect(pinned()[0].siteName).not.toBe('某剧 第3集');
    const versions = isRecord(storedHistory()) ? Reflect.get(Object(storedHistory()), 'p1') : null;
    expect(Array.isArray(versions) ? versions.map((version) => (isRecord(version) ? version.url : null)) : null)
      .toEqual([tracked.url, 'https://vidhub3.top/vodplay/55357-1-2.html']);
    await expect(controller.restoreProgressVersion({ cardId: 'example.com', url: '', title: '', updateHistory: [] }, null, 0)).resolves.toBe(false);
  });
});
