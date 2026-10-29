const assert = require('assert');
const config = require('../../src/newtab/newtab-config.ts');
const settings = require('../../src/domain/settings/index.ts');
const shortcutsStore = require('../helpers/shortcuts-store.ts');
const layout = require('../../src/newtab/dom/layout.ts');

// The New Tab's fixed configuration: brand names, the width modes and the
// preferences moved into browser sync.

const translated = [];
const siteNames = config.createSiteDisplayNameOptions((key, fallback) => {
  translated.push(key);
  return `${fallback}*`;
});
assert.strictEqual(siteNames.getBrandName('mp.weixin.qq.com', 'Weixin'), '微信公众号*');
assert.strictEqual(siteNames.getBrandName('weibo.com', 'Weibo'), '微博*');
assert.strictEqual(siteNames.getBrandName('example.com', 'Example'), 'Example',
  'other sites keep the name they were given');
assert.deepStrictEqual(translated, ['site_brand_wechat_official', 'site_search_name_weibo']);

assert.deepStrictEqual(config.NEWTAB_WIDTH_MODE_CONFIGS.standard, {
  searchMaxWidth: layout.STANDARD_SEARCH_MAX_WIDTH_PX,
  contentMaxWidth: layout.CONTENT_MAX_WIDTH_PX,
  recentMaxColumns: 4
});
assert.deepStrictEqual(config.NEWTAB_WIDTH_MODE_CONFIGS.wide, {
  searchMaxWidth: 920,
  // Six recent cards and the gaps between them.
  contentMaxWidth: 6 * config.RECENT_CARD_TARGET_WIDTH_PX + 5 * config.RECENT_GRID_GAP_PX,
  recentMaxColumns: config.RECENT_WIDE_MAX_COLUMNS
});

const synced = config.SYNCED_PAGE_STORAGE_KEYS;
assert.strictEqual(new Set(synced).size, synced.length, 'each preference is moved once');
assert.ok(synced.every((key) => typeof key === 'string' && key.startsWith('_x_extension_')));
shortcutsStore.SHORTCUT_STORAGE_KEYS.forEach((key) => {
  assert.ok(synced.includes(key), `the shortcuts move with the preferences: ${key}`);
});
[
  settings.newtabLocalWallpaper.key,
  ...settings.BOOKMARK_TOPBAR_SURFACE_KEYS,
  ...settings.OVERLAY_FONT_KEYS
].forEach((key) => {
  assert.ok(!synced.includes(key), `device-only data stays on this device: ${key}`);
});

console.log('newtab config tests passed');
