const assert = require('assert');
const fs = require('fs');
const store = require('../../src/domain/recent-sites-store.ts');
const progressMatch = require('../../src/domain/progress-match.ts');
const progressHistory = require('../../src/domain/progress-history.ts');
const { loadBackground, wait } = require('../helpers/background-harness');
const { getPageScripts } = require('../helpers/runtime-scripts');
require('../../src/newtab/dismiss-stack.ts');
const LumnoNewtabRecentSitesController = require('../../src/newtab/recent/recent-sites-controller.ts');
const recentSiteSettings = require('../../src/domain/settings/recent-sites.ts');
const { pinnedRecentSites } = recentSiteSettings;

const PINNED_KEY = pinnedRecentSites.key;
const HISTORY_KEY = recentSiteSettings.progressHistory.key;

// Pinned cards keep their tracking fields; other cards never gain them.
{
  const [tracked, plain] = store.normalizePinnedRecentSites([
    { url: 'https://vidhub3.top/vodplay/55357-1-2.html', title: '某剧 第2集', progressTracking: true, progressId: 'p1' },
    { url: 'https://github.com/', title: 'GitHub', progressId: 'p2' }
  ]);
  assert.strictEqual(tracked.progressTracking, true);
  assert.strictEqual(tracked.progressId, 'p1');
  assert.strictEqual('progressTracking' in plain, false);
  assert.strictEqual('progressId' in plain, false);
  assert.deepStrictEqual(
    store.normalizePinnedRecentSites([{ url: '', progressTracking: true }]),
    [],
    'an invalid card stays dropped'
  );
}

// A tracked card is one work, not a whole site.
{
  const pinned = store.normalizePinnedRecentSites([
    { url: 'https://www.bilibili.com/video/BV11LEA6eEuj?p=2', title: '合集 P2', progressTracking: true, progressId: 'pa' },
    { url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '另一个合集 第1集', progressTracking: true, progressId: 'pb' },
    { url: 'https://www.bilibili.com/', title: '哔哩哔哩' },
    { url: 'https://www.bilibili.com/anime/', title: '番剧' }
  ], { maxPinned: 5 });
  assert.deepStrictEqual(pinned.map((item) => item.url), [
    'https://www.bilibili.com/video/BV11LEA6eEuj?p=2',
    'https://www.bilibili.com/video/BV1xx411c7mD',
    'https://www.bilibili.com/'
  ], 'tracked works coexist with one ordinary card for the site');
}

function createArea(initial) {
  const data = { ...initial };
  return {
    data,
    get(keys, callback) {
      const result = {};
      keys.forEach((key) => { if (key in data) result[key] = data[key]; });
      callback(result);
    },
    set(value, callback) {
      Object.assign(data, JSON.parse(JSON.stringify(value)));
      if (callback) callback();
    }
  };
}

function createController(pinned, history, options = {}) {
  const state = {
    pinnedRecentSites: store.normalizePinnedRecentSites(pinned),
    hiddenRecentSites: [],
    recentSourceItems: [],
    recentRenderSignature: 'x',
    progressHistoryMap: progressHistory.normalizeHistoryMap(history)
  };
  const trackingEnabled = options.enabled !== false;
  const syncArea = createArea({ [PINNED_KEY]: pinned });
  const localArea = createArea({ [HISTORY_KEY]: history });
  const toasts = [];
  const opened = [];
  let renders = 0;
  const controller = LumnoNewtabRecentSitesController.createRecentSitesController({
    NEWTAB_CONTEXT_MENU_OPEN_VALUE: 'open',
    settings: { get: (setting) => (setting === recentSiteSettings.progressTrackingEnabled ? trackingEnabled : setting.parse(undefined)) },
    t: (_key, fallback) => fallback,
    showToast: (message, isError) => toasts.push({ message, isError }),
    openExternalNewTabUrl() {},
    hasShortcutForSite: () => false,
    addSiteToShortcuts() {},
    closeShortcutContextMenu() {},
    closeBookmarkContextMenu() {},
    canDismissRecentCard: () => true,
    hideCursorTooltip() {},
    hideTopActionTooltip() {},
    normalizeHost: (host) => String(host || '').toLowerCase().replace(/^www\./, ''),
    getHostFromUrl: (url) => new URL(url).hostname.replace(/^www\./, ''),
    getCanonicalPageUrlForFavicon: (url) => url,
    sanitizeDisplayText: (text) => String(text || '').trim(),
    getSiteDisplayName: (host) => host,
    shouldExcludeFromRecentSites: () => false,
    isBrowserPageRecentUrl: () => false,
    MAX_PINNED_RECENT_SITES: 3,
    NEWTAB_RECENT_STORE: store,
    recentSitesStorageArea: syncArea,
    HIDDEN_RECENT_SITES_STORAGE_KEY: '_hidden',
    renderRecentSites: () => { renders += 1; },
    PINNED_RECENT_SITES_STORAGE_KEY: PINNED_KEY,
    progressMatch,
    progressHistory,
    progressHistoryStorageArea: localArea,
    openProgressHistory: (item) => opened.push(item),
    pageState: state
  });
  return { controller, state, syncArea, localArea, toasts, opened, getRenders: () => renders };
}

const tracked = {
  url: 'https://vidhub3.top/vodplay/55357-1-3.html',
  title: '某剧 第3集',
  progressTracking: true,
  progressId: 'p1'
};
const history = {
  p1: [
    { url: 'https://vidhub3.top/vodplay/55357-1-2.html', title: '某剧 第2集', updatedAt: 300 },
    { url: 'https://vidhub3.top/vodplay/55357-1-1.html', title: '某剧 第1集', updatedAt: 200 }
  ]
};
const menuValues = (controller, item) => controller.getRecentContextMenuOptions({ item }).map((option) => option.value);

(async () => {
  // Badge state and menu items follow the Labs switch.
  {
    const { controller } = createController([tracked], history);
    assert.strictEqual(controller.getRecentProgressState(tracked), 'tracking');
    assert.deepStrictEqual(menuValues(controller, tracked), ['open', 'add-shortcut', 'stop-progress', 'progress-history', 'remove']);
    assert.deepStrictEqual(menuValues(controller, { url: 'https://example.com/', title: 'Example' }),
      ['open', 'add-shortcut', 'track-progress', 'remove']);
  }
  {
    const { controller } = createController([tracked], history, { enabled: false });
    assert.strictEqual(controller.getRecentProgressState(tracked), '');
    assert.deepStrictEqual(menuValues(controller, tracked), ['open', 'add-shortcut', 'remove']);
  }

  // Pinned cards offer the switch on the card; it turns tracking on and off.
  {
    const docs = { url: 'https://example.com/docs/getting-started', title: 'Getting started' };
    const harness = createController([docs], {});
    assert.strictEqual(harness.controller.getRecentProgressState(docs), 'available');
    assert.strictEqual(harness.controller.getRecentProgressState({ url: 'https://other.com/', title: 'Other' }), '',
      'unpinned cards have no switch');
    assert.strictEqual(await harness.controller.toggleRecentProgressTracking(docs), true);
    assert.strictEqual(harness.controller.getRecentProgressState(docs), 'tracking');
    assert.strictEqual(await harness.controller.toggleRecentProgressTracking(docs), true);
    assert.strictEqual(harness.controller.getRecentProgressState(docs), 'available');
    assert.strictEqual(await harness.controller.toggleRecentProgressTracking({ url: 'https://other.com/' }), false);
  }
  {
    const harness = createController([tracked], history, { enabled: false });
    assert.strictEqual(harness.controller.getRecentProgressState(tracked), '', 'no switch while the setting is off');
  }

  // Leaving a tracked page for another video on the same site still records
  // that video; pages of the tracked work fold into its card.
  {
    const trackedBili = {
      url: 'https://www.bilibili.com/video/BV11LEA6eEuj?p=3',
      title: '合集名 第3集_哔哩哔哩_bilibili',
      progressTracking: true,
      progressId: 'pa'
    };
    const harness = createController([trackedBili], {});
    const merged = harness.controller.mergeRecentSitesWithPinned([
      { url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '饼干童子军_哔哩哔哩_bilibili', lastVisitTime: 30 },
      { url: 'https://www.bilibili.com/video/BV11LEA6eEuj?p=2', title: '合集名 第2集_哔哩哔哩_bilibili', lastVisitTime: 20 },
      { url: 'https://github.com/', title: 'GitHub', lastVisitTime: 10 }
    ], 4);
    assert.deepStrictEqual(merged.map((item) => item.url), [
      trackedBili.url,
      'https://www.bilibili.com/video/BV1xx411c7mD',
      'https://github.com/'
    ]);
    const otherVideo = { url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '饼干童子军' };
    assert.strictEqual(harness.controller.isRecentSitePinned(otherVideo), false);
    const pinResult = await harness.controller.togglePinnedRecentSite(otherVideo);
    assert.strictEqual(pinResult.pinned, true);
    assert.deepStrictEqual(harness.syncArea.data[PINNED_KEY].map((item) => item.url),
      [otherVideo.url, trackedBili.url], 'pinning another video keeps the tracked card');
  }

  // Tracking an unpinned card pins it; stopping keeps it pinned without the fields.
  {
    const harness = createController([], {});
    const item = { url: 'https://www.bilibili.com/video/BV11LEA6eEuj?p=2', title: '合集 P2' };
    assert.strictEqual(await harness.controller.setProgressTracking(item, true), true);
    let [card] = harness.syncArea.data[PINNED_KEY];
    assert.strictEqual(card.url, item.url);
    assert.strictEqual(card.progressTracking, true);
    assert.match(card.progressId, /^p[a-z0-9]+$/, 'a tracked card gets its own history id');
    assert.strictEqual(harness.controller.getRecentProgressState(item), 'tracking');
    assert.strictEqual(harness.toasts.pop().isError, false);
    assert.strictEqual(await harness.controller.setProgressTracking(item, false), true);
    [card] = harness.syncArea.data[PINNED_KEY];
    assert.strictEqual(card.url, item.url, 'stopping keeps the card pinned');
    assert.strictEqual('progressTracking' in card, false);
    assert.strictEqual('progressId' in card, false);
  }
  {
    const full = [1, 2, 3].map((n) => ({ url: `https://site${n}.com/`, title: `${n}` }));
    const harness = createController(full, {});
    assert.strictEqual(await harness.controller.setProgressTracking({ url: 'https://new.com/', title: 'New' }, true), false);
    assert.strictEqual(harness.toasts.pop().isError, true, 'the pin limit is explained');
  }

  // Pinning an episode or chapter starts tracking it; other pages just pin.
  {
    const harness = createController([], {});
    const episode = { url: 'https://vidhub3.top/vodplay/55357-1-1.html', title: '某剧 第1集' };
    const result = await harness.controller.togglePinnedRecentSite(episode);
    assert.strictEqual(result.pinned, true);
    const [card] = harness.syncArea.data[PINNED_KEY];
    assert.strictEqual(card.progressTracking, true);
    assert.match(card.progressId, /^p[a-z0-9]+$/);
    assert.strictEqual(harness.toasts.pop().isError, false, 'the person learns tracking started');
    const docs = { url: 'https://example.com/docs/getting-started', title: 'Getting started' };
    await harness.controller.togglePinnedRecentSite(docs);
    const docsCard = harness.syncArea.data[PINNED_KEY].find((item) => item.url === docs.url);
    assert.strictEqual('progressTracking' in docsCard, false);
    assert.strictEqual(harness.toasts.length, 0, 'plain pins stay quiet');
  }
  {
    const harness = createController([], {}, { enabled: false });
    await harness.controller.togglePinnedRecentSite({ url: 'https://vidhub3.top/vodplay/55357-1-1.html', title: '某剧 第1集' });
    assert.strictEqual('progressTracking' in harness.syncArea.data[PINNED_KEY][0], false, 'the switch turns auto-tracking off');
  }
  {
    const home = { url: 'https://www.bilibili.com/', title: '哔哩哔哩' };
    const harness = createController([home], {});
    const series = { url: 'https://www.bilibili.com/video/BV11LEA6eEuj?p=2', title: '合集 P2' };
    const result = await harness.controller.togglePinnedRecentSite(series);
    assert.strictEqual(result.pinned, true);
    assert.deepStrictEqual(harness.syncArea.data[PINNED_KEY].map((item) => item.url),
      [series.url, home.url], 'pinning a series keeps the pinned site card');
  }

  // When the title and URL cannot tell, an open tab with the page is asked.
  {
    const sent = [];
    let reply = (message, callback) => callback({ ok: true, series: message.url === 'https://example.com/v/abc' });
    global.chrome = {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          sent.push(message);
          reply(message, callback);
        }
      }
    };
    try {
      const harness = createController([], {});
      await harness.controller.togglePinnedRecentSite({ url: 'https://example.com/v/abc', title: '某视频' });
      assert.strictEqual(harness.syncArea.data[PINNED_KEY][0].progressTracking, true, 'episode navigation on the open page');
      assert.deepStrictEqual(sent, [{ action: 'probeProgressSeries', url: 'https://example.com/v/abc' }]);
      await harness.controller.togglePinnedRecentSite({ url: 'https://example.com/v/abc', title: '某视频' });
      assert.strictEqual(sent.length, 1, 'unpinning asks nothing');
      await harness.controller.togglePinnedRecentSite({ url: 'https://vidhub3.top/vodplay/55357-1-1.html', title: '某剧 第1集' });
      assert.strictEqual(sent.length, 1, 'the title and URL already tell');
      reply = () => {};
      const started = Date.now();
      const result = await harness.controller.togglePinnedRecentSite({ url: 'https://example.com/docs', title: 'Docs' });
      assert.strictEqual(result.pinned, true, 'a page that never answers still pins');
      assert(Date.now() - started < 2000, 'the wait is short');
      const docs = harness.syncArea.data[PINNED_KEY].find((item) => item.url === 'https://example.com/docs');
      assert.strictEqual('progressTracking' in docs, false);
    } finally {
      delete global.chrome;
    }
  }

  // Restoring a version swaps it with the current one, in both stores.
  {
    const harness = createController([{ ...tracked, siteName: '某剧 第3集' }], history);
    const ok = await harness.controller.restoreProgressVersion(
      { cardId: 'p1', url: tracked.url, title: tracked.title, updateHistory: history.p1 },
      history.p1[1],
      1
    );
    assert.strictEqual(ok, true);
    const [card] = harness.syncArea.data[PINNED_KEY];
    assert.strictEqual(card.url, 'https://vidhub3.top/vodplay/55357-1-1.html');
    assert.strictEqual(card.title, '某剧 第1集');
    assert.strictEqual(card.progressTracking, true);
    assert.notStrictEqual(card.siteName, '某剧 第3集', 'a site name taken from the old title is derived again');
    assert.deepStrictEqual(
      harness.localArea.data[HISTORY_KEY].p1.map((version) => version.url),
      [tracked.url, 'https://vidhub3.top/vodplay/55357-1-2.html']
    );
    assert.strictEqual(await harness.controller.restoreProgressVersion(
      { cardId: 'example.com', updateHistory: [] }, null, 0
    ), false, 'a card that is not tracked cannot be restored');
  }

  // The worker answers New Tab's "is this an episode?" probe only while the
  // setting is on, and follows the setting when it changes.
  {
    const settings = require('../../src/domain/settings/index.ts');
    const key = settings.progressTrackingEnabled.key;
    const episode = { id: 5, index: 0, windowId: 1, url: 'https://vidhub3.top/vodplay/55357-1-2.html', title: '某剧 第2集' };
    const worker = loadBackground({ tabs: [episode], sync: { [key]: true } });
    await wait(50);
    const probe = () => worker.sendMessage({ action: 'probeProgressSeries', url: episode.url }, undefined, 1500);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(await probe())), { ok: true, series: true }, 'an open episode page reads as a series');
    worker.storage.sync.data[key] = false;
    worker.chrome.storage.onChanged.dispatch({ [key]: { oldValue: true, newValue: false } }, 'sync');
    await wait(20);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(await probe())), { ok: true, series: false }, 'with tracking turned off, nothing is probed');
  }
  {
    const { JSDOM } = require('jsdom');
    const newtabScripts = getPageScripts('newtab.html');
    assert(newtabScripts.includes('src/domain/progress-match.ts') && newtabScripts.includes('src/domain/progress-history.ts'));
    const newtabDocument = new JSDOM(fs.readFileSync('newtab.html', 'utf8')).window.document;
    assert(newtabDocument.querySelector('link[rel="stylesheet"][href$="recent-history-dialog.css"]'), 'New Tab should style the history dialog');
    const { createOptionsPage } = require('../helpers/options-page');
    const options = await createOptionsPage({});
    await options.settle(80);
    const toggle = options.byId('_x_extension_progress_tracking_toggle_2026_unique_');
    assert.deepStrictEqual([toggle.type, toggle.checked], ['checkbox', true], 'the switch is on by default');
    const general = options.document.querySelector('[data-content="general"]');
    const heading = Array.from(general.querySelectorAll('._x_extension_section_title_2024_unique_'))
      .find((node) => node.textContent === '新标签页设置');
    assert(heading && general.contains(toggle) && (heading.compareDocumentPosition(toggle) & 4),
      'the switch sits in the New Tab section of General settings');
    options.close();
    const settings = require('../../src/domain/settings/index.ts');
    assert.strictEqual(settings.progressTrackingEnabled.parse(undefined), true);
    assert.strictEqual(settings.progressTrackingEnabled.parse(false), false);
  }

  console.log('newtab progress tracking tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
