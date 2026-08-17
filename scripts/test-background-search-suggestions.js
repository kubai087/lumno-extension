const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const backgroundSourceForAssertions = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');

assert.ok(
  /searchBlacklistItems,\s*faviconRequestBlacklistItems,\s*_faviconEnhancedFetchEnabled,\s*searchSelectionStats\s*\]\s*=\s*await Promise\.all\([\s\S]*?loadSearchBlacklistItems\(\),\s*loadFaviconRequestBlacklistItems\(\),\s*loadFaviconEnhancedFetchEnabled\(\),\s*loadSearchSelectionStats\(\)/.test(backgroundSourceForAssertions),
  'background search suggestions should load favicon policy state before resolving suggestion favicons and keep Promise.all results aligned'
);

function createEvent() {
  return {
    addListener() {},
    removeListener() {},
    hasListener() {
      return false;
    }
  };
}

function createStorageArea(initialData, options) {
  const data = initialData || {};
  const config = options || {};
  return {
    get(keys, callback) {
      const result = {};
      const keyList = Array.isArray(keys)
        ? keys
        : (typeof keys === 'string' ? [keys] : Object.keys(keys || {}));
      keyList.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = data[key];
        }
      });
      const delay = keyList.includes('_x_extension_default_search_engine_2024_unique_')
        ? Number(config.defaultSearchEngineLoadDelayMs) || 0
        : 0;
      setTimeout(() => callback(result), delay);
    },
    set(items, callback) {
      Object.assign(data, items || {});
      if (callback) {
        setTimeout(callback, 0);
      }
    },
    remove(keys, callback) {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        delete data[key];
      });
      if (callback) {
        setTimeout(callback, 0);
      }
    }
  };
}

function createChromeStub(options) {
  const config = options || {};
  const messageListeners = [];
  const storageArea = createStorageArea(config.initialSyncData || {}, {
    defaultSearchEngineLoadDelayMs: config.defaultSearchEngineLoadDelayMs
  });
  const now = Date.now();
  const openTabs = [
    {
      id: 25,
      windowId: 1,
      title: 'Digital Experience Testing Cloud | TestMu AI (Formerly LambdaTest) Enterprise Cloud',
      url: 'https://app.testmu.com/enterprise-cloud'
    },
    {
      id: 26,
      windowId: 1,
      title: '小红书 - 你的生活兴趣社区',
      url: 'https://www.xiaohongshu.com/explore/6a4dcb39000000001'
    }
  ];
  const historyItems = [
    {
      title: 'GitHub',
      url: 'https://github.com/',
      visitCount: 18,
      typedCount: 4,
      lastVisitTime: now - 1000
    },
    {
      title: 'GitHub Lumno Repo',
      url: 'https://github.com/kubai087/lumno-extension',
      visitCount: 7,
      typedCount: 1,
      lastVisitTime: now - 2000
    },
    {
      title: '小红书',
      url: 'https://mall.xiaohongshu.com/finance/cashier/web',
      visitCount: 80,
      typedCount: 4,
      lastVisitTime: now - 500
    },
    {
      title: '小红书 - 你的生活兴趣社区',
      url: 'https://www.xiaohongshu.com/explore?channel_id=homefeed',
      visitCount: 40,
      typedCount: 2,
      lastVisitTime: now - 1000
    },
    {
      title: '小红书创作服务平台',
      url: 'https://creator.xiaohongshu.com/',
      visitCount: 20,
      typedCount: 1,
      lastVisitTime: now - 1500
    },
    {
      title: '小红书 - 你的生活兴趣社区',
      url: 'https://www.xiaohongshu.com/explore/6a4dcb39000000001',
      visitCount: 30,
      typedCount: 1,
      lastVisitTime: now - 2000
    },
    {
      title: 'Example',
      url: 'https://example.com/',
      visitCount: 1,
      typedCount: 0,
      lastVisitTime: now - 3000
    },
    {
      title: '微信读书',
      url: 'https://weread.qq.com/',
      visitCount: 4,
      typedCount: 0,
      lastVisitTime: now - 5000
    },
    {
      title: 'Codex workspace',
      url: 'https://example.com/codex-only',
      visitCount: 2,
      typedCount: 0,
      lastVisitTime: now - 6000
    },
    {
      title: 'Codex 最爱 workspace',
      url: 'https://example.com/codex-favorite',
      visitCount: 2,
      typedCount: 0,
      lastVisitTime: now - 7000
    },
    {
      title: 'Home - 0HTTP',
      url: 'https://code.0http.com/',
      visitCount: 2,
      typedCount: 0,
      lastVisitTime: now - 8000
    }
  ].concat(
    Array.from({ length: 260 }, (_, index) => ({
      title: `Filler History ${index + 1}`,
      url: `https://filler.example.com/${index + 1}`,
      visitCount: 1,
      typedCount: 0,
      lastVisitTime: now - 10_000 - index
    })),
    [{
      title: 'Final Cut Camera',
      url: 'https://apps.apple.com/final-cut-camera',
      visitCount: 3,
      typedCount: 0,
      lastVisitTime: now - 20_000
    }]
  );
  const topSiteItems = [
    { title: 'GitHub', url: 'https://github.com/' },
    {
      title: 'Lumno | 浏览器命令栏、聚焦搜索与极简新标签页',
      url: 'http://127.0.0.1:4321/'
    }
  ];

  const chromeApi = {
    runtime: {
      id: 'abc',
      lastError: null,
      getURL(relativePath) {
        return path.join(repoRoot, relativePath);
      },
      getManifest() {
        return { version: '0.9.22' };
      },
      onMessage: {
        addListener(listener) {
          messageListeners.push(listener);
        }
      },
      onInstalled: createEvent(),
      onStartup: createEvent(),
      onConnect: createEvent(),
      setUninstallURL(_url, callback) {
        if (callback) {
          callback();
        }
      },
      openOptionsPage(callback) {
        if (callback) {
          callback();
        }
      }
    },
    storage: {
      sync: storageArea,
      local: createStorageArea({}),
      onChanged: createEvent()
    },
    history: {
      search(options, callback) {
        const text = String(options && options.text || '').toLowerCase();
        const startTime = Number(options && options.startTime) || 0;
        const maxResults = Math.max(0, Math.floor(Number(options && options.maxResults) || historyItems.length));
        const items = (text
          ? historyItems.filter((item) => (
              item.title.toLowerCase().includes(text) ||
              item.url.toLowerCase().includes(text)
            ))
          : historyItems)
          .filter((item) => (Number(item.lastVisitTime) || 0) >= startTime)
          .slice(0, maxResults);
        const delay = text
          ? Number(config.historySearchDelayMs) || 0
          : Number(config.historyFallbackSearchDelayMs) || 0;
        setTimeout(() => callback(items), delay);
      },
      deleteUrl(options, callback) {
        const targetUrl = String(options && options.url || '');
        for (let index = historyItems.length - 1; index >= 0; index -= 1) {
          if (historyItems[index] && historyItems[index].url === targetUrl) {
            historyItems.splice(index, 1);
          }
        }
        for (let index = topSiteItems.length - 1; index >= 0; index -= 1) {
          if (topSiteItems[index] && topSiteItems[index].url === targetUrl) {
            topSiteItems.splice(index, 1);
          }
        }
        if (callback) {
          callback();
        }
      },
      onVisited: createEvent(),
      onVisitRemoved: createEvent()
    },
    topSites: {
      get(callback) {
        setTimeout(() => callback(topSiteItems.slice()), 0);
      }
    },
    bookmarks: {
      search(_options, callback) {
        setTimeout(() => callback([
          {
            id: '10',
            parentId: '1',
            title: 'GitHub Bookmark',
            url: 'https://github.com/notifications'
          }
        ]), 0);
      },
      getTree(callback) {
        setTimeout(() => callback([
          {
            id: '0',
            title: '',
            children: [
              {
                id: '1',
                parentId: '0',
                title: 'Bookmarks bar',
                children: [
                  {
                    id: '10',
                    parentId: '1',
                    title: 'GitHub Bookmark',
                    url: 'https://github.com/notifications'
                  }
                ]
              }
            ]
          }
        ]), Number(config.bookmarkTreeDelayMs) || 0);
      },
      onCreated: createEvent(),
      onRemoved: createEvent(),
      onChanged: createEvent(),
      onMoved: createEvent(),
      onChildrenReordered: createEvent(),
      onImportEnded: createEvent()
    },
    tabs: {
      query(_options, callback) {
        setTimeout(() => callback(openTabs), 0);
      },
      create(options, callback) {
        if (callback) {
          setTimeout(() => callback({ id: 1, windowId: 1, url: options && options.url || '' }), 0);
        }
      },
      update(tabId, options, callback) {
        if (callback) {
          setTimeout(() => callback({ id: tabId, windowId: 1, url: options && options.url || '' }), 0);
        }
      },
      sendMessage(_tabId, _message, callback) {
        if (callback) {
          setTimeout(() => callback({ ok: true }), 0);
        }
      },
      remove(_tabIds, callback) {
        if (callback) {
          callback();
        }
      },
      captureVisibleTab(_windowId, _options, callback) {
        if (callback) {
          callback('');
        }
      },
      onCreated: createEvent(),
      onUpdated: createEvent(),
      onRemoved: createEvent(),
      onActivated: createEvent(),
      onReplaced: createEvent(),
      onMoved: createEvent(),
      onAttached: createEvent(),
      onDetached: createEvent()
    },
    windows: {
      update(windowId, _options, callback) {
        if (callback) {
          callback({ id: windowId });
        }
      },
      getCurrent(callback) {
        callback({ id: 1 });
      },
      onFocusChanged: createEvent(),
      WINDOW_ID_NONE: -1
    },
    commands: {
      getAll(callback) {
        callback([]);
      },
      onCommand: createEvent()
    },
    action: {
      onClicked: createEvent(),
      setIcon(_options, callback) {
        if (callback) {
          callback();
        }
      },
      setTitle(_options, callback) {
        if (callback) {
          callback();
        }
      }
    },
    alarms: {
      create() {},
      clear(_name, callback) {
        if (callback) {
          callback(true);
        }
      },
      onAlarm: createEvent()
    },
    scripting: {
      executeScript(_options, callback) {
        if (callback) {
          callback([]);
        }
      },
      insertCSS(_options, callback) {
        if (callback) {
          callback();
        }
      }
    },
    search: {
      query(_options, callback) {
        if (callback) {
          callback();
        }
      }
    },
    permissions: {
      contains(_options, callback) {
        callback(true);
      }
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1
    }
  };

  return { chromeApi, messageListeners };
}

function loadBackgroundForTest(options) {
  const config = options || {};
  const { chromeApi, messageListeners } = createChromeStub(config);
  const context = vm.createContext({
    console,
    chrome: chromeApi,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    Blob,
    AbortController,
    navigator: { userAgent: 'Fake Chrome' },
    fetch: config.fetch || (async () => {
      throw new Error('network disabled in background search test');
    })
  });
  context.globalThis = context;
  context.importScripts = (...urls) => {
    urls.forEach((url) => {
      vm.runInContext(fs.readFileSync(String(url), 'utf8'), context, {
        filename: String(url)
      });
    });
  };

  const backgroundSource = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8') +
    '\nglobalThis.__testGetSearchSuggestions = getSearchSuggestions;\n' +
    'globalThis.__testSetDefaultSearchEngineState = setDefaultSearchEngineState;\n' +
    'globalThis.__testGetSearchEngineSuggestions = typeof getSearchEngineSuggestions === "function" ? getSearchEngineSuggestions : null;\n';
  vm.runInContext(backgroundSource, context, {
    filename: 'src/background/background.js'
  });
  return { context, messageListeners };
}

function sendBackgroundMessage(messageListeners, request, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(response);
    };
    messageListeners.forEach((listener) => {
      listener(request, {}, finish);
    });
    setTimeout(() => finish(null), Number(timeoutMs) > 0 ? Number(timeoutMs) : 20);
  });
}

async function run() {
  let abortedRemoteRequestCount = 0;
  let timedOutRemoteRequestCount = 0;
  let delayedKeywordFetchCount = 0;
  const { context, messageListeners } = loadBackgroundForTest({
    fetch: async (url, fetchOptions) => {
      const parsedUrl = new URL(String(url));
      if (
        parsedUrl.hostname === 'suggestqueries.google.com' &&
        parsedUrl.searchParams.get('q') === 'slow-abort'
      ) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({
            ok: true,
            json: async () => ['slow-abort', ['slow-abort result']]
          }), 500);
          const signal = fetchOptions && fetchOptions.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              abortedRemoteRequestCount += 1;
              reject(new Error('aborted'));
            }, { once: true });
          }
        });
      }
      if (
        parsedUrl.hostname === 'suggestqueries.google.com' &&
        parsedUrl.searchParams.get('q') === 'fast-replacement'
      ) {
        return {
          ok: true,
          json: async () => ['fast-replacement', ['fast replacement result']]
        };
      }
      if (
        parsedUrl.hostname === 'suggestqueries.google.com' &&
        parsedUrl.searchParams.get('q') === 'timeout-abort'
      ) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({
            ok: true,
            json: async () => ['timeout-abort', ['late result']]
          }), 1100);
          const signal = fetchOptions && fetchOptions.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              timedOutRemoteRequestCount += 1;
              reject(new Error('timed out'));
            }, { once: true });
          }
        });
      }
      if (
        parsedUrl.hostname === 'suggestqueries.google.com' &&
        parsedUrl.searchParams.get('q') === '什么东西'
      ) {
        delayedKeywordFetchCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 240));
        return {
          ok: true,
          json: async () => [
            '什么东西',
            [
              '什么东西',
              '什么东西补血',
              '什么东西解酒',
              '什么东西补钙',
              '什么东西补铁',
              '什么东西越剪越大',
              '什么东西养胃',
              '什么东西化痰'
            ]
          ]
        };
      }
      if (
        parsedUrl.hostname === 'suggestqueries.google.com' &&
        parsedUrl.searchParams.get('q') === 'github'
      ) {
        return {
          ok: true,
          json: async () => [
            'github',
            [
              'github',
              'github login',
              'github desktop',
              'github copilot',
              'github actions'
            ]
          ]
        };
      }
      if (
        parsedUrl.hostname === 'suggestqueries.google.com' &&
        parsedUrl.searchParams.get('q') === '小红书'
      ) {
        return {
          ok: true,
          json: async () => [
            '小红书',
            [
              '小红书薯币购买',
              '小红书薯条购买',
              '小红书网页版'
            ]
          ]
        };
      }
      throw new Error('network disabled in background search test');
    }
  });

  const bookmarkOnlySuggestions = await context.__testGetSearchSuggestions('github', {
    sourceTypes: ['bookmark'],
    includeOpenTabs: false
  });
  assert.ok(
    bookmarkOnlySuggestions.length > 0 &&
      bookmarkOnlySuggestions.every((item) => item && item.type === 'bookmark'),
    'request-scoped bookmark search should not mix history, top sites, or open tabs'
  );

  const historyOnlySuggestions = await context.__testGetSearchSuggestions('github', {
    sourceTypes: ['history'],
    includeOpenTabs: false
  });
  assert.ok(
    historyOnlySuggestions.length > 0 &&
      historyOnlySuggestions.every((item) => item && item.type === 'history'),
    'request-scoped history search should only return history suggestions'
  );

  const topSiteOnlyResponse = await sendBackgroundMessage(messageListeners, {
    action: 'getSearchSuggestions',
    query: 'github',
    sourceTypes: ['topSite'],
    includeOpenTabs: false
  }, 1000);
  assert.ok(
    topSiteOnlyResponse &&
      topSiteOnlyResponse.suggestions.length > 0 &&
      topSiteOnlyResponse.suggestions.every((item) => item && item.type === 'topSite'),
    'message-scoped frequent-site search should only return top-site suggestions'
  );
  assert.strictEqual(
    typeof context.__testGetSearchSuggestions,
    'function',
    'background search function should be exposed in the test harness'
  );
  assert.strictEqual(
    typeof context.__testSetDefaultSearchEngineState,
    'function',
    'background search engine state setter should be exposed in the test harness'
  );

  const suggestions = await context.__testGetSearchSuggestions('github');
  assert.ok(
    suggestions.some((item) => item && item.url === 'https://github.com/'),
    'background search suggestions should include local browser results instead of returning only the frontend search action'
  );
  assert.ok(
    suggestions.some((item) => item && (item.type === 'bookmark' || item.type === 'history' || item.type === 'topSite')),
    'background search suggestions should include at least one enabled local source type'
  );

  const xiaohongshuLocalSuggestions = await context.__testGetSearchSuggestions('小红书');
  assert.strictEqual(
    xiaohongshuLocalSuggestions[0] && xiaohongshuLocalSuggestions[0].url,
    'https://www.xiaohongshu.com/',
    'a configured brand alias should produce a stable official representative ahead of deep history pages'
  );
  assert.ok(
    xiaohongshuLocalSuggestions.filter((item) => {
      try {
        return new URL(item.url).hostname.endsWith('xiaohongshu.com');
      } catch (error) {
        return false;
      }
    }).length <= 3,
    'one brand family should not occupy more than three local result slots for a pure brand query'
  );
  assert.notStrictEqual(
    xiaohongshuLocalSuggestions[0] && xiaohongshuLocalSuggestions[0].url,
    'https://mall.xiaohongshu.com/finance/cashier/web',
    'a frequently visited cashier page should not take over the pure brand query'
  );
  assert.ok(
    xiaohongshuLocalSuggestions.some((item) => item && item._xMatchedTabId === 26),
    'brand-family composition should retain one already-open matching tab'
  );

  const multiTermSuggestions = await context.__testGetSearchSuggestions('codex 最爱', {
    sourceTypes: ['history'],
    includeOpenTabs: false
  });
  assert.deepStrictEqual(
    Array.from(multiTermSuggestions, (item) => item && item.url),
    ['https://example.com/codex-favorite'],
    'background search should require every query term instead of backfilling history that only matches one term'
  );

  const dottedNavigationSuggestions = await context.__testGetSearchSuggestions('code.0', {
    includeOpenTabs: false
  });
  assert.ok(
    dottedNavigationSuggestions.some((item) => item && item.url === 'https://code.0http.com/'),
    'dotted navigation queries should retain the history result whose host matches the full input'
  );
  assert.ok(
    !dottedNavigationSuggestions.some((item) => item && item.url === 'http://127.0.0.1:4321/'),
    'dotted navigation queries should exclude top sites that match only one token from the input'
  );

  const noMatchSuggestions = await context.__testGetSearchSuggestions('definitely-no-local-match-xyz');
  assert.strictEqual(
    noMatchSuggestions.length,
    0,
    'background search suggestions should not backfill unrelated top sites when nothing matches'
  );

  context.__testSetDefaultSearchEngineState({
    id: 'google',
    name: 'Google',
    host: 'www.google.com',
    searchTemplate: 'https://www.google.com/search?q={query}'
  }, false);
  const mixedLocalSuggestions = await context.__testGetSearchSuggestions('github');
  assert.strictEqual(
    mixedLocalSuggestions.filter((item) => item && item.type === 'googleSuggest').length,
    0,
    'the local background request should not include search-engine suggestions'
  );
  const mergedMixedSuggestions = await context.__testGetSearchEngineSuggestions(
    'github',
    mixedLocalSuggestions,
    { context: 'newtab' }
  );
  const firstMixedEngineSuggestionIndex = mergedMixedSuggestions.findIndex((item) => item && item.type === 'googleSuggest');
  const firstMixedLocalSuggestionIndex = mergedMixedSuggestions.findIndex((item) => item && item.type !== 'googleSuggest');
  assert.strictEqual(
    mergedMixedSuggestions.filter((item) => item && item.type === 'googleSuggest').length,
    3,
    'the remote merge should keep up to three search-engine suggestions when local results exist'
  );
  const mergedMixedUrls = new Set(
    mergedMixedSuggestions
      .filter((item) => item && item.type !== 'googleSuggest')
      .map((item) => item.url)
  );
  mixedLocalSuggestions.forEach((item) => {
    assert.ok(
      mergedMixedUrls.has(item.url),
      `the remote merge should preserve local result ${item.url}`
    );
  });
  assert.ok(
    firstMixedLocalSuggestionIndex >= 0 && firstMixedEngineSuggestionIndex > firstMixedLocalSuggestionIndex,
    'the remote merge should keep local results ahead of a supplemental search-engine suggestion'
  );
  const lastMixedLocalSuggestionIndex = mergedMixedSuggestions.reduce((lastIndex, item, index) => (
    item && item.type !== 'googleSuggest' ? index : lastIndex
  ), -1);
  assert.ok(
    firstMixedEngineSuggestionIndex > lastMixedLocalSuggestionIndex,
    'the remote merge should keep webpage results contiguous before search-engine suggestions'
  );
  const mergedXiaohongshuSuggestions = await context.__testGetSearchEngineSuggestions(
    '小红书',
    xiaohongshuLocalSuggestions,
    { context: 'newtab' }
  );
  assert.strictEqual(
    mergedXiaohongshuSuggestions[1] && mergedXiaohongshuSuggestions[1]._xMatchedTabId,
    26,
    'brand result composition should keep an already-open matching tab near the top'
  );
  assert.strictEqual(
    mergedXiaohongshuSuggestions[0] && mergedXiaohongshuSuggestions[0].url,
    'https://www.xiaohongshu.com/',
    'reserving a search-suggestion slot should keep the official brand representative first'
  );
  const firstXiaohongshuEngineIndex = mergedXiaohongshuSuggestions.findIndex((item) => (
    item && item.type === 'googleSuggest'
  ));
  const lastXiaohongshuLocalIndex = mergedXiaohongshuSuggestions.reduce((lastIndex, item, index) => (
    item && item.type !== 'googleSuggest' ? index : lastIndex
  ), -1);
  assert.ok(
    firstXiaohongshuEngineIndex > lastXiaohongshuLocalIndex,
    'brand result composition should place all webpages before the contiguous search-suggestion block'
  );
  const localKeywordSuggestions = await context.__testGetSearchSuggestions('什么东西');
  assert.strictEqual(
    delayedKeywordFetchCount,
    0,
    'the local background request should not start the delayed search-engine fetch'
  );
  assert.ok(
    localKeywordSuggestions.every((item) => item && item.type !== 'googleSuggest'),
    'the local background request should stay browser-local even when a search engine is configured'
  );
  assert.strictEqual(
    typeof context.__testGetSearchEngineSuggestions,
    'function',
    'background search should expose a separate remote suggestion function'
  );
  const mergedKeywordSuggestions = await context.__testGetSearchEngineSuggestions(
    '什么东西',
    localKeywordSuggestions,
    { context: 'newtab' }
  );
  assert.strictEqual(
    delayedKeywordFetchCount,
    1,
    'the separate remote request should start the delayed search-engine fetch exactly once'
  );
  const engineKeywordTitles = mergedKeywordSuggestions
    .filter((item) => item && item.type === 'googleSuggest')
    .map((item) => item.title);
  assert.ok(
    engineKeywordTitles.length > 1 && engineKeywordTitles.length <= 5,
    'background search suggestions should keep several delayed search-engine keyword suggestions within the visible cap'
  );
  assert.deepStrictEqual(
    Array.from(engineKeywordTitles),
    ['什么东西补血', '什么东西解酒', '什么东西补钙', '什么东西补铁', '什么东西越剪越大'],
    'background search suggestions should preserve search-engine keyword suggestion ordering after removing the exact query'
  );

  const slowRemoteResponsePromise = sendBackgroundMessage(messageListeners, {
    action: 'getSearchEngineSuggestions',
    query: 'slow-abort',
    context: 'overlay',
    localSuggestions: []
  }, 1200);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const replacementRemoteResponse = await sendBackgroundMessage(messageListeners, {
    action: 'getSearchEngineSuggestions',
    query: 'fast-replacement',
    context: 'overlay',
    localSuggestions: []
  }, 1200);
  const slowRemoteResponse = await slowRemoteResponsePromise;
  assert.strictEqual(
    abortedRemoteRequestCount,
    1,
    'a newer remote suggestion request should abort the previous fetch for the same client context'
  );
  assert.strictEqual(
    slowRemoteResponse && slowRemoteResponse.aborted,
    true,
    'the superseded remote suggestion response should be marked aborted'
  );
  assert.ok(
    replacementRemoteResponse &&
      replacementRemoteResponse.aborted === false &&
      replacementRemoteResponse.hasRemoteSuggestions === true &&
      replacementRemoteResponse.suggestions.some((item) => item && item.type === 'googleSuggest'),
    'the replacement remote suggestion request should complete normally'
  );
  const emptyRemoteResponse = await sendBackgroundMessage(messageListeners, {
    action: 'getSearchEngineSuggestions',
    query: 'no-remote-results',
    context: 'newtab',
    localSuggestions: mixedLocalSuggestions
  }, 1200);
  assert.strictEqual(
    emptyRemoteResponse && emptyRemoteResponse.hasRemoteSuggestions,
    false,
    'an empty remote response should tell clients to preserve the current local render'
  );
  const timedOutRemoteResponse = await sendBackgroundMessage(messageListeners, {
    action: 'getSearchEngineSuggestions',
    query: 'timeout-abort',
    context: 'newtab',
    localSuggestions: mixedLocalSuggestions
  }, 1500);
  assert.strictEqual(
    timedOutRemoteRequestCount,
    1,
    'the remote timeout should abort the underlying fetch instead of only ignoring its eventual response'
  );
  assert.strictEqual(
    timedOutRemoteResponse && timedOutRemoteResponse.hasRemoteSuggestions,
    false,
    'a timed-out remote request should leave the local response unchanged'
  );

  let prefetchFetchCount = 0;
  let prefetchFetchStartedAt = 0;
  const { messageListeners: prefetchListeners } = loadBackgroundForTest({
    historySearchDelayMs: 280,
    fetch: async (url) => {
      const parsedUrl = new URL(String(url));
      if (
        parsedUrl.hostname === 'suggestqueries.google.com' &&
        parsedUrl.searchParams.get('q') === 'prefetch-engine'
      ) {
        prefetchFetchCount += 1;
        prefetchFetchStartedAt = Date.now();
        return {
          ok: true,
          json: async () => [
            'prefetch-engine',
            ['prefetch engine result']
          ]
        };
      }
      throw new Error('unexpected prefetch request');
    }
  });
  const prefetchRequestStartedAt = Date.now();
  const prefetchLocalResponse = await sendBackgroundMessage(prefetchListeners, {
    action: 'getSearchSuggestions',
    query: 'prefetch-engine',
    context: 'overlay'
  }, 1000);
  const prefetchLocalResponseAt = Date.now();
  assert.ok(
    prefetchLocalResponse && Array.isArray(prefetchLocalResponse.suggestions),
    'the local search response should remain available while engine suggestions prefetch'
  );
  assert.strictEqual(
    prefetchLocalResponse.suggestions.some((item) => item && item.type === 'googleSuggest'),
    false,
    'prefetching must not add remote engine suggestions to the local response'
  );
  assert.ok(
    prefetchFetchStartedAt > prefetchRequestStartedAt &&
      prefetchFetchStartedAt < prefetchLocalResponseAt,
    'the engine request should begin before a slow local search completes'
  );
  const prefetchRemoteResponse = await sendBackgroundMessage(prefetchListeners, {
    action: 'getSearchEngineSuggestions',
    query: 'prefetch-engine',
    context: 'overlay',
    localSuggestions: prefetchLocalResponse.suggestions
  }, 1000);
  assert.strictEqual(
    prefetchFetchCount,
    1,
    'the remote merge should reuse the in-flight or completed engine prefetch'
  );
  assert.ok(
    prefetchRemoteResponse && prefetchRemoteResponse.hasRemoteSuggestions === true,
    'the reused prefetch should still produce remote engine suggestions'
  );

  let supersededPrefetchAbortCount = 0;
  const { messageListeners: supersededPrefetchListeners } = loadBackgroundForTest({
    fetch: async (url, fetchOptions) => {
      const parsedUrl = new URL(String(url));
      if (parsedUrl.hostname !== 'suggestqueries.google.com') {
        throw new Error('unexpected prefetch host');
      }
      if (parsedUrl.searchParams.get('q') === 'prefetch-superseded') {
        return new Promise((_resolve, reject) => {
          const signal = fetchOptions && fetchOptions.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              supersededPrefetchAbortCount += 1;
              reject(new Error('prefetch superseded'));
            }, { once: true });
          }
        });
      }
      if (parsedUrl.searchParams.get('q') === 'prefetch-replacement') {
        return {
          ok: true,
          json: async () => [
            'prefetch-replacement',
            ['prefetch replacement result']
          ]
        };
      }
      throw new Error('unexpected prefetch query');
    }
  });
  await sendBackgroundMessage(supersededPrefetchListeners, {
    action: 'getSearchSuggestions',
    query: 'prefetch-superseded',
    context: 'overlay'
  }, 1000);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const replacementLocalResponse = await sendBackgroundMessage(supersededPrefetchListeners, {
    action: 'getSearchSuggestions',
    query: 'prefetch-replacement',
    context: 'overlay'
  }, 1000);
  assert.strictEqual(
    supersededPrefetchAbortCount,
    1,
    'a newer local query should abort an already-started engine prefetch for the same context'
  );
  const replacementRemoteAfterPrefetchResponse = await sendBackgroundMessage(
    supersededPrefetchListeners,
    {
      action: 'getSearchEngineSuggestions',
      query: 'prefetch-replacement',
      context: 'overlay',
      localSuggestions: replacementLocalResponse.suggestions
    },
    1000
  );
  assert.ok(
    replacementRemoteAfterPrefetchResponse &&
      replacementRemoteAfterPrefetchResponse.hasRemoteSuggestions === true,
    'the replacement query should still receive its engine suggestion result'
  );

  const deleteResponse = await sendBackgroundMessage(messageListeners, {
    action: 'deleteHistoryUrl',
    url: 'https://github.com/'
  });
  assert.strictEqual(
    deleteResponse && deleteResponse.ok,
    true,
    'deleteHistoryUrl should report a successful deletion'
  );
  assert.strictEqual(
    deleteResponse && deleteResponse.url,
    'https://github.com/',
    'deleteHistoryUrl should echo the removed URL'
  );
  const suggestionsAfterDelete = await context.__testGetSearchSuggestions('github');
  assert.ok(
    !suggestionsAfterDelete.some((item) => item && item.url === 'https://github.com/'),
    'deleted history/top-site URLs should not be returned from stale local search caches'
  );

  const camelInitialSuggestions = await context.__testGetSearchSuggestions('fcc');
  assert.ok(
    camelInitialSuggestions.some((item) => item && item.url === 'https://apps.apple.com/final-cut-camera'),
    'background search suggestions should match camel-case and multi-word title initials'
  );

  const pinyinInitialSuggestions = await context.__testGetSearchSuggestions('wxds');
  assert.ok(
    pinyinInitialSuggestions.some((item) => item && item.url === 'https://weread.qq.com/'),
    'background search suggestions should match Chinese title pinyin initials'
  );

  const openTabInitialSuggestions = await context.__testGetSearchSuggestions('DETC');
  assert.ok(
    openTabInitialSuggestions.some((item) => (
      item &&
      item.url === 'https://app.testmu.com/enterprise-cloud' &&
      item._xMatchedTabId === 25
    )),
    'background search suggestions should match initials from currently open tab titles'
  );

  const { context: coldIndexContext } = loadBackgroundForTest({
    historyFallbackSearchDelayMs: 260,
    bookmarkTreeDelayMs: 260
  });
  const coldIndexStartedAt = Date.now();
  const coldIndexSuggestions = await coldIndexContext.__testGetSearchSuggestions('github');
  const coldIndexElapsedMs = Date.now() - coldIndexStartedAt;
  assert.ok(
    coldIndexElapsedMs < 160,
    `direct local results should not wait for cold full-history and bookmark indexes (took ${coldIndexElapsedMs}ms)`
  );
  assert.ok(
    coldIndexSuggestions.some((item) => item && item.url === 'https://github.com/'),
    'the fast local response should retain direct history matches while background indexes warm'
  );
  await new Promise((resolve) => setTimeout(resolve, 320));
  const warmedFuzzySuggestions = await coldIndexContext.__testGetSearchSuggestions('fcc');
  assert.ok(
    warmedFuzzySuggestions.some((item) => item && item.url === 'https://apps.apple.com/final-cut-camera'),
    'the warmed history index should continue to support fuzzy initial matching after the fast first response'
  );

  let delayedDefaultEngineFetchCount = 0;
  const { messageListeners: delayedDefaultEngineListeners } = loadBackgroundForTest({
    initialSyncData: {
      _x_extension_default_search_engine_2024_unique_: {
        id: 'google',
        name: 'Google',
        host: 'www.google.com',
        searchTemplate: 'https://www.google.com/search?q={query}'
      }
    },
    defaultSearchEngineLoadDelayMs: 160,
    fetch: async (url) => {
      const parsedUrl = new URL(String(url));
      if (parsedUrl.hostname === 'suggestqueries.google.com') {
        delayedDefaultEngineFetchCount += 1;
        return {
          ok: true,
          json: async () => ['什么东西', ['什么东西可以解辣', '什么东西意味着']]
        };
      }
      throw new Error('unexpected request');
    }
  });
  const delayedDefaultEngineResponse = await sendBackgroundMessage(delayedDefaultEngineListeners, {
    action: 'getSearchEngineSuggestions',
    query: '什么东西',
    context: 'newtab',
    localSuggestions: []
  }, 1000);
  assert.strictEqual(
    delayedDefaultEngineFetchCount,
    1,
    'remote keyword suggestions should wait for the stored default search engine instead of returning an empty list during cold start'
  );
  assert.ok(
    delayedDefaultEngineResponse &&
      delayedDefaultEngineResponse.hasRemoteSuggestions === true &&
      delayedDefaultEngineResponse.suggestions.filter((item) => item && item.type === 'googleSuggest').length > 1,
    'a cold-start remote request should still return the full keyword suggestion list'
  );

  let fallbackGoogleFetchCount = 0;
  const { messageListeners: fallbackGoogleListeners } = loadBackgroundForTest({
    fetch: async (url) => {
      const parsedUrl = new URL(String(url));
      if (parsedUrl.hostname === 'suggestqueries.google.com') {
        fallbackGoogleFetchCount += 1;
        return {
          ok: true,
          json: async () => ['什么东西', ['什么东西可以解辣', '什么东西意味着']]
        };
      }
      throw new Error('unexpected request');
    }
  });
  const fallbackGoogleResponse = await sendBackgroundMessage(fallbackGoogleListeners, {
    action: 'getSearchEngineSuggestions',
    query: '什么东西',
    context: 'newtab',
    localSuggestions: []
  }, 1000);
  assert.strictEqual(
    fallbackGoogleFetchCount,
    1,
    'the Google UI fallback should also be the background fallback when no search engine has been stored'
  );
  assert.ok(
    fallbackGoogleResponse && fallbackGoogleResponse.hasRemoteSuggestions === true,
    'an unconfigured search engine should still provide keyword suggestions through the Google fallback'
  );
}

run()
  .then(() => {
    console.log('background search suggestion tests passed');
  })
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
