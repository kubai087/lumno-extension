const assert = require('assert');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const { runModuleInContext, workerScriptSource } = require('../helpers/module-script');
const { loadBackground } = require('../helpers/background-harness');

function createEvent() {
  const listeners = [];
  return {
    addListener(listener) {
      listeners.push(listener);
    },
    removeListener() {},
    hasListener() {
      return false;
    },
    dispatch(...args) {
      listeners.forEach((listener) => listener(...args));
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
  // The full-history and bookmark-tree reads that warm the background
  // indexes: held back until config.coldIndexGate resolves when it is given,
  // else delayed by the configured time.
  const deferColdIndex = (run, ms) => (config.coldIndexGate
    ? config.coldIndexGate.then(run)
    : setTimeout(run, ms));
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
    },
    {
      title: 'Chrome 应用商店开发者信息中心',
      url: 'https://chrome.google.com/webstore/devconsole/test-dashboard?hl=zh-CN',
      visitCount: 12,
      typedCount: 1,
      lastVisitTime: now - 9000
    },
    {
      title: '开发者信息中心 - Google 搜索',
      url: 'https://www.google.com/search?q=%E5%BC%80%E5%8F%91%E8%80%85%E4%BF%A1%E6%81%AF%E4%B8%AD%E5%BF%83',
      visitCount: 20,
      typedCount: 2,
      lastVisitTime: now - 9500
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
    }],
    typeof config.extraHistoryItems === 'function' ? config.extraHistoryItems(now) : []
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
        if (text) {
          setTimeout(() => callback(items), Number(config.historySearchDelayMs) || 0);
        } else {
          deferColdIndex(() => callback(items), Number(config.historyFallbackSearchDelayMs) || 0);
        }
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
        deferColdIndex(() => callback([
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
    navigator: { userAgent: config.userAgent || 'Fake Chrome' },
    fetch: config.fetch || (async () => {
      throw new Error('network disabled in background search test');
    })
  });
  context.globalThis = context;
  context.importScripts = (...urls) => {
    urls.forEach((url) => {
      vm.runInContext(workerScriptSource(url), context, {
        filename: String(url)
      });
    });
  };

  const service = runModuleInContext('src/background/background.ts', context, '__testBackground', {
    also: {
      'src/background/search/pipeline.ts': ['getSearchSuggestions'],
      'src/background/search/default-engine.ts': [
        'buildDefaultSearchUrl',
        'isSearchEngineResultUrl',
        'setDefaultSearchEngineState',
        'updateDefaultSearchEngineFromUrl'
      ],
      'src/background/search/engine-suggestions.ts': ['getSearchEngineSuggestions']
    }
  });
  context.__testGetSearchSuggestions = service.getSearchSuggestions;
  context.__testIsSearchEngineResultUrl = service.isSearchEngineResultUrl;
  context.__testSetDefaultSearchEngineState = service.setDefaultSearchEngineState;
  context.__testUpdateDefaultSearchEngineFromUrl = service.updateDefaultSearchEngineFromUrl;
  context.__testBuildDefaultSearchUrl = service.buildDefaultSearchUrl;
  context.__testGetSearchEngineSuggestions = service.getSearchEngineSuggestions;
  return { context, messageListeners, chromeApi };
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
              'github actions',
              'github pages'
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

  const edgeBackground = loadBackgroundForTest({
    userAgent: 'Mozilla/5.0 (Macintosh) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0'
  });
  const edgeTopSiteOnly = await edgeBackground.context.__testGetSearchSuggestions('github', {
    sourceTypes: ['topSite'],
    includeOpenTabs: false
  });
  assert.strictEqual(
    edgeTopSiteOnly.length,
    0,
    "Edge's promoted topSites should never surface as frequent-site suggestions"
  );
  const edgeAllSources = await edgeBackground.context.__testGetSearchSuggestions('github', {
    includeOpenTabs: false
  });
  assert.ok(
    edgeAllSources.some((item) => item && item.type === 'history') &&
      edgeAllSources.every((item) => item && item.type !== 'topSite' && !item.isTopSite),
    'Edge should keep history suggestions without top-site boosts'
  );
  const bookmarksOnlyBackground = loadBackgroundForTest({
    initialSyncData: { _x_extension_search_result_source_types_2026_unique_: ['bookmark'] }
  });
  const disabledHistory = await bookmarksOnlyBackground.context.__testGetSearchSuggestions('github', {
    sourceTypes: ['history'],
    includeOpenTabs: false
  });
  assert.strictEqual(disabledHistory.filter((item) => item && item.type === 'history').length, 0,
    'a History scope should not bring back history the user turned off as a result source');
  const openTabUrl = 'https://app.testmu.com/enterprise-cloud';
  const withOpenTabs = await context.__testGetSearchSuggestions('testmu', { sourceTypes: ['history'] });
  const withoutOpenTabs = await context.__testGetSearchSuggestions('testmu', { sourceTypes: ['history'], includeOpenTabs: false });
  assert.ok(withOpenTabs.some((item) => item && item.url === openTabUrl), 'a scoped search keeps open tabs unless told otherwise');
  assert.ok(!withoutOpenTabs.some((item) => item && item.url === openTabUrl), 'a local scope can leave open tabs out');
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

  const developerDashboardSuggestions = await context.__testGetSearchSuggestions('开发者信息中心', {
    sourceTypes: ['history'],
    includeOpenTabs: false
  });
  assert.ok(
    developerDashboardSuggestions.some((item) => (
      item && item.type === 'history' &&
      item.url === 'https://chrome.google.com/webstore/devconsole/test-dashboard?hl=zh-CN'
    )),
    'Chinese title fragments should find the Chrome developer dashboard in history without relying on an open tab or bookmark'
  );
  assert.ok(
    !developerDashboardSuggestions.some((item) => item && item.url.startsWith('https://www.google.com/search?')),
    'actual search-result pages should still be excluded from history suggestions'
  );

  const searchResultUrls = [
    'https://www.google.com/search?q=test',
    'https://www.google.com/search/?q=test',
    'https://www.google.co.jp/search?q=test',
    'https://www.google.com.hk/search?q=test',
    'https://kagi.com/search?q=test',
    'https://www.bing.com/search?q=test',
    'https://cn.bing.com/search?q=test',
    'https://www.baidu.com/s?wd=test',
    'https://duckduckgo.com/?q=test',
    'https://search.yahoo.com/search?p=test',
    'https://yandex.com/search/?text=test',
    'https://yandex.ru/search/?text=test',
    'https://yandex.tm/search/?text=test',
    'https://yandex.com.tr/search/?text=test',
    'https://ya.ru/search/?text=test',
    'https://www.sogou.com/web?query=test',
    'https://m.sm.cn/s?q=test'
  ];
  searchResultUrls.forEach((url) => {
    assert.strictEqual(context.__testIsSearchEngineResultUrl(url), true, `${url} should be recognized as a search result`);
  });
  const ordinaryPageUrls = [
    'https://chrome.google.com/webstore/devconsole/test-dashboard?hl=zh-CN',
    'https://chrome.google.com/webstore/devconsole/test-dashboard?q=test',
    'https://chromewebstore.google.com/detail/example/example-id',
    'https://www.google.com/webmasters/',
    'https://www.google.com/support/',
    'https://www.google.com/sheets/',
    'https://www.google.com/search-console?q=test',
    'https://www.google.com/search/docs?q=test',
    'https://www.google.com/search',
    'https://www.google.com/search?q=',
    'https://www.google.com/?q=test',
    'https://www.sogou.com/webstore?query=test',
    'https://www.baidu.com/support?wd=test',
    'https://www.google.com.example.test/search?q=test',
    'https://notbing.com/search?q=test',
    'https://yandex.tm/maps/?text=test',
    'https://notyandex.ru/search/?text=test',
    'https://yandex.ru.example.test/search/?text=test',
    'https://bing.com.example.test/search?q=test',
    'https://example.test/search?q=test',
    'chrome://history/',
    'invalid-url'
  ];
  ordinaryPageUrls.forEach((url) => {
    assert.strictEqual(context.__testIsSearchEngineResultUrl(url), false, `${url} should remain an ordinary page`);
  });

  assert.strictEqual(context.__testUpdateDefaultSearchEngineFromUrl('https://yandex.tm/search/?text=test'), true,
    'a regional Yandex result page should be read as the default engine');
  assert.strictEqual(context.__testBuildDefaultSearchUrl('a b'), 'https://yandex.tm/search/?text=a%20b',
    'searches should go to the regional Yandex site this device used');
  assert.strictEqual(context.__testUpdateDefaultSearchEngineFromUrl('https://www.google.co.jp/search?q=test'), true);
  assert.strictEqual(context.__testBuildDefaultSearchUrl('a b'), 'https://www.google.com/search?q=a%20b',
    'regional Google pages should keep searching on google.com');

  const developerDashboard = {
    title: 'Chrome 应用商店开发者信息中心',
    url: 'https://chrome.google.com/webstore/devconsole/test-dashboard?hl=zh-CN'
  };
  for (const surface of ['newtab', 'overlay']) {
    const response = await sendBackgroundMessage(messageListeners, {
      action: 'getSearchSuggestions',
      query: '开发者信息中心',
      context: surface,
      includeOpenTabs: false
    }, 1000);
    assert.ok(
      response && response.suggestions.some((item) => item && item.url === developerDashboard.url),
      `${surface} search messages should retain the developer dashboard history match`
    );
  }

  const { context: developerBookmarkContext } = loadBackgroundForTest();
  developerBookmarkContext.chrome.bookmarks.search = (_options, callback) => {
    setTimeout(() => callback([{ id: '11', parentId: '1', ...developerDashboard }]), 0);
  };
  const developerBookmarks = await developerBookmarkContext.__testGetSearchSuggestions('开发者信息中心', {
    sourceTypes: ['bookmark'],
    includeOpenTabs: false
  });
  assert.ok(
    developerBookmarks.some((item) => item && item.type === 'bookmark' && item.url === developerDashboard.url),
    'the developer dashboard should remain searchable from bookmarks'
  );

  const historyOnlyGithubRoot = (await context.__testGetSearchSuggestions('github', { includeOpenTabs: false }))
    .find((item) => item && item.url === 'https://github.com/');
  const { context: bookmarkedRootContext } = loadBackgroundForTest();
  bookmarkedRootContext.chrome.bookmarks.search = (_options, callback) => {
    setTimeout(() => callback([{ id: '12', parentId: '1', title: 'GitHub Home', url: 'https://github.com/' }]), 0);
  };
  const bookmarkedRootSuggestions = await bookmarkedRootContext.__testGetSearchSuggestions('github', {
    includeOpenTabs: false
  });
  const bookmarkedRootRows = bookmarkedRootSuggestions.filter((item) => item && item.url === 'https://github.com/');
  assert.strictEqual(
    bookmarkedRootRows.length,
    1,
    'a page seen in history and bookmarked under another title should appear once'
  );
  assert.strictEqual(bookmarkedRootRows[0].type, 'bookmark', 'the merged page should keep its bookmark identity');
  assert.strictEqual(
    bookmarkedRootRows[0].visitCount,
    18,
    'merging a bookmark into a history page should keep the visit signals'
  );
  assert.ok(
    historyOnlyGithubRoot && bookmarkedRootRows[0].score >= historyOnlyGithubRoot.score,
    'bookmarking a frequently visited page should never lower its rank score'
  );

  const { context: developerOpenTabContext } = loadBackgroundForTest();
  developerOpenTabContext.chrome.tabs.query = (_options, callback) => {
    setTimeout(() => callback([
      { id: 27, windowId: 1, ...developerDashboard },
      {
        id: 28,
        windowId: 1,
        title: '账户安全中心 - Example',
        url: 'https://example.test/settings/security/account'
      },
      { id: 29, windowId: 1, title: 'Unrelated page', url: 'https://example.test/other' }
    ]), 0);
  };
  const developerOpenTabs = await developerOpenTabContext.__testGetSearchSuggestions('开发者信息中心', {
    sourceTypes: ['bookmark']
  });
  assert.ok(
    developerOpenTabs.some((item) => (
      item && item.type === 'openTab' && item.url === developerDashboard.url && item._xMatchedTabId === 27
    )),
    'the developer dashboard should remain searchable as an open tab without a history or bookmark match'
  );
  assert.strictEqual(developerOpenTabs.length, 1, 'unrelated open tabs should remain excluded');
  const securityOpenTabs = await developerOpenTabContext.__testGetSearchSuggestions('账户安全', {
    sourceTypes: ['bookmark']
  });
  assert.ok(
    securityOpenTabs.some((item) => item && item._xMatchedTabId === 28 && item.score > 0),
    'category penalties should rank a matching open utility page without removing it'
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
  const searchFirstMixedSuggestions = await context.__testGetSearchEngineSuggestions(
    'github',
    mixedLocalSuggestions,
    { context: 'newtab', searchFirst: true }
  );
  assert.strictEqual(
    searchFirstMixedSuggestions.filter((item) => item && item.type === 'googleSuggest').length,
    5,
    'search-first remote merge should reserve the full five-item engine suggestion cap'
  );
  // #123: the local row titled exactly "GitHub" leads (the background list
  // has no search action), and the five engine suggestions follow it.
  assert.strictEqual(
    searchFirstMixedSuggestions[0] && searchFirstMixedSuggestions[0].title,
    'GitHub',
    'search-first remote merge should put the exact-title local row before the engine suggestions'
  );
  assert.ok(
    searchFirstMixedSuggestions.slice(1, 6).every((item) => item && item.type === 'googleSuggest'),
    'search-first remote merge should keep all reserved engine suggestions inside the returned slate limit'
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
  const pinyinInitialSuggestion = pinyinInitialSuggestions.find((item) => item && item.url === 'https://weread.qq.com/');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(pinyinInitialSuggestion && pinyinInitialSuggestion.titleHighlight)),
    { text: '微信读书', query: 'wxds', ranges: [[0, 4]] },
    'a pinyin match should send the title characters it spelled for highlighting'
  );
  const traditionalSuggestions = await context.__testGetSearchSuggestions('微信讀書');
  assert.ok(
    traditionalSuggestions.some((item) => item && item.url === 'https://weread.qq.com/'),
    'background search suggestions should match a simplified title from traditional characters'
  );
  const reorderedSuggestions = await context.__testGetSearchSuggestions('读书微信');
  const reorderedSuggestion = reorderedSuggestions.find((item) => item && item.url === 'https://weread.qq.com/');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(reorderedSuggestion && reorderedSuggestion.titleHighlight)),
    { text: '微信读书', query: '读书微信', ranges: [[0, 4]] },
    'background search suggestions should match a title holding the query in pieces'
  );
  const mixedPinyinSuggestions = await context.__testGetSearchSuggestions('weixinds');
  assert.ok(
    mixedPinyinSuggestions.some((item) => item && item.url === 'https://weread.qq.com/'),
    'background search suggestions should match full pinyin mixed with initials'
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

  // The cold indexes answer only once the test lets them, so results that
  // arrive before that did not wait for them, however busy the machine is.
  let warmColdIndexes;
  const coldIndexGate = new Promise((resolve) => {
    warmColdIndexes = resolve;
  });
  const { context: coldIndexContext } = loadBackgroundForTest({ coldIndexGate });
  const coldIndexSuggestions = await Promise.race([
    coldIndexContext.__testGetSearchSuggestions('github'),
    new Promise((resolve) => setTimeout(() => resolve(null), 5000))
  ]);
  assert.ok(
    coldIndexSuggestions,
    'direct local results should not wait for cold full-history and bookmark indexes'
  );
  assert.ok(
    coldIndexSuggestions.some((item) => item && item.url === 'https://github.com/'),
    'the fast local response should retain direct history matches while background indexes warm'
  );
  warmColdIndexes();
  const warmedFuzzyMatch = (items) => items.some((item) => item && item.url === 'https://apps.apple.com/final-cut-camera');
  let warmedFuzzySuggestions = [];
  for (const deadline = Date.now() + 5000; Date.now() < deadline && !warmedFuzzyMatch(warmedFuzzySuggestions);) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    warmedFuzzySuggestions = await coldIndexContext.__testGetSearchSuggestions('fcc');
  }
  assert.ok(
    warmedFuzzyMatch(warmedFuzzySuggestions),
    'the warmed history index should continue to support fuzzy initial matching after the fast first response'
  );

  const hostSpellingContext = loadBackgroundForTest({
    extraHistoryItems: (now) => [{
      title: 'Zhihu - Have a question',
      url: 'https://www.zhihu.com/question/1',
      visitCount: 3,
      typedCount: 0,
      lastVisitTime: now - 5_500
    }]
  }).context;
  const hostSpellingSuggestions = await hostSpellingContext.__testGetSearchSuggestions('知乎');
  assert.ok(
    hostSpellingSuggestions.some((item) => item && item.url === 'https://www.zhihu.com/question/1'),
    'a Han query should find a page whose address spells it in pinyin'
  );

  // Fuzzy pinyin is off until the reader turns it on, and follows the setting.
  const fuzzyHistory = (now) => [{
    title: '中国银行',
    url: 'https://www.boc.cn/',
    visitCount: 2,
    typedCount: 0,
    lastVisitTime: now - 5_600
  }];
  const findBankByFuzzyPinyin = async (fuzzyContext) => (
    (await fuzzyContext.__testGetSearchSuggestions('zongguoyinhang'))
      .some((item) => item && item.url === 'https://www.boc.cn/')
  );
  const exactPinyin = loadBackgroundForTest({ extraHistoryItems: fuzzyHistory });
  assert.strictEqual(
    await findBankByFuzzyPinyin(exactPinyin.context),
    false,
    'pinyin should keep z and zh apart while fuzzy pinyin is off'
  );
  exactPinyin.chromeApi.storage.onChanged.dispatch({
    _x_extension_search_fuzzy_pinyin_enabled_2026_unique_: { newValue: true }
  }, 'sync');
  assert.strictEqual(
    await findBankByFuzzyPinyin(exactPinyin.context),
    true,
    'turning fuzzy pinyin on should index the titles again with its readings'
  );
  const storedFuzzyPinyin = loadBackgroundForTest({
    extraHistoryItems: fuzzyHistory,
    initialSyncData: { _x_extension_search_fuzzy_pinyin_enabled_2026_unique_: true }
  });
  assert.strictEqual(
    await findBankByFuzzyPinyin(storedFuzzyPinyin.context),
    true,
    'a stored fuzzy pinyin choice should apply from the first search'
  );

  // Pinyin reaches history older than the recent list: the browser's own
  // history search cannot read pinyin, so Han titles are kept from further back.
  const { context: olderHistoryContext, chromeApi: olderHistoryChrome } = loadBackgroundForTest({
    extraHistoryItems: (now) => Array.from({ length: 400 }, (_, index) => ({
      title: `Older Filler ${index + 1}`,
      url: `https://older-filler.example.com/${index + 1}`,
      visitCount: 1,
      typedCount: 0,
      lastVisitTime: now - 30_000 - index
    })).concat([{
      title: '飞书云文档',
      url: 'https://feishu.example.com/drive',
      visitCount: 2,
      typedCount: 0,
      lastVisitTime: now - 40_000
    }])
  });
  const findOlderFeishu = async (query) => {
    await olderHistoryContext.__testGetSearchSuggestions(query);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const suggestions = await olderHistoryContext.__testGetSearchSuggestions(query);
    return suggestions.some((item) => item && item.url === 'https://feishu.example.com/drive');
  };
  assert.strictEqual(
    await findOlderFeishu('feishuwendang'),
    true,
    'pinyin should find a Han title older than the recent history list'
  );
  olderHistoryChrome.history.onVisitRemoved.dispatch({
    allHistory: false,
    urls: ['https://feishu.example.com/drive']
  });
  assert.strictEqual(
    await findOlderFeishu('feishuwendang'),
    false,
    'removed history should leave the Han title history at once'
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

  // The prefill hotkey opens the overlay with the full current URL; neither it
  // nor any other URL, host or path may reach the suggestion provider.
  const remoteSuggestionQueries = [];
  const { messageListeners: urlQueryListeners } = loadBackgroundForTest({
    fetch: async (url) => {
      const parsedUrl = new URL(String(url));
      if (parsedUrl.hostname === 'suggestqueries.google.com') {
        remoteSuggestionQueries.push(parsedUrl.searchParams.get('q'));
        return { ok: true, json: async () => [parsedUrl.searchParams.get('q'), ['remote keyword']] };
      }
      throw new Error('unexpected request');
    }
  });
  const urlLikeQueries = [
    'https://wiki.corp.example/private/page?token=secret',
    'https://wiki.corp.example/private/page?token=secret more words',
    'file:///Users/someone/Documents/contract.pdf',
    'jira.internal/browse/SEC-1',
    '10.0.0.8:8080/admin'
  ];
  for (const query of urlLikeQueries) {
    await sendBackgroundMessage(urlQueryListeners, {
      action: 'getSearchSuggestions',
      query,
      context: 'overlay'
    }, 200);
    const response = await sendBackgroundMessage(urlQueryListeners, {
      action: 'getSearchEngineSuggestions',
      query,
      context: 'overlay',
      localSuggestions: []
    }, 1000);
    assert.ok(
      response && response.hasRemoteSuggestions === false,
      `${query} should not get remote keyword suggestions`
    );
  }
  assert.deepStrictEqual(
    remoteSuggestionQueries,
    [],
    'URL, host and path queries (including the prefilled page URL) should never be sent to the suggestion provider'
  );
  await sendBackgroundMessage(urlQueryListeners, {
    action: 'getSearchEngineSuggestions',
    query: 'weather tomorrow',
    context: 'overlay',
    localSuggestions: []
  }, 1000);
  assert.deepStrictEqual(
    remoteSuggestionQueries,
    ['weather tomorrow'],
    'ordinary words should still get remote keyword suggestions'
  );
}

// A worker woken by a search has not read the favicon settings yet. Its
// first suggestions must already leave excluded sites out of third-party
// favicon fetches. The harness's file-path extension URLs give no browser
// favicon cache, so the favicon service is the first candidate here.
async function testColdWorkerAppliesTheFaviconExclusionToItsFirstSuggestions() {
  const harness = loadBackground({
    sync: {
      _x_extension_favicon_request_blacklist_2026_unique_: ['secret.example.test'],
      _x_extension_favicon_enhanced_fetch_enabled_2026_unique_: true
    },
    configureChrome(chromeApi) {
      chromeApi.history.search = (_query, callback) => setTimeout(() => callback([
        { url: 'https://secret.example.test/page', title: 'alpha secret', visitCount: 5, lastVisitTime: Date.now() },
        { url: 'https://open.example.test/page', title: 'alpha open', visitCount: 5, lastVisitTime: Date.now() }
      ]), 0);
    }
  });
  const response = await harness.sendMessage({ action: 'getSearchSuggestions', query: 'alpha' }, undefined, 2000);
  const favicons = Object.fromEntries(response.suggestions.map((item) => [new URL(item.url).hostname, item.favicon]));
  assert.ok(!favicons['secret.example.test'] || !/gstatic/.test(favicons['secret.example.test']),
    'an excluded site should not get a third-party favicon, even on the first search after a wake');
  assert.match(favicons['open.example.test'], /gstatic/, 'other sites should still use the enhanced favicon fetch');
}

run()
  .then(testColdWorkerAppliesTheFaviconExclusionToItsFirstSuggestions)
  .then(() => {
    console.log('background search suggestion tests passed');
  })
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
