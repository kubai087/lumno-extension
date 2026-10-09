const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
require('../src/shared/extension-routes.js');
require('../src/background/tab-groups.js');
const fallback = require('../src/background/newtab-fallback.js');

const repoRoot = path.resolve(__dirname, '..');
const lumnoNewtabHtml = fs.readFileSync(path.join(repoRoot, 'src', 'newtab', 'lumno-newtab.html'), 'utf8');
const lumnoNewtabRedirectJsPath = path.join(repoRoot, 'src', 'newtab', 'lumno-newtab.js');
const lumnoNewtabRedirectJs = fs.existsSync(lumnoNewtabRedirectJsPath)
  ? fs.readFileSync(lumnoNewtabRedirectJsPath, 'utf8')
  : '';

function getScriptTags(source) {
  return Array.from(source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g));
}

assert.strictEqual(
  fallback.isLocalFileLikeTargetUrl('file:///Users/example/document.pdf'),
  true,
  'file URLs should be treated as local-file-like targets'
);
assert.strictEqual(
  fallback.isLocalFileLikeTargetUrl('https://example.com/viewer?src=file:///tmp/a.html'),
  true,
  'nested file src parameters should be treated as local-file-like targets'
);
assert.strictEqual(
  fallback.isLocalFileLikeTargetUrl('https://example.com/docs/report.pdf'),
  true,
  'PDF paths should be treated as local-file-like targets'
);
assert.strictEqual(
  fallback.isLocalFileLikeTargetUrl('https://example.com/'),
  false,
  'ordinary web URLs should not be treated as local-file-like targets'
);

const originalChrome = globalThis.chrome;
const createdTabs = [];
const groupedTabs = [];
globalThis.chrome = {
  runtime: {
    getURL: (value) => `chrome-extension://abc/${value}`,
    lastError: null
  },
  extension: {
    isAllowedFileSchemeAccess: (callback) => {
      callback(false);
    }
  },
  tabs: {
    create: (options, callback) => {
      const tab = {
        id: 100 + createdTabs.length,
        windowId: typeof options.windowId === 'number' ? options.windowId : 1,
        url: options && options.url || '',
        groupId: -1
      };
      createdTabs.push({ ...(options || {}) });
      if (callback) {
        callback(tab);
      }
    },
    group: (options, callback) => {
      groupedTabs.push({ ...(options || {}) });
      if (callback) {
        callback(options.groupId || 7);
      }
    }
  },
  tabGroups: {
    TAB_GROUP_ID_NONE: -1
  }
};

assert.strictEqual(
  fallback.buildNewtabFallbackUrl({ notice: 'file-access' }),
  'chrome-extension://abc/src/newtab/lumno-newtab.html?focus=1&notice=file-access',
  'file-access notice should be encoded into the standalone Lumno newtab fallback URL'
);

assert.match(
  lumnoNewtabHtml,
  /<script src="lumno-newtab\.js"><\/script>/,
  'standalone Lumno newtab fallback should load the redirect through an external script'
);
assert.doesNotMatch(
  lumnoNewtabHtml,
  /wallpaper-preload\.js|codex-debug-surface\.js/,
  'standalone Lumno newtab fallback should redirect without painting or bootstrapping an intermediate page'
);
assert.ok(
  getScriptTags(lumnoNewtabHtml).every((match) => /\bsrc=/.test(match[1])),
  'standalone Lumno newtab fallback should not use inline scripts because extension pages disallow them by CSP'
);
assert.match(
  lumnoNewtabRedirectJs,
  /new URL\('\.\.\/\.\.\/newtab\.html', window\.location\.href\)/,
  'standalone Lumno newtab redirect script should target the primary maintained newtab page'
);
assert.match(
  lumnoNewtabRedirectJs,
  /target\.search = window\.location\.search \|\| '';/,
  'standalone Lumno newtab fallback should preserve focus and notice query parameters'
);
assert.match(
  lumnoNewtabRedirectJs,
  /target\.searchParams\.set\('focus', '1'\);/,
  'Lumno newtab redirect should always request focus on the maintained page'
);
assert.match(
  lumnoNewtabRedirectJs,
  /target\.hash = window\.location\.hash \|\| '';/,
  'standalone Lumno newtab fallback should preserve hash parameters'
);
assert.match(
  lumnoNewtabRedirectJs,
  /window\.location\.replace\(target\.href\);/,
  'standalone Lumno newtab fallback should replace history instead of stacking a duplicate page'
);
{
  const replacedUrls = [];
  vm.runInNewContext(lumnoNewtabRedirectJs, {
    URL,
    window: {
      location: {
        href: 'chrome-extension://abc/src/newtab/lumno-newtab.html?focus=1&notice=file-access#search',
        search: '?focus=1&notice=file-access',
        hash: '#search',
        replace(url) {
          replacedUrls.push(url);
        }
      }
    }
  });
  assert.deepStrictEqual(
    replacedUrls,
    ['chrome-extension://abc/newtab.html?focus=1&notice=file-access#search'],
    'standalone Lumno newtab redirect should preserve query and hash while requesting focus'
  );
}
{
  const replacedUrls = [];
  vm.runInNewContext(lumnoNewtabRedirectJs, {
    URL,
    window: {
      location: {
        href: 'chrome-extension://abc/src/newtab/lumno-newtab.html',
        search: '',
        hash: '',
        replace(url) {
          replacedUrls.push(url);
        }
      }
    }
  });
  assert.deepStrictEqual(
    replacedUrls,
    ['chrome-extension://abc/newtab.html?focus=1'],
    'standalone Lumno fallbacks should request focus while retaining the maintained page entrance animation'
  );
}
assert.doesNotMatch(
  lumnoNewtabHtml,
  /<script src="newtab\.js"><\/script>/,
  'standalone Lumno newtab fallback should not duplicate the main newtab runtime dependency list'
);

fallback.openNewtabFallbackForUrl('file:///Users/example/document.pdf');
assert.strictEqual(
  createdTabs[0].url,
  'chrome-extension://abc/src/newtab/lumno-newtab.html?focus=1&notice=file-access',
  'file URLs without file-scheme access should open the notice variant'
);

fallback.openNewtabFallbackForUrl('https://example.com/');
assert.strictEqual(
  createdTabs[1].url,
  'chrome-extension://abc/src/newtab/lumno-newtab.html?focus=1',
  'ordinary web URLs should open the standalone focused Lumno newtab fallback'
);

fallback.openBrowserNewtabFallback();
assert.strictEqual(
  createdTabs[2].url,
  undefined,
  'browser newtab fallback should omit url so the browser-selected newtab provider handles it'
);

fallback.openNewtabFallback({
  sourceTab: { id: 20, windowId: 5, groupId: 9 }
});
assert.strictEqual(
  createdTabs[3].windowId,
  5,
  'Lumno newtab fallback should open in the source tab window when inheriting a group'
);
assert.deepStrictEqual(
  groupedTabs[0],
  { tabIds: 103, groupId: 9 },
  'Lumno newtab fallback should join the source tab group'
);

fallback.openBrowserNewtabFallback({
  sourceTab: { id: 21, windowId: 6, groupId: 11 }
});
assert.deepStrictEqual(
  groupedTabs[1],
  { tabIds: 104, groupId: 11 },
  'browser newtab fallback should also join the source tab group'
);

{
  const removedTabs = [];
  const forgottenTabs = [];
  globalThis.chrome.tabs.remove = (tabId, callback) => {
    removedTabs.push(tabId);
    callback();
  };
  globalThis.chrome.sessions = {
    getRecentlyClosed: (_filter, callback) => {
      callback([
        { lastModified: Date.now(), tab: { url: 'https://example.com/', sessionId: 'other', windowId: 3 } },
        { lastModified: Date.now(), tab: { url: 'chrome-extension://abc/newtab.html', sessionId: 'swapped', windowId: 3 } },
        { lastModified: 1, tab: { url: 'chrome-extension://abc/newtab.html', sessionId: 'user-closed', windowId: 3 } }
      ]);
    },
    forgetClosedTab: (...args) => {
      assert.strictEqual(args.length, 2, 'Firefox rejects a callback argument for sessions.forgetClosedTab');
      forgottenTabs.push({ windowId: args[0], sessionId: args[1] });
      return Promise.resolve();
    }
  };
  const swapResults = [];
  const sourceTab = { id: 30, index: 4, windowId: 3, openerTabId: 12, cookieStoreId: 'firefox-default' };
  fallback.swapNewtabForFocus(sourceTab, 'chrome-extension://abc/newtab.html', (result) => {
    swapResults.push(result);
  });
  assert.deepStrictEqual(
    createdTabs[createdTabs.length - 1],
    {
      url: 'chrome-extension://abc/newtab.html#focus',
      index: 4,
      windowId: 3,
      active: true,
      openerTabId: 12
    },
    'the focus swap should open the focused New Tab in place of the sender, keeping its opener'
  );
  assert.deepStrictEqual(removedTabs, [30], 'the focus swap should close the sender tab');
  assert.deepStrictEqual(
    forgottenTabs,
    [{ windowId: 3, sessionId: 'swapped' }],
    'the replaced New Tab should not linger in recently closed tabs'
  );
  assert.deepStrictEqual(swapResults, [{ ok: true, removed: true }]);

  const createdBefore = createdTabs.length;
  fallback.swapNewtabForFocus({ id: 31, index: 0, windowId: 3 }, 'https://example.com/newtab.html', (result) => {
    swapResults.push(result);
  });
  assert.strictEqual(createdTabs.length, createdBefore, 'only the Lumno New Tab page may request a focus swap');
  assert.deepStrictEqual(swapResults[1], { ok: false, reason: 'invalid-sender' });

  fallback.swapNewtabForFocus(
    { id: 32, index: 0, windowId: 3, cookieStoreId: 'firefox-container-2' },
    'chrome-extension://abc/newtab.html',
    (result) => {
      swapResults.push(result);
    }
  );
  assert.strictEqual(createdTabs.length, createdBefore, 'container tabs should not be recreated without the cookies permission');
  assert.deepStrictEqual(swapResults[2], { ok: false, reason: 'container-tab' });
}

globalThis.chrome = originalChrome;

console.log('newtab fallback tests passed');
