const assert = require('assert');
const fs = require('fs');
const path = require('path');
const faviconUtils = require('../src/shared/favicon-utils.js');
const shortcutFavicon = require('../src/shared/shortcut-favicon.js');
const shortcutsStore = require('../src/newtab/shortcuts-store.js');
const searchUtils = require('../src/shared/search-utils.js');
const faviconCache = require('../src/shared/favicon-cache.js');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
const newtabSource = readNewtabRuntimeSource();

function extractFunction(source, name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.notStrictEqual(start, -1, `missing function ${name}`);
  const openBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

function png(width, marker = 1) {
  const buffer = Buffer.alloc(25);
  buffer.set([137, 80, 78, 71, 13, 10, 26, 10]);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(width, 20);
  buffer[24] = marker;
  return buffer;
}

const chromeApi = {
  runtime: {
    id: 'test',
    getURL: (resource) => `chrome-extension://test/${String(resource).replace(/^\//, '')}`
  }
};

function createAcquisition(options = {}) {
  const state = {
    enhanced: options.enhanced !== false,
    excluded: options.excluded === true,
    hardBlocked: options.hardBlocked === true,
    browserImage: options.browserImage === undefined ? png(32, 2) : options.browserImage,
    proxyImage: options.proxyImage === undefined ? png(128, 3) : options.proxyImage,
    proxyMode: options.proxyMode || 'ok',
    pageImages: options.pageImages || {},
    calls: []
  };
  const placeholderImage = options.placeholderImage || png(16, 0);
  const resolver = faviconUtils.createFaviconUrlResolver({
    chromeApi,
    isEnhancedFaviconFetchEnabled: () => state.enhanced && !state.excluded,
    getStrictFaviconReason: () => state.excluded ? 'exclusion' : (state.enhanced ? '' : 'global-off'),
    shouldBlockFaviconForHost: () => state.hardBlocked
  });
  const deps = {
    resolver,
    setTimeout: (callback, ms) => setTimeout(callback, ms / 100),
    loadPolicy: () => Promise.resolve(),
    getTargetPolicy: () => ({ ok: true, hardBlocked: state.hardBlocked }),
    fetch: async (url, requestOptions) => {
      state.calls.push({ url, options: requestOptions });
      const parsed = new URL(url);
      const isBrowser = parsed.protocol === 'chrome-extension:';
      assert.ok(isBrowser || faviconUtils.isFaviconProxyUrl(url), 'only approved cache/proxy endpoints may be requested');
      assert.strictEqual(requestOptions.credentials, 'omit');
      assert.strictEqual(requestOptions.referrerPolicy, 'no-referrer');
      assert.strictEqual(requestOptions.redirect, 'error');
      if (!isBrowser && state.proxyMode === 'timeout') {
        return new Promise((resolve, reject) => {
          requestOptions.signal.addEventListener('abort', () => reject(new Error('proxy timeout')), { once: true });
        });
      }
      if (!isBrowser && state.proxyMode === 'error') throw new Error('proxy unavailable');
      const page = faviconUtils.getPageUrlFromFaviconProxyUrl(url);
      const perPageImage = state.pageImages[page];
      const image = page.includes('lumno.invalid') ? placeholderImage : (perPageImage
        ? perPageImage[isBrowser ? 'browser' : 'proxy'] : (isBrowser ? state.browserImage : state.proxyImage));
      if (isBrowser) assert.strictEqual(parsed.searchParams.get('fallbackToHost'), '0');
      return {
        ok: Boolean(image),
        url,
        headers: { get: () => '' },
        blob: async () => new Blob([image || ''], { type: 'image/png' })
      };
    }
  };
  const factory = new Function('deps', 'FAVICON_UTILS', 'SHORTCUT_FAVICON', `
    const fetch = deps.fetch;
    const setTimeout = deps.setTimeout;
    const SHORTCUT_FAVICON_RESOURCE_MAX_BYTES = 256 * 1024;
    const SHORTCUT_FAVICON_FETCH_TIMEOUT_MS = 6500;
    const BACKGROUND_FAVICON_DATA_CACHE_MAX_ENTRIES = 256;
    const BACKGROUND_SHORTCUT_FAVICON_CACHE_MAX_ENTRIES = 64;
    const faviconDataCache = new Map();
    const shortcutFaviconDataCache = new Map();
    const shortcutFaviconPending = new Map();
    let shortcutFaviconPolicyRevision = 0;
    const loadFaviconRequestBlacklistItems = deps.loadPolicy;
    const loadFaviconEnhancedFetchEnabled = deps.loadPolicy;
    const getFaviconTargetPolicy = deps.getTargetPolicy;
    const getBackgroundFaviconUrlResolver = () => deps.resolver;
    const isAllowedFaviconProxyRequestUrl = FAVICON_UTILS.isAllowedFaviconProxyRequestUrl;
    const arrayBufferToBase64 = (buffer) => Buffer.from(buffer).toString('base64');
    ${['getShortcutFaviconPreferredTheme', 'fetchShortcutFaviconResource',
      'resolveShortcutFaviconData', 'fetchShortcutFaviconData'].map((name) => extractFunction(backgroundSource, name)).join('\n')}
    return { fetchShortcutFaviconData };
  `);
  return { ...factory(deps, faviconUtils, shortcutFavicon), state, resolver };
}

function createFrontend(acquisition, pageUrl, options = {}) {
  const writes = [];
  const messages = [];
  const deps = {
    initialSnapshots: options.initialSnapshots || {},
    ensureCachesReady: options.ensureCachesReady || (() => Promise.resolve()),
    getPersistedFaviconDataEntry: (key) => (options.persistedEntries || {})[key] || null,
    scheduleWrite: (url) => writes.push(url),
    resolver: acquisition.resolver,
    providers: searchUtils.getDefaultSiteSearchProviders(),
    sendRuntimeMessage(message, callback) {
      messages.push(message);
      acquisition.fetchShortcutFaviconData(message.pageUrl, '', '', message.refresh, message.iconSource).then(callback);
      return true;
    }
  };
  const factory = new Function('deps', 'FAVICON_UTILS', 'SHORTCUT_FAVICON', 'NEWTAB_SHORTCUTS_STORE', 'pageUrl', `
    let newtabShortcutFavicons = deps.initialSnapshots;
    let newtabShortcuts = [{ url: pageUrl, ...(deps.iconSource ? { iconSource: deps.iconSource } : {}) }];
    let shortcutFaviconPolicyRevision = 0;
    const shortcutFaviconPending = new Map();
    const faviconCacheRuntime = { ensureCachesReady: deps.ensureCachesReady };
    const getPersistedFaviconDataEntry = deps.getPersistedFaviconDataEntry;
    const scheduleShortcutFaviconCacheWrite = deps.scheduleWrite;
    const getPageFaviconUrlResolver = () => deps.resolver;
    const enqueueShortcutFaviconRequest = (run) => Promise.resolve().then(run);
    const sendRuntimeMessage = deps.sendRuntimeMessage;
    const window = { setTimeout, clearTimeout };
    const SEARCH_UTILS = { getDefaultSiteSearchProviders: () => deps.providers };
    const getExtensionResourceUrl = (resource) => 'chrome-extension://test/' + resource;
    const document = {};
    const t = (_key, fallback) => fallback;
    const getRiSvg = () => '';
    const bindShortcutDialogTooltip = () => {};
    const hideShortcutDialogTooltip = () => {};
    const shortcutIconStore = { prepareFile: () => {} };
    const NEWTAB_SHORTCUT_DIALOG = { createShortcutDialog: (options) => options };
    const SHORTCUT_DIALOG_ITEM_BOOKMARK = 'bookmark';
    const SHORTCUT_DIALOG_ITEM_FOLDER = 'folder';
    const saveBookmarkFromDialog = () => Promise.resolve(true);
    const saveShortcutFromDialog = () => Promise.resolve(deps.saveResult !== false);
    const renderShortcuts = () => {};
    ${['getShortcutIconSource', 'getShortcutFaviconDataUrl', 'getShortcutFaviconCandidateUrl', 'getShortcutDialogBuiltinIconUrl', 'saveShortcutFaviconSnapshot',
      'resolveShortcutFaviconDataUrl', 'getShortcutDialogOnlineIconUrl',
      'getShortcutDialogOnlineIconSource', 'isShortcutDialogIconSourceAvailable',
      'refreshShortcutDialogOnlineIcon', 'createShortcutDialogComponent'].map((name) => extractFunction(newtabSource, name)).join('\n')}
    return {
      resolveShortcutFaviconDataUrl,
      getShortcutDialogOnlineIconUrl,
      getShortcutDialogOnlineIconSource,
      getShortcutFaviconCandidateUrl,
      getShortcutDialogBuiltinIconUrl,
      refreshShortcutDialogOnlineIcon,
      saveShortcutFaviconSnapshot,
      createShortcutDialogComponent,
      setSaveResult: (saved) => { deps.saveResult = saved; },
      snapshots: () => newtabShortcutFavicons,
      deleteShortcut: () => { newtabShortcuts = []; }
    };
  `);
  deps.iconSource = options.iconSource;
  return { ...factory(deps, faviconUtils, shortcutFavicon, shortcutsStore, pageUrl), writes, messages };
}

async function run() {
  const page = 'https://developer.chrome.com/docs/extensions/?view=read#intro';
  const normalizedPage = shortcutFavicon.normalizePageUrl(page);

  const pageKey = faviconUtils.getFaviconPersistCacheKey(page);
  const urlKey = faviconCache.DEFAULTS.faviconPersistStorageKey;
  const dataKey = faviconCache.DEFAULTS.faviconDataPersistStorageKey;
  const sharedBytes = `data:image/png;base64,${png(32, 99).toString('base64')}`;
  for (const version of [1, 2, 3]) {
    const values = {
      [urlKey]: { version, entries: { [pageKey]: { url: 'https://t2.gstatic.cn/faviconV2', updatedAt: Date.now() } } },
      [dataKey]: { version, entries: { [pageKey]: { dataUrl: sharedBytes, updatedAt: Date.now() },
        'settings': { dataUrl: sharedBytes, updatedAt: Date.now() } } }
    };
    const writes = [];
    const cache = faviconCache.createFaviconCache({
      storageArea: { get(keys, callback) { callback(values); }, set(payload) { Object.assign(values, payload); } },
      windowObj: { setTimeout(callback) { writes.push(callback); return writes.length; }, clearTimeout() {} }
    });
    await cache.ensureCachesReady();
    assert.strictEqual(Boolean(cache.getPersistedDataEntry(pageKey)), version === 3,
      'shared page image bytes from the old host-fallback policy must be reacquired');
    assert.strictEqual(Boolean(cache.getPersistedEntry(pageKey)), version === 3,
      'old shared page URL caches must not bypass the corrected resolver');
    assert.strictEqual(cache.getPersistedDataEntry('settings').dataUrl, sharedBytes,
      'non-web-page caches survive the policy migration');
    cache.setPersistedData(pageKey, sharedBytes);
    cache.setPersistedUrl(pageKey, 'https://t2.gstatic.cn/faviconV2');
    writes.forEach((write) => write());
    assert.strictEqual(values[dataKey].version, 3);
    assert.strictEqual(values[urlKey].version, 3);
  }

  const enabled = createAcquisition();
  const proxyResult = await enabled.fetchShortcutFaviconData(page, '', '', false, 'service');
  assert.strictEqual(new URL(proxyResult.sourceUrl).searchParams.get('url'), normalizedPage);
  assert.strictEqual(enabled.state.calls.length, 1, 'an explicit service source should contact only the service');
  enabled.state.proxyImage = png(128, 9);
  assert.deepStrictEqual(await enabled.fetchShortcutFaviconData(page, '', '', false, 'service'), proxyResult,
    'ordinary reads should retain the previously acquired icon');
  const refreshedProxy = await enabled.fetchShortcutFaviconData(page, '', '', true, 'service');
  assert.notStrictEqual(refreshedProxy.data, proxyResult.data, 'manual refresh must bypass the background memory cache');
  assert.strictEqual(enabled.state.calls[1].options.cache, 'reload', 'manual refresh must revalidate the HTTP icon cache');

  const small = createAcquisition({ proxyImage: png(32) });
  assert.strictEqual((await small.fetchShortcutFaviconData(page, '', '', false, 'service')).width, 32,
    'valid small proxy artwork must not disappear solely because it is below 128px');

  const explicit = createAcquisition();
  const cacheOnly = await explicit.fetchShortcutFaviconData(page, '', '', false, 'cache');
  assert.ok(cacheOnly.sourceUrl.startsWith('chrome-extension:'), 'explicit browser source must use the local endpoint');
  assert.ok(explicit.state.calls.every((call) => call.url.startsWith('chrome-extension:')));
  assert.strictEqual(new URL(cacheOnly.sourceUrl).searchParams.get('pageUrl'), normalizedPage);
  explicit.state.calls.length = 0;
  const serviceOnly = await explicit.fetchShortcutFaviconData(page, '', '', false, 'service');
  assert.ok(faviconUtils.isFaviconProxyUrl(serviceOnly.sourceUrl), 'source-specific caches must not return browser artwork for service mode');
  assert.ok(explicit.state.calls.every((call) => faviconUtils.isFaviconProxyUrl(call.url)));
  explicit.state.calls.length = 0;
  explicit.state.proxyImage = png(128, 25);
  const faviconIsOnly = await explicit.fetchShortcutFaviconData(page, '', '', false, 'favicon-is');
  assert.ok(faviconUtils.isFaviconIsUrl(faviconIsOnly.sourceUrl));
  assert.notStrictEqual(faviconIsOnly.data, serviceOnly.data, 'Favicon.is must not reuse the Gstatic memory cache');
  assert.ok(explicit.state.calls.every((call) => faviconUtils.isFaviconIsUrl(call.url)),
    'an explicit Favicon.is source must contact only that provider, including its placeholder probe');
  assert.strictEqual(new URL(faviconIsOnly.sourceUrl).pathname, '/developer.chrome.com');
  assert.strictEqual(new URL(faviconIsOnly.sourceUrl).search, '?larger=true', 'send only the hostname and size preference');
  assert.strictEqual(shortcutFavicon.getCachedIconSource(faviconIsOnly), 'favicon-is');
  assert.ok(shortcutFavicon.isCachedIconForPage(faviconIsOnly, normalizedPage));
  assert.strictEqual(shortcutFavicon.isCachedIconForPage(faviconIsOnly, 'https://other.chrome.com/docs/'), false);
  const faviconIsFrontend = createFrontend(createAcquisition(), normalizedPage, { iconSource: 'favicon-is' });
  assert.ok(await faviconIsFrontend.resolveShortcutFaviconDataUrl(page));
  assert.strictEqual(faviconIsFrontend.messages[0].iconSource, 'favicon-is');
  const faviconIsDraft = await faviconIsFrontend.refreshShortcutDialogOnlineIcon(page, 'favicon-is');
  assert.ok(faviconUtils.isFaviconIsUrl(faviconIsDraft.sourceUrl));
  assert.strictEqual(faviconIsFrontend.messages[1].iconSource, 'favicon-is');
  const faviconIsRestart = createFrontend(createAcquisition(), normalizedPage, {
    iconSource: 'favicon-is', initialSnapshots: faviconIsFrontend.snapshots()
  });
  assert.strictEqual(await faviconIsRestart.resolveShortcutFaviconDataUrl(page), faviconIsFrontend.snapshots()[normalizedPage].dataUrl);
  assert.strictEqual(faviconIsRestart.messages.length, 0, 'the selected Favicon.is snapshot must survive a restart');
  for (const proxyMode of ['error', 'timeout']) {
    const unavailableFaviconIs = createAcquisition({ proxyMode });
    assert.strictEqual(await unavailableFaviconIs.fetchShortcutFaviconData(page, '', '', true, 'favicon-is'), null);
    assert.ok(unavailableFaviconIs.state.calls.every((call) => faviconUtils.isFaviconIsUrl(call.url)),
      'Favicon.is failures must not silently fall back to another source');
  }
  const largeFaviconIsPlaceholder = createAcquisition({ proxyImage: png(128, 0), placeholderImage: png(128, 0) });
  assert.strictEqual(await largeFaviconIsPlaceholder.fetchShortcutFaviconData(page, '', '', false, 'favicon-is'), null,
    'Favicon.is placeholders must be rejected even when returned at the requested large size');
  for (const options of [{ excluded: true }, { enhanced: false, excluded: true }, { hardBlocked: true }]) {
    const blockedFaviconIs = createAcquisition(options);
    assert.strictEqual(await blockedFaviconIs.fetchShortcutFaviconData(page, '', '', false, 'favicon-is'), null);
    assert.strictEqual(blockedFaviconIs.state.calls.length, 0, 'Favicon.is must respect the existing fetch policy');
  }
  for (const iconSource of ['service', 'favicon-is']) {
    const disabledService = createAcquisition({ enhanced: false });
    const result = await disabledService.fetchShortcutFaviconData(page, '', '', false, iconSource);
    assert.ok(result && result.data.startsWith('data:image/png;base64,'),
      `${iconSource} must remain available with enhanced fetching disabled`);
    assert.ok(disabledService.state.calls.every((call) => faviconUtils.isFaviconProxyUrl(call.url)),
      'only approved service URLs may be requested');
  }
  const disabledFallback = createAcquisition({ enhanced: false, browserImage: null });
  assert.ok((await disabledFallback.fetchShortcutFaviconData(page)).sourceUrl.startsWith('https://t2.gstatic.cn/'),
    'automatic shortcuts should fall back to the service when Chrome has no image, even with enhanced fetching disabled');
  explicit.state.calls.length = 0;
  explicit.state.proxyMode = 'error';
  assert.strictEqual(await explicit.fetchShortcutFaviconData(page, '', '', true, 'service'), null,
    'explicit service mode must report failure without silently using browser cache');
  assert.ok(explicit.state.calls.every((call) => faviconUtils.isFaviconProxyUrl(call.url)));
  const cacheFrontend = createFrontend(createAcquisition(), normalizedPage, { iconSource: 'cache' });
  assert.ok(await cacheFrontend.resolveShortcutFaviconDataUrl(page));
  assert.strictEqual(cacheFrontend.messages[0].iconSource, 'cache', 'stored source must control automatic acquisition');
  const selectedDraft = await cacheFrontend.refreshShortcutDialogOnlineIcon(page, 'service');
  assert.ok(faviconUtils.isFaviconProxyUrl(selectedDraft.sourceUrl));
  assert.strictEqual(cacheFrontend.messages[1].iconSource, 'service', 'dialog must forward the selected refresh source');

  const githubPage = 'https://github.com/kubai087/lumno-extension';
  const builtinAcquisition = createAcquisition();
  const builtinFrontend = createFrontend(builtinAcquisition, githubPage, {
    iconSource: 'builtin',
    initialSnapshots: shortcutFavicon.setCachedIcon({}, githubPage,
      `data:image/png;base64,${png(64, 7).toString('base64')}`, 'https://t2.gstatic.cn/faviconV2')
  });
  assert.strictEqual(await builtinFrontend.resolveShortcutFaviconDataUrl(githubPage), '',
    'built-in mode must ignore previous remote artwork and skip automatic acquisition');
  assert.deepStrictEqual(builtinFrontend.messages, []);
  assert.deepStrictEqual(builtinAcquisition.state.calls, []);
  const builtinDialog = builtinFrontend.createShortcutDialogComponent();
  const builtinUrl = 'chrome-extension://test/' + shortcutFavicon.getBundledShortcutIconAssetPath(
    githubPage, searchUtils.getDefaultSiteSearchProviders()
  );
  assert.strictEqual(builtinDialog.getBuiltinIconUrl(githubPage), builtinUrl);
  assert.strictEqual(builtinFrontend.getShortcutDialogOnlineIconUrl(githubPage), builtinUrl,
    'built-in artwork must replace a stale online snapshot on the shortcut surface');
  assert.strictEqual(builtinDialog.getBuiltinIconUrl('https://www.github.com/'), builtinUrl);
  for (const unsupported of ['https://github.com.evil.test/', 'https://not-supported.test/', 'chrome://settings/']) {
    assert.strictEqual(builtinDialog.getBuiltinIconUrl(unsupported), '', 'eligibility must match a packaged exact host');
  }
  const orphanedPage = 'https://not-supported.test/';
  const orphanedAcquisition = createAcquisition();
  const orphanedBuiltin = createFrontend(orphanedAcquisition, orphanedPage, { iconSource: 'builtin' });
  await orphanedBuiltin.resolveShortcutFaviconDataUrl(orphanedPage);
  assert.ok(orphanedBuiltin.messages.length > 0,
    'a built-in choice without packaged artwork must fall back to automatic acquisition');
  const legacyBuiltin = createFrontend(createAcquisition(), githubPage).createShortcutDialogComponent();
  assert.strictEqual(legacyBuiltin.getOnlineIconSource(githubPage), 'cache',
    'automatic path-specific shortcuts must not silently select host-wide bundled artwork');

  for (const proxyMode of ['error', 'timeout']) {
    const unavailable = createAcquisition({ proxyMode });
    const result = await unavailable.fetchShortcutFaviconData(page);
    assert.ok(result.sourceUrl.startsWith('chrome-extension://test/_favicon/'),
      `${proxyMode} should not affect an available exact-page browser snapshot`);
    assert.strictEqual(result.width, 32);
    assert.ok(unavailable.state.calls.every((call) => call.url.startsWith('chrome-extension:')),
      'an exact-page browser icon should prevent unnecessary third-party requests');
  }

  const strict = createAcquisition({ enhanced: false });
  const strictFrontend = createFrontend(strict, normalizedPage);
  const browserSnapshot = await strictFrontend.resolveShortcutFaviconDataUrl(page);
  assert.ok(browserSnapshot.startsWith('data:image/png;base64,'), 'strict-mode shortcuts should retain Chrome artwork as local bytes');
  assert.ok(strict.state.calls.every((call) => call.url.startsWith('chrome-extension://test/_favicon/')),
    'strict-mode acquisition must not contact third-party services or website icon files');
  assert.strictEqual(strictFrontend.writes.length, 1, 'the snapshot should be saved once');
  strict.state.browserImage = png(32, 9);
  assert.strictEqual(await strictFrontend.resolveShortcutFaviconDataUrl(page), browserSnapshot,
    'a later Chrome cache change must not change the saved shortcut icon');
  assert.strictEqual(strictFrontend.messages.length, 1);
  const reopened = createFrontend(strict, normalizedPage, { initialSnapshots: strictFrontend.snapshots() });
  assert.strictEqual(await reopened.resolveShortcutFaviconDataUrl(page), browserSnapshot,
    'reopening New Tab must reuse the snapshot');
  assert.strictEqual(reopened.messages.length, 0);

  const draft = await strictFrontend.refreshShortcutDialogOnlineIcon(page);
  assert.notStrictEqual(draft.dataUrl, browserSnapshot, 'refresh should read current Chrome artwork');
  assert.strictEqual(strictFrontend.getShortcutDialogOnlineIconUrl(page), browserSnapshot,
    'refresh preview must leave the saved icon unchanged until Save');
  assert.strictEqual(strictFrontend.writes.length, 1, 'preview or cancellation must not persist new artwork');
  assert.strictEqual(strictFrontend.messages[1].refresh, true);
  const dialog = strictFrontend.createShortcutDialogComponent();
  const payload = { title: 'Example', url: page, itemType: 'shortcut', mode: 'edit',
    shortcutId: 'one', iconAction: 'keep', iconDataUrl: '', onlineIcon: draft };
  strictFrontend.setSaveResult(false);
  assert.strictEqual(await dialog.onSubmit(payload), false);
  assert.strictEqual(strictFrontend.getShortcutDialogOnlineIconUrl(page), browserSnapshot,
    'failed shortcut persistence must not replace the old snapshot');
  strictFrontend.setSaveResult(true);
  assert.strictEqual(await dialog.onSubmit(payload), true);
  assert.strictEqual(strictFrontend.getShortcutDialogOnlineIconUrl(page), draft.dataUrl,
    'saving a manual refresh should replace the fixed snapshot');
  assert.strictEqual(strictFrontend.saveShortcutFaviconSnapshot(normalizedPage, browserSnapshot, ''), draft.dataUrl,
    'an automatic response must not overwrite the manually saved snapshot');
  assert.ok(strict.state.calls.every((call) => call.url.startsWith('chrome-extension:')),
    'refresh in strict mode must still use only browser cache requests');

  const excluded = createAcquisition({ excluded: true });
  assert.ok((await excluded.fetchShortcutFaviconData(page)).sourceUrl.startsWith('chrome-extension://test/_favicon/'));
  assert.ok(excluded.state.calls.every((call) => call.url.startsWith('chrome-extension:')),
    'request exclusions should retain safe Chrome snapshot acquisition');

  const browserDefault = createAcquisition({ enhanced: false, browserImage: png(16, 0), proxyImage: null });
  assert.strictEqual(await browserDefault.fetchShortcutFaviconData(page), null, 'Chrome placeholder artwork must not be frozen as a real icon');
  browserDefault.state.browserImage = png(16, 8);
  assert.ok(await browserDefault.fetchShortcutFaviconData(page), 'a previous miss must retry when browser artwork becomes available');

  const proxyDefault = createAcquisition({ proxyImage: png(16, 0) });
  assert.strictEqual(await proxyDefault.fetchShortcutFaviconData(page, '', '', false, 'service'), null,
    'generic service placeholder artwork must not be saved');
  const malformed = createAcquisition({ proxyImage: Buffer.from('<html>not an icon</html>') });
  assert.strictEqual(await malformed.fetchShortcutFaviconData(page, '', '', false, 'service'), null,
    'invalid service responses must not be saved');
  const noBrowserIcon = createAcquisition({ browserImage: png(16, 0) });
  assert.ok((await noBrowserIcon.fetchShortcutFaviconData(page)).sourceUrl.startsWith('https:'),
    'a missing exact-page browser icon should try the full-page service request in enhanced mode');

  const pages = ['https://chrome.google.com/', 'https://chrome.google.com/webstore/devconsole?hl=zh-cn',
    'https://chrome.google.com/webstore/devconsole?hl=en', 'https://chrome.google.com/webstore/',
    'https://chrome.google.com/webstore', 'https://chrome.google.com/apps%2Fpreview'];
  const pathSpecific = createAcquisition({ pageImages: Object.fromEntries(pages.map((url, index) =>
    [url, { browser: png(32, index + 10), proxy: png(128, index + 20) }])) });
  for (const source of ['cache', 'service']) {
    const results = await Promise.all(pages.map((url) => pathSpecific.fetchShortcutFaviconData(url, '', '', false, source)));
    assert.strictEqual(new Set(results.map((result) => result.data)).size, pages.length,
      'same-host paths, query values, trailing slashes and encoded slashes retain separate artwork');
    for (let index = 0; index < pages.length; index += 1) {
      assert.strictEqual(new URL(results[index].sourceUrl).searchParams.get(source === 'cache' ? 'pageUrl' : 'url'), pages[index]);
    }
  }
  const webstore = pages[1];
  const oldRootSource = pathSpecific.resolver.getGstaticFaviconUrl(pages[0]);
  const oldBytes = `data:image/png;base64,${png(128, 88).toString('base64')}`;
  const oldRootSnapshot = createFrontend(pathSpecific, webstore, {
    initialSnapshots: shortcutFavicon.setCachedIcon({}, webstore, oldBytes, oldRootSource), iconSource: 'service'
  });
  assert.strictEqual(oldRootSnapshot.getShortcutDialogOnlineIconUrl(webstore), '',
    'an old root-page snapshot must not render as a path-specific icon');
  assert.strictEqual(oldRootSnapshot.getShortcutDialogOnlineIconSource(webstore), 'service',
    'reacquiring an invalid snapshot must preserve the user-selected source');
  assert.notStrictEqual(await oldRootSnapshot.resolveShortcutFaviconDataUrl(webstore), oldBytes,
    'an old wrong root-page snapshot is automatically replaced through an exact-page request');
  assert.strictEqual(oldRootSnapshot.messages.length, 1);
  const legacySnapshot = createFrontend(pathSpecific, webstore, {
    initialSnapshots: shortcutFavicon.setCachedIcon({}, webstore, oldBytes, ''), iconSource: 'cache'
  });
  assert.notStrictEqual(await legacySnapshot.resolveShortcutFaviconDataUrl(webstore), oldBytes,
    'a legacy browser snapshot without its source is reacquired once');
  const verifiedEntry = legacySnapshot.snapshots()[webstore];
  assert.strictEqual(new URL(verifiedEntry.sourceUrl).searchParams.get('fallbackToHost'), '0',
    'saving browser artwork preserves exact-page matching provenance');
  assert.strictEqual(shortcutFavicon.getCachedIconSource(verifiedEntry), 'cache');
  assert.strictEqual(legacySnapshot.getShortcutDialogOnlineIconSource(webstore), 'cache',
    'a local Chrome favicon endpoint must not be mislabeled as a third-party service');
  assert.notStrictEqual(legacySnapshot.getShortcutDialogOnlineIconUrl(webstore), '',
    'the newly verified browser snapshot remains usable');
  const rebound = createFrontend(pathSpecific, webstore, { initialSnapshots: legacySnapshot.snapshots(), iconSource: 'cache' });
  await rebound.resolveShortcutFaviconDataUrl(webstore);
  assert.strictEqual(rebound.messages.length, 0, 'a verified saved snapshot does not fetch again on reopening');
  const oldChromeFavicon2Snapshot = createFrontend(pathSpecific, webstore, {
    initialSnapshots: shortcutFavicon.setCachedIcon({}, webstore, oldBytes,
      `chrome://favicon2/?pageUrl=${encodeURIComponent(webstore)}&fallbackToHost=0`),
    iconSource: 'cache'
  });
  assert.strictEqual(oldChromeFavicon2Snapshot.getShortcutDialogOnlineIconUrl(webstore), '',
    'chrome://favicon2 snapshots are not proof of exact-page matching even with fallbackToHost=0');
  assert.notStrictEqual(await oldChromeFavicon2Snapshot.resolveShortcutFaviconDataUrl(webstore), oldBytes,
    'old chrome://favicon2 snapshots must be reacquired through the extension endpoint');

  const blocked = createAcquisition({ hardBlocked: true });
  assert.strictEqual(await blocked.fetchShortcutFaviconData(page), null);
  assert.strictEqual(blocked.state.calls.length, 0);

  const migratedData = `data:image/png;base64,${png(64, 6).toString('base64')}`;
  const migration = createAcquisition({ enhanced: false });
  const migrated = createFrontend(migration, normalizedPage, {
    persistedEntries: { [faviconUtils.getFaviconPersistCacheKey(page)]: { dataUrl: migratedData,
      sourceUrl: migration.resolver.getExtensionFaviconUrl(normalizedPage) } }
  });
  assert.strictEqual(await migrated.resolveShortcutFaviconDataUrl(page), migratedData,
    'existing image bytes with a verified exact-page source may migrate into the shortcut snapshot');
  assert.strictEqual(migrated.messages.length, 0, 'cache migration should make no new runtime icon request');
  assert.strictEqual(migrated.writes.length, 1);

  const legacyPageBytes = createFrontend(migration, normalizedPage, {
    persistedEntries: { [faviconUtils.getFaviconPersistCacheKey(page)]: { dataUrl: migratedData } }
  });
  assert.notStrictEqual(await legacyPageBytes.resolveShortcutFaviconDataUrl(page), migratedData,
    'legacy bytes without source provenance must not bypass the exact-page lookup');
  assert.strictEqual(legacyPageBytes.messages.length, 1);

  const isolated = createFrontend(migration, normalizedPage, {
    persistedEntries: { [faviconUtils.getFaviconPersistCacheKey('https://developer.chrome.com/another')]: { dataUrl: migratedData } }
  });
  assert.notStrictEqual(await isolated.resolveShortcutFaviconDataUrl(page), migratedData,
    'migration must not copy a different page icon on the same host');

  let finishCacheRead;
  const deleted = createFrontend(migration, normalizedPage, {
    ensureCachesReady: () => new Promise((resolve) => { finishCacheRead = resolve; })
  });
  const pending = deleted.resolveShortcutFaviconDataUrl(page);
  await new Promise((resolve) => setImmediate(resolve));
  deleted.deleteShortcut();
  finishCacheRead();
  assert.strictEqual(await pending, '', 'a removed shortcut must not trigger acquisition after cache loading');
  assert.strictEqual(deleted.messages.length, 0);

  console.log('Shortcut favicon acquisition, migration, and stable snapshot tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
