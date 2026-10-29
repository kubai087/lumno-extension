'use strict';

// The chrome.storage.local items that hold site-search provider icons, made
// with the extension's own icon store, so a test can start a page or the
// worker with icons already cached.

const shortcutFavicon = require('./shortcut-favicon.ts');
const shortcutFaviconStore = require('../../src/platform/shortcut-favicon-store.ts');

// entries: [{ provider, dataUrl }]
async function siteSearchIconCacheStorage(entries) {
  const data = {};
  const area = {
    get(keys, callback) {
      const list = Array.isArray(keys) ? keys : [keys];
      callback(Object.fromEntries(list.filter((key) => key in data).map((key) => [key, data[key]])));
    },
    set(items, callback) {
      Object.assign(data, JSON.parse(JSON.stringify(items)));
      if (callback) callback();
    },
    remove(_keys, callback) {
      if (callback) callback();
    }
  };
  const store = shortcutFaviconStore.createSiteSearchIconStore({
    chromeApi: { runtime: {} },
    storageArea: area,
  });
  const cache = entries.reduce((current, { provider, dataUrl }) => {
    const pageUrl = shortcutFavicon.getSiteSearchProviderPageUrl(provider);
    return shortcutFavicon.setCachedIcon(current, pageUrl, dataUrl,
      `https://t2.gstatic.cn/faviconV2?url=${encodeURIComponent(pageUrl)}`, Date.now(), shortcutFavicon.SITE_SEARCH_CACHE_OPTIONS);
  }, {});
  await store.writeAll(cache);
  return data;
}

module.exports = { siteSearchIconCacheStorage };
