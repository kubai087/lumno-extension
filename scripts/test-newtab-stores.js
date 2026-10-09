const assert = require('assert');
const fs = require('fs');
const path = require('path');
const recentStore = require('../src/newtab/recent-sites-store.js');
const bookmarkStore = require('../src/newtab/bookmarks-store.js');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');

function createMemoryStorage(initialData) {
  const data = { ...(initialData || {}) };
  return {
    get(keys, callback) {
      const result = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        result[key] = data[key];
      });
      callback(result);
    },
    set(value, callback) {
      Object.assign(data, value || {});
      if (callback) {
        callback();
      }
    },
    data
  };
}

async function testRecentStore() {
  assert.strictEqual(recentStore.normalizeRecentCount(8), 8);
  assert.strictEqual(recentStore.normalizeRecentCount('0'), 0);
  assert.strictEqual(recentStore.normalizeRecentCount(12), 4);

  const options = {
    normalizeHost: (host) => String(host || '').toLowerCase().replace(/^www\./, ''),
    sanitizeDisplayText: (text) => String(text || '').trim(),
    getSiteDisplayName: (host) => host.split('.')[0],
    shouldExcludeUrl: (url) => String(url || '').startsWith('chrome-extension://')
  };

  const merged = recentStore.mergeRecentSiteSources({
    ...options,
    mode: 'latest',
    limit: 4,
    pinned: [{ title: 'Pinned', url: 'https://pinned.example/a', lastVisitTime: 2 }],
    hidden: [{ url: 'https://hidden.example/a', lastVisitTime: 10 }],
    historyItems: [
      { title: 'Hidden', url: 'https://hidden.example/a', lastVisitTime: 5 },
      { title: 'Recent', url: 'https://recent.example/a', lastVisitTime: 8 }
    ],
    topSites: [
      { title: 'Top', url: 'https://top.example/' }
    ],
    tabs: [
      { title: 'Tab', url: 'https://tab.example/', lastAccessed: 9 },
      { title: 'Duplicate recent tab', url: 'https://recent.example/other', lastAccessed: 10 }
    ]
  });

  assert.deepStrictEqual(
    merged.map((item) => item.host),
    ['pinned.example', 'recent.example', 'top.example', 'tab.example']
  );
  assert.strictEqual(merged[0]._xPinned, true);

  const browserPageMerged = recentStore.mergeRecentSiteSources({
    ...options,
    mode: 'latest',
    limit: 4,
    candidateLimit: 4,
    pinned: [],
    hidden: [],
    shouldExcludeUrl: (url) => String(url || '') === 'chrome://newtab/',
    shouldPrioritizeTabUrl: (url) => String(url || '').startsWith('chrome://') &&
      String(url || '') !== 'chrome://newtab/',
    historyItems: [
      { title: 'One', url: 'https://one.example/', lastVisitTime: 20 },
      { title: 'Two', url: 'https://two.example/', lastVisitTime: 19 },
      { title: 'Three', url: 'https://three.example/', lastVisitTime: 18 },
      { title: 'Four', url: 'https://four.example/', lastVisitTime: 17 }
    ],
    tabs: [
      { title: '新标签页', url: 'chrome://newtab/', lastAccessed: 30 },
      { title: '扩展程序', url: 'chrome://extensions/', lastAccessed: 31 }
    ]
  });
  assert.ok(
    browserPageMerged.some((item) => item.url === 'chrome://extensions/'),
    'browser internal tabs should survive a full history candidate set'
  );
  assert.strictEqual(
    browserPageMerged.some((item) => item.url === 'chrome://newtab/'),
    false,
    'browser newtab pages should still be filtered from recent sites'
  );

  const storage = createMemoryStorage({
    [recentStore.DEFAULT_PINNED_KEY]: [
      { title: 'A', url: 'https://a.example/' },
      { title: 'A duplicate', url: 'https://a.example/' },
      { title: 'B', url: 'https://b.example/' },
      { title: 'C', url: 'https://c.example/' },
      { title: 'D', url: 'https://d.example/' }
    ]
  });
  const loadedPinned = await recentStore.loadPinnedRecentSites(storage, options);
  assert.strictEqual(loadedPinned.length, 3);
  assert.deepStrictEqual(loadedPinned.map((item) => item.host), ['a.example', 'b.example', 'c.example']);

  const savedHidden = await recentStore.saveHiddenRecentSites(storage, [
    'https://hidden.example/a',
    { url: 'https://hidden.example/a', lastVisitTime: 12 }
  ], options);
  assert.strictEqual(savedHidden.length, 1);
  assert.strictEqual(savedHidden[0].lastVisitTime, 12);

  let sanitizedValueCount = 0;
  const boundedMerge = recentStore.mergeRecentSitesWithPinned(
    Array.from({ length: 10_000 }, (_, index) => ({
      title: `Candidate ${index}`,
      url: `https://candidate-${index}.example/`
    })),
    [],
    [],
    8,
    {
      sanitizeDisplayText(value) {
        sanitizedValueCount += 1;
        return String(value || '').trim();
      }
    }
  );
  assert.strictEqual(boundedMerge.length, 8);
  assert.strictEqual(
    sanitizedValueCount,
    16,
    'recent-site merging should stop normalizing candidates once the visible limit is full'
  );

  let sourceSanitizedValueCount = 0;
  const boundedSourceMerge = recentStore.mergeRecentSiteSources({
    mode: 'latest',
    limit: 8,
    candidateLimit: 10_000,
    pinned: [],
    hidden: [],
    historyItems: Array.from({ length: 10_000 }, (_, index) => ({
      title: `History ${index}`,
      url: `https://history-${index}.example/`,
      lastVisitTime: 10_000 - index
    })),
    sanitizeDisplayText(value) {
      sourceSanitizedValueCount += 1;
      return String(value || '').trim();
    }
  });
  assert.strictEqual(boundedSourceMerge.length, 8);
  assert.strictEqual(
    sourceSanitizedValueCount,
    16,
    'source merging should normalize each visible candidate once and stop when the result is full'
  );

  let budgetSanitizedValueCount = 0;
  const candidateBudgetMerge = recentStore.mergeRecentSiteSources({
    mode: 'latest',
    limit: 4,
    candidateLimit: 4,
    pinned: [{ title: 'Pinned', url: 'https://candidate-0.example/' }],
    hidden: [
      { url: 'https://candidate-1.example/', lastVisitTime: 100 },
      { url: 'https://candidate-2.example/', lastVisitTime: 100 }
    ],
    historyItems: Array.from({ length: 6 }, (_, index) => ({
      title: `Candidate ${index}`,
      url: `https://candidate-${index}.example/`,
      lastVisitTime: 10 - index
    })),
    sanitizeDisplayText(value) {
      budgetSanitizedValueCount += 1;
      return String(value || '').trim();
    }
  });
  assert.deepStrictEqual(
    candidateBudgetMerge.map((item) => item.host),
    ['candidate-0.example', 'candidate-3.example'],
    'hidden and pinned duplicates should still consume the configured source candidate budget'
  );
  assert.strictEqual(
    budgetSanitizedValueCount,
    10,
    'the collector should normalize one pinned item and no more than four source candidates'
  );
}

function testBookmarkStore() {
  const tree = [{
    id: '0',
    title: '',
    children: [{
      id: '10',
      title: '書籤欄',
      children: [
        { id: '11', title: 'OpenAI', url: 'https://openai.com/' },
        { id: '12', title: 'Duplicate OpenAI', url: 'https://openai.com/' },
        {
          id: '13',
          title: 'Design',
          children: [
            { id: '14', title: 'Figma', url: 'https://figma.com/files' },
            { id: '15', title: 'Lumno', url: 'https://lumno.kubai.design/' }
          ]
        }
      ]
    }]
  }];

  const bar = bookmarkStore.findBookmarksBarNode(tree);
  assert.strictEqual(bar.id, '10');

  const firefoxTree = [{
    id: 'root________',
    children: [
      { id: 'menu________', parentId: 'root________', title: 'Bookmarks Menu', children: [] },
      { id: 'toolbar_____', parentId: 'root________', title: 'Bookmarks Toolbar', children: [] },
      { id: 'unfiled_____', parentId: 'root________', title: 'Other Bookmarks', children: [] }
    ]
  }];
  assert.strictEqual(
    bookmarkStore.findBookmarksBarNode(firefoxTree).id,
    'toolbar_____',
    'Firefox exposes the bookmarks toolbar under its fixed GUID, not id 1'
  );

  const cache = bookmarkStore.buildBookmarkFolderCache(tree, {
    normalizeHost: (host) => String(host || '').toLowerCase().replace(/^www\./, '')
  });
  assert.strictEqual(cache.rootFolderId, '10');
  assert.ok(cache.nodeMap instanceof Map);
  assert.ok(cache.folderItemsCache instanceof Map);
  assert.deepStrictEqual(
    cache.folderItemsCache.get('10').map((item) => item.id),
    ['11', '12', '13'],
    'distinct bookmark ids should keep distinct cards even when their URLs match'
  );

  const folderItem = cache.folderItemsCache.get('10').find((item) => item.type === 'folder');
  const firstBookmarkItem = cache.folderItemsCache.get('10').find((item) => item.type === 'bookmark');
  assert.strictEqual(firstBookmarkItem.parentId, '10');
  assert.strictEqual(firstBookmarkItem.index, 0);
  assert.strictEqual(folderItem.parentId, '10');
  assert.strictEqual(folderItem.index, 2);
  assert.strictEqual(folderItem.themeUrl, 'https://figma.com/files');
  assert.deepStrictEqual(folderItem.previewUrls, [
    'https://figma.com/files',
    'https://lumno.kubai.design/'
  ]);

  assert.deepStrictEqual(
    bookmarkStore.collectFolderBookmarkUrls({
      id: 'folder-recursive',
      children: [
        { id: 'a', url: 'https://first.example/' },
        {
          id: 'nested',
          children: [
            { id: 'duplicate', url: 'https://first.example/' },
            { id: 'script', url: '  JaVaScRiPt:alert(1)  ' },
            { id: 'b', url: 'https://second.example/' }
          ]
        }
      ]
    }),
    [
      'https://first.example/',
      'https://first.example/',
      'https://second.example/'
    ],
    'folder opening should recurse in tree order, preserve duplicate nodes, and ignore JavaScript bookmarks'
  );
  assert.deepStrictEqual(
    bookmarkStore.collectFolderBookmarkUrls({ id: 'empty', children: [] }),
    [],
    'empty folders should not produce tab URLs'
  );

  const path = bookmarkStore.buildBookmarkFolderPath('13', {
    nodeMap: cache.nodeMap,
    rootId: cache.rootFolderId,
    rootTitle: '书签'
  });
  assert.deepStrictEqual(path.map((item) => item.title), ['书签', 'Design']);

  assert.deepStrictEqual(
    bookmarkStore.getBookmarkPageItems([1, 2, 3, 4, 5], 1, 2),
    [3, 4]
  );

  const crossLevelTree = [{
    id: '0',
    title: '',
    children: [{
      id: '20',
      title: 'Bookmarks bar',
      children: [
        {
          id: '21',
          title: 'Existing destination card',
          url: 'https://same.example/'
        },
        {
          id: '22',
          title: 'Source folder',
          children: [{
            id: '23',
            title: 'Moved card',
            url: 'https://same.example/'
          }]
        }
      ]
    }]
  }];
  const crossLevelRoot = crossLevelTree[0].children[0];
  const sourceFolder = crossLevelRoot.children[1];
  const movedBookmark = sourceFolder.children.splice(0, 1)[0];
  movedBookmark.parentId = crossLevelRoot.id;
  movedBookmark.index = crossLevelRoot.children.length;
  crossLevelRoot.children.push(movedBookmark);
  const crossLevelCache = bookmarkStore.buildBookmarkFolderCache(crossLevelTree);
  ['folder', 'list', 'top'].forEach((viewMode) => {
    assert.deepStrictEqual(
      crossLevelCache.folderItemsCache.get('20').map((item) => item.id),
      ['21', '22', '23'],
      `${viewMode} mode should retain a moved bookmark card when its URL already exists`
    );
  });
}

function testNewtabRejectsProvisionalSectionCacheHydration() {
  const newtabJs = readNewtabRuntimeSource();
  assert.doesNotMatch(
    newtabJs,
    /shouldApplyBookmarkCacheHydration|hydrateSectionsFromCache|_x_extension_newtab_(?:recent|bookmark)_cache_2024_unique_/,
    'newtab should not render provisional cached section geometry before authoritative startup data'
  );
}

testRecentStore()
  .then(() => {
    testBookmarkStore();
    testNewtabRejectsProvisionalSectionCacheHydration();
    console.log('newtab store tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
