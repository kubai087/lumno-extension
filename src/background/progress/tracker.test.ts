import { describe, expect, it } from 'vitest';
import { pinnedRecentSites, progressHistory } from '../../domain/settings/recent-sites';
import { createSettingsStore } from '../../platform/settings-store';
import { createProgressTracker } from './tracker';
import type { PageHints } from './types';
import { WORKER_SETTINGS } from '../worker-settings';
import type { WorkerTab } from '../../../tests/fakes/worker';
import { browserTab, installWorkerFake, settleWorker } from '../../../tests/fakes/worker';

interface TrackerOptions {
  enabled?: boolean;
  // What a page says about itself, by the world it is read in.
  pageHints?: (tab: WorkerTab | undefined, world: string) => Partial<PageHints> | null;
  // How the person reached each address (history.getVisits).
  transitions?: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// The tracker over the worker fake, with a dwell timer the test runs out.
function createTracker(pinned: Record<string, unknown>[], options: TrackerOptions = {}) {
  const fake = installWorkerFake({ sync: { [pinnedRecentSites.key]: pinned } });
  const timers: { callback: () => unknown; cleared: boolean; fired: boolean }[] = [];
  fake.chrome.scripting.executeScript.mockImplementation((injection, callback) => {
    const tab = fake.tabs.find((each) => each.id === injection.target.tabId);
    const hints = options.pageHints ? options.pageHints(tab, injection.world || 'ISOLATED') : null;
    if (callback) callback([{ result: hints }]);
    return undefined;
  });
  fake.chrome.history.getVisits.mockImplementation((details, callback) => {
    const url = isRecord(details) ? String(details.url) : '';
    const transition = options.transitions ? options.transitions[url] : undefined;
    if (callback) callback(transition ? [{ visitTime: 1, transition }] : []);
    return undefined;
  });
  const tracker = createProgressTracker({
    chromeApi: chrome,
    settingsStore: createSettingsStore({ chromeApi: chrome, settings: WORKER_SETTINGS }),
    isEnabled: () => options.enabled !== false,
    dwellMs: 1000,
    now: () => 5000,
    setTimer(callback) {
      timers.push({ callback, cleared: false, fired: false });
      return timers.length;
    },
    clearTimer(id) {
      const timer = typeof id === 'number' ? timers[id - 1] : undefined;
      if (timer) timer.cleared = true;
    }
  });
  tracker.attach();
  const store = (tab: WorkerTab) => {
    const index = fake.tabs.findIndex((each) => each.id === tab.id);
    if (index >= 0) fake.tabs[index] = tab;
    else fake.tabs.push(tab);
    return tab;
  };
  const injections = () => fake.chrome.scripting.executeScript.mock.calls.map(([injection]) => injection);
  return {
    tracker,
    injections,
    open(tabId: number, openerTabId: number) {
      fake.chrome.tabs.onCreated.fire(browserTab({ id: tabId, openerTabId }));
    },
    visit(tabId: number, url: string, title: string, extra: Partial<chrome.tabs.Tab> = {}) {
      const tab = store({ id: tabId, url, title, active: true, audible: false, incognito: false, ...extra });
      fake.chrome.tabs.onUpdated.fire(tabId, { url, status: 'complete' }, tab);
    },
    update(tabId: number, patch: Partial<chrome.tabs.Tab>) {
      const tab = store({ ...fake.tabs.find((each) => each.id === tabId), ...patch, id: tabId });
      fake.chrome.tabs.onUpdated.fire(tabId, patch, tab);
    },
    async activate(tabId: number) {
      store({ ...fake.tabs.find((each) => each.id === tabId), active: true, id: tabId });
      fake.chrome.tabs.onActivated.fire({ tabId, windowId: 1 });
      await settleWorker(5);
    },
    // Runs out the dwell timers due now and lets their reads and writes land.
    async elapse() {
      await settleWorker(5);
      for (const timer of timers.filter((each) => !each.cleared && !each.fired)) {
        timer.fired = true;
        await timer.callback();
      }
      await settleWorker(10);
    },
    pinned(): Record<string, unknown>[] {
      const value = fake.storage.sync.values[pinnedRecentSites.key];
      return Array.isArray(value) ? value.filter(isRecord) : [];
    },
    history(): Record<string, Record<string, unknown>[]> {
      const value = fake.storage.local.values[progressHistory.key];
      return isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, list]) => [key, Array.isArray(list) ? list.filter(isRecord) : []])) : {};
    }
  };
}

const trackedCard = {
  title: '某剧 第1集',
  url: 'https://vidhub3.top/vodplay/55357-1-1.html',
  host: 'vidhub3.top',
  siteName: 'vidhub3',
  pinnedAt: 1,
  progressTracking: true
};
const otherCard = { title: 'GitHub', url: 'https://github.com/', host: 'github.com', pinnedAt: 2 };
const episode2 = 'https://vidhub3.top/vodplay/55357-1-2.html';

describe('the progress tracker', () => {
  it('moves the card forward once the next episode was watched for the dwell time', async () => {
    const page = createTracker([trackedCard, otherCard]);
    page.visit(1, episode2, '某剧 第2集');
    await settleWorker(5);

    expect(page.pinned()[0].url).toBe(trackedCard.url);
    await page.elapse();
    const [card, untouched] = page.pinned();
    expect(card).toMatchObject({ url: episode2, title: '某剧 第2集', lastVisitTime: 5000, progressTracking: true, pinnedAt: 1 });
    expect(card).not.toHaveProperty('siteName');
    expect(untouched).toEqual(otherCard);
    expect(page.history()['vidhub3.top']).toEqual([{ url: trackedCard.url, title: '某剧 第1集', updatedAt: 5000 }]);
  });

  it('does nothing for a page left before the dwell time ends', async () => {
    const page = createTracker([trackedCard]);
    page.visit(1, episode2, '某剧 第2集');
    page.visit(1, 'https://vidhub3.top/', '首页');
    await page.elapse();

    expect(page.pinned()[0].url).toBe(trackedCard.url);
  });

  it('lets a background tab dwell once the person looks at it', async () => {
    const page = createTracker([trackedCard]);
    page.visit(1, episode2, '某剧 第2集', { active: false });
    await page.elapse();

    expect(page.pinned()[0].url).toBe(trackedCard.url);
    await page.activate(1);
    await page.elapse();
    expect(page.pinned()[0].url).toBe(episode2);
  });

  it('counts a video playing in a background tab', async () => {
    const page = createTracker([trackedCard]);
    page.visit(1, episode2, '某剧 第2集', { active: false });
    await page.elapse();
    page.update(1, { audible: true });
    await page.elapse();

    expect(page.pinned()[0].url).toBe(episode2);
  });

  it('keeps the card where it is when an earlier episode is rewatched', async () => {
    const page = createTracker([{ ...trackedCard, url: 'https://vidhub3.top/vodplay/55357-1-12.html' }]);
    page.visit(1, 'https://vidhub3.top/vodplay/55357-1-3.html', '某剧 第3集');
    await page.elapse();

    expect(page.pinned()[0].url).toBe('https://vidhub3.top/vodplay/55357-1-12.html');
  });

  it.each([
    ['an untracked card', [{ ...trackedCard, progressTracking: false }], episode2, {}, {}],
    ['another work', [trackedCard], 'https://vidhub3.top/vodplay/60001-1-1.html', {}, {}],
    ['tracking switched off', [trackedCard], episode2, {}, { enabled: false }],
    ['an incognito tab', [trackedCard], episode2, { incognito: true }, {}]
  ])('never moves for %s', async (_case, pinned, url, extra, options) => {
    const page = createTracker(pinned, options);
    page.visit(1, url, '某剧 第2集', extra);
    await page.elapse();

    expect(page.pinned()[0].url).toBe(trackedCard.url);
  });

  it('advances again with each later episode and keeps the trail', async () => {
    const page = createTracker([trackedCard]);
    page.visit(1, episode2, '某剧 第2集');
    await page.elapse();
    page.update(1, { title: '某剧 第2集 - 正在播放' });
    await page.elapse();
    page.visit(1, 'https://vidhub3.top/vodplay/55357-1-3.html', '某剧 第3集');
    await page.elapse();

    expect(page.pinned()[0].url).toBe('https://vidhub3.top/vodplay/55357-1-3.html');
    expect(page.history()['vidhub3.top'].map((version) => version.url)).toEqual([episode2, trackedCard.url]);
  });

  it('lets each card on one site follow its own work, with its own history', async () => {
    const seriesA = { ...trackedCard, progressId: 'pa' };
    const seriesB = {
      title: '另一部剧 第5集', url: 'https://vidhub3.top/vodplay/60001-1-5.html', host: 'vidhub3.top', pinnedAt: 3, progressTracking: true, progressId: 'pb'
    };
    const page = createTracker([seriesA, seriesB]);
    page.visit(1, 'https://vidhub3.top/vodplay/60001-1-6.html', '另一部剧 第6集');
    await page.elapse();
    const [a, b] = page.pinned();

    expect(a.url).toBe(seriesA.url);
    expect(b.url).toBe('https://vidhub3.top/vodplay/60001-1-6.html');
    expect(Object.keys(page.history())).toEqual(['pb']);
  });

  describe('an address that tells nothing', () => {
    const opaqueCard = { title: '发现TV 在线播放', url: 'https://faxiantv.cc/player.php?share=aae5ca3dda55', progressTracking: true, progressId: 'pf' };
    const opaqueNext = 'https://faxiantv.cc/player.php?share=f3a3ce602a22';

    it("continues with a page clicked on from the card's page in the same tab", async () => {
      const page = createTracker([opaqueCard], { transitions: { [opaqueNext]: 'link' } });
      page.visit(1, opaqueCard.url, '发现TV 在线播放');
      page.visit(1, opaqueNext, '发现TV 在线播放');
      await page.elapse();

      expect(page.pinned()[0].url).toBe(opaqueNext);
    });

    it('continues with a tab opened from the card', async () => {
      const page = createTracker([opaqueCard], { transitions: { [opaqueNext]: 'link' } });
      page.visit(1, opaqueCard.url, '发现TV 在线播放');
      page.open(2, 1);
      page.visit(2, 'about:blank', '');
      page.visit(2, opaqueNext, '发现TV 在线播放');
      await page.elapse();

      expect(page.pinned()[0].url).toBe(opaqueNext);
    });

    it('does not continue with a typed address, or one reached from elsewhere', async () => {
      const typed = createTracker([opaqueCard], { transitions: { [opaqueNext]: 'typed' } });
      typed.visit(1, opaqueCard.url, '发现TV 在线播放');
      typed.visit(1, opaqueNext, '发现TV 在线播放');
      await typed.elapse();
      expect(typed.pinned()[0].url).toBe(opaqueCard.url);

      const elsewhere = createTracker([opaqueCard]);
      elsewhere.visit(1, opaqueNext, '发现TV 在线播放');
      await elsewhere.elapse();
      expect(elsewhere.pinned()[0].url).toBe(opaqueCard.url);
    });

    it("continues when the new page's previous link points at the card, read in the isolated world", async () => {
      const page = createTracker([opaqueCard], {
        pageHints: (tab) => (tab && tab.url === opaqueNext ? { prevUrls: [opaqueCard.url] } : null)
      });
      page.visit(1, opaqueNext, '发现TV 在线播放');
      await page.elapse();

      expect(page.pinned()[0].url).toBe(opaqueNext);
      expect(page.injections().every((injection) => injection.world !== 'MAIN')).toBe(true);
    });

    it('never reads pages of sites the person does not track', async () => {
      const page = createTracker([opaqueCard]);
      page.visit(1, 'https://github.com/', 'GitHub');
      await page.elapse();

      expect(page.injections()).toEqual([]);
    });
  });

  it("remembers the next page the card's own page names, for an address of another shape", async () => {
    const vol2 = 'https://www.bilinovel.com/novel/2013/vol2/1.html';
    const chapterCard = { title: '某轻小说 第一卷 终章', url: 'https://www.bilinovel.com/novel/2013/72035_3.html', progressTracking: true, progressId: 'pn' };
    const page = createTracker([chapterCard], {
      pageHints: (tab, world) => (world === 'ISOLATED' && tab && tab.url === chapterCard.url ? { nextUrls: [vol2] } : null)
    });
    page.visit(1, chapterCard.url, chapterCard.title);
    await page.elapse();
    page.visit(2, vol2, '某轻小说 第二卷 序章');
    await page.elapse();

    expect(page.pinned()[0].url).toBe(vol2);
  });

  it('follows what the player names when every episode has one address', async () => {
    const embyUrl = 'https://media.example.com/web/index.html#!/videoosd/videoosd.html';
    let playing = { title: '第1集 初遇', series: '某剧' };
    const page = createTracker([{ title: 'Emby', url: embyUrl, progressTracking: true, progressId: 'pe' }], {
      pageHints: (_tab, world) => (world === 'MAIN' ? playing : {})
    });
    page.visit(1, embyUrl, 'Emby');
    await page.elapse();

    expect(page.pinned()[0]).toMatchObject({ title: '某剧 第1集 初遇', url: embyUrl });
    expect(page.history()).toEqual({});
    playing = { title: '第2集 重逢', series: '某剧' };
    page.update(1, { audible: true });
    await page.elapse();
    expect(page.pinned()[0].title).toBe('某剧 第2集 重逢');
    expect(page.history().pe.map((version) => version.title)).toEqual(['某剧 第1集 初遇']);
  });

  it("reads an open tab's episode navigation as a series page when it is pinned", async () => {
    const page = createTracker([], {
      pageHints: (tab) => (tab && tab.url === 'https://example.com/v/abc' ? { episodeNavigation: true } : null)
    });
    page.visit(1, 'https://example.com/v/abc', '某视频');
    page.visit(2, 'https://example.com/docs', 'Docs');

    expect(await page.tracker.probeSeries('https://example.com/v/abc')).toBe(true);
    expect(await page.tracker.probeSeries('https://example.com/v/other')).toBe(false);
    expect(await page.tracker.probeSeries('https://example.com/docs')).toBe(false);
  });
});
