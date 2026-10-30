import { describe, expect, it } from 'vitest';
import * as settings from '../domain/settings';
import { SHORTCUT_STORAGE_KEYS } from '../domain/shortcuts/constants';
import { CONTENT_MAX_WIDTH_PX, STANDARD_SEARCH_MAX_WIDTH_PX } from './dom/layout';
import {
  NEWTAB_WIDTH_MODE_CONFIGS,
  RECENT_CARD_TARGET_WIDTH_PX,
  RECENT_GRID_GAP_PX,
  RECENT_WIDE_MAX_COLUMNS,
  SYNCED_PAGE_STORAGE_KEYS,
  createSiteDisplayNameOptions
} from './newtab-config';

describe('New Tab configuration', () => {
  it('names a few sites by their translated local brand', () => {
    const translated: string[] = [];
    const siteNames = createSiteDisplayNameOptions((key, fallback) => {
      translated.push(key);
      return `${fallback}*`;
    });

    expect(siteNames.getBrandName('mp.weixin.qq.com', 'Weixin')).toBe('微信公众号*');
    expect(siteNames.getBrandName('weibo.com', 'Weibo')).toBe('微博*');
    expect(siteNames.getBrandName('example.com', 'Example')).toBe('Example');
    expect(translated).toEqual(['site_brand_wechat_official', 'site_search_name_weibo']);
  });

  it('sizes the standard and the wide width modes', () => {
    expect(NEWTAB_WIDTH_MODE_CONFIGS.standard).toEqual({
      searchMaxWidth: STANDARD_SEARCH_MAX_WIDTH_PX,
      contentMaxWidth: CONTENT_MAX_WIDTH_PX,
      recentMaxColumns: 4
    });
    expect(NEWTAB_WIDTH_MODE_CONFIGS.wide).toEqual({
      searchMaxWidth: 920,
      // Six recent cards and the gaps between them.
      contentMaxWidth: 6 * RECENT_CARD_TARGET_WIDTH_PX + 5 * RECENT_GRID_GAP_PX,
      recentMaxColumns: RECENT_WIDE_MAX_COLUMNS
    });
  });

  it('moves each preference and the shortcuts to browser sync once', () => {
    expect(new Set(SYNCED_PAGE_STORAGE_KEYS).size).toBe(SYNCED_PAGE_STORAGE_KEYS.length);
    SYNCED_PAGE_STORAGE_KEYS.forEach((key) => expect(key.startsWith('_x_extension_')).toBe(true));
    expect(SYNCED_PAGE_STORAGE_KEYS).toEqual(expect.arrayContaining([...SHORTCUT_STORAGE_KEYS]));
  });

  it('keeps device-only data on this device', () => {
    [
      settings.newtabLocalWallpaper.key,
      ...settings.BOOKMARK_TOPBAR_SURFACE_KEYS,
      ...settings.OVERLAY_FONT_KEYS
    ].forEach((key) => expect(SYNCED_PAGE_STORAGE_KEYS).not.toContain(key));
  });
});
