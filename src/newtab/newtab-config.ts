// The New Tab page's fixed configuration: the values its menus hand back,
// layout sizes, the glass plates that sample the wallpaper, and the settings
// it moves into browser sync.
import * as LumnoSettings from '../domain/settings';
import { CONTENT_MAX_WIDTH_PX, STANDARD_SEARCH_MAX_WIDTH_PX, getGridContentWidthForColumns } from './layout';
import { SHORTCUT_STORAGE_KEYS } from '../domain/shortcuts/constants';

// What a site's own name is shown as, given its brand host.
type Translate = (key: string, fallback: string) => string;

interface SiteDisplayNameOptions {
  getBrandName(brandHost: string, fallback: string): string;
}

// How wide the page lays out in each width mode.
interface NewtabWidthModeConfig {
  searchMaxWidth: number;
  contentMaxWidth: number;
  recentMaxColumns: number;
}



// The plates that sit straight on the wallpaper; floating menus and panels keep a fixed dense tint.
const NEWTAB_GLASS_ADAPTIVE_SELECTOR = [
  '#_x_extension_newtab_root_2024_unique_',
  '.x-nt-shortcut-icon',
  '.x-nt-bookmark-card:not(.x-nt-bookmarks-topbar .x-nt-bookmark-card):not(.x-nt-bookmark-card-drag-preview)' +
    ':not([data-bookmark-page-outgoing] .x-nt-bookmark-card)',
  '.x-nt-recent-card-visual',
  '.x-nt-wallpaper-button',
  '.x-nt-feedback-button',
  '.x-nt-bookmarks-pager-btn:not(.x-nt-bookmarks-topbar *)',
  '.x-nt-section-mode-select ._x_extension_select_trigger_2024_unique_:not(.x-nt-bookmarks-topbar *)',
  '.x-nt-bookmark-cascade-debug-button'
].join(',');

// How long a favicon waits for the icon caches on the first render.
const FAVICON_CACHE_BOOT_WAIT_MS = 120;
const MAX_PINNED_RECENT_SITES = 3;

const WORDMARK_ENTRY_ANIMATION_NAME = '_x_nt_wordmark_enter_2026_unique_';
const RECENT_CARD_TARGET_WIDTH_PX = 248;
const RECENT_GRID_GAP_PX = 12;
// Narrower than this, the page flows as one column, as on a phone.
const NEWTAB_MOBILE_FLOW_BREAKPOINT_PX = 640;
const RECENT_WIDE_MAX_COLUMNS = 6;
const NEWTAB_WIDTH_MODE_CONFIGS: Readonly<Record<LumnoSettings.NewtabWidthMode, Readonly<NewtabWidthModeConfig>>> =
  Object.freeze({
    standard: Object.freeze({
      searchMaxWidth: STANDARD_SEARCH_MAX_WIDTH_PX,
      contentMaxWidth: CONTENT_MAX_WIDTH_PX,
      recentMaxColumns: 4
    }),
    wide: Object.freeze({
      searchMaxWidth: 920,
      contentMaxWidth: getGridContentWidthForColumns(RECENT_WIDE_MAX_COLUMNS, RECENT_CARD_TARGET_WIDTH_PX, RECENT_GRID_GAP_PX),
      recentMaxColumns: RECENT_WIDE_MAX_COLUMNS
    })
  });

// Preferences an older version kept in local storage, moved into browser
// sync when that is where settings live.
const SYNCED_PAGE_STORAGE_KEYS: readonly string[] = Object.freeze([
  LumnoSettings.themeMode.key,
  LumnoSettings.language.key,
  LumnoSettings.recentMode.key,
  LumnoSettings.recentCount.key,
  LumnoSettings.newtabWidthMode.key,
  LumnoSettings.newtabSearchWidth.key,
  LumnoSettings.newtabInputAutoFocusEnabled.key,
  LumnoSettings.newtabQuotePrefs.key,
  LumnoSettings.newtabFeedbackButtonVisible.key,
  LumnoSettings.newtabAppearanceButtonVisible.key,
  LumnoSettings.newtabGlassStyle.key,
  LumnoSettings.newtabTopContentMode.key,
  LumnoSettings.newtabTimeFontWeight.key,
  LumnoSettings.newtabTimeFontSize.key,
  LumnoSettings.newtabTimeOpacity.key,
  LumnoSettings.newtabTimeInk.key,
  LumnoSettings.newtabTimeFont.key,
  LumnoSettings.newtabTimeSecondsVisible.key,
  LumnoSettings.newtabTime12Hour.key,
  LumnoSettings.newtabThemeMode.key,
  LumnoSettings.newtabThemeScope.key,
  LumnoSettings.newtabZenMode.key,
  LumnoSettings.newtabWallpaper.key,
  LumnoSettings.newtabWallpaperOverlay.key,
  LumnoSettings.newtabWallpaperEffect.key,
  LumnoSettings.newtabFavicon.key,
  LumnoSettings.bookmarkCount.key,
  LumnoSettings.bookmarkColumns.key,
  LumnoSettings.bookmarkViewMode.key,
  LumnoSettings.bookmarkFolderIconsVisible.key,
  LumnoSettings.bookmarkCascadeDebug.key,
  LumnoSettings.tabRankScoreDebug.key,
  LumnoSettings.defaultSearchEngine.key,
  LumnoSettings.searchResultPriority.key,
  LumnoSettings.searchResultSourceTypes.key,
  LumnoSettings.searchResultDisplayLimit.key,
  LumnoSettings.siteSearchCustom.key,
  LumnoSettings.siteSearchDisabled.key,
  LumnoSettings.aggregateSearches.key,
  LumnoSettings.searchBlacklist.key,
  LumnoSettings.faviconRequestBlacklist.key,
  LumnoSettings.faviconEnhancedFetchEnabled.key,
  LumnoSettings.pinnedRecentSites.key,
  LumnoSettings.hiddenRecentSites.key,
  ...SHORTCUT_STORAGE_KEYS,
  LumnoSettings.newtabShortcutsVisible.key,
  LumnoSettings.newtabShortcutAddVisible.key,
  LumnoSettings.newtabShortcutDockMagnificationEnabled.key,
  LumnoSettings.newtabShortcutWidth.key,
  LumnoSettings.newtabShortcutColumns.key,
  LumnoSettings.newtabShortcutSize.key,
  LumnoSettings.newtabShortcutGap.key
]);

// Sites whose brand reads better under its local name than its host.
function createSiteDisplayNameOptions(t: Translate): Readonly<SiteDisplayNameOptions> {
  return Object.freeze({
    getBrandName(brandHost: string, fallback: string): string {
      if (brandHost === 'mp.weixin.qq.com') {
        return t('site_brand_wechat_official', '微信公众号');
      }
      if (brandHost === 'weibo.com') {
        return t('site_search_name_weibo', '微博');
      }
      return fallback;
    }
  });
}

export {
  FAVICON_CACHE_BOOT_WAIT_MS,
  MAX_PINNED_RECENT_SITES,
  NEWTAB_GLASS_ADAPTIVE_SELECTOR,
  NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
  NEWTAB_WIDTH_MODE_CONFIGS,
  RECENT_CARD_TARGET_WIDTH_PX,
  RECENT_GRID_GAP_PX,
  RECENT_WIDE_MAX_COLUMNS,
  SYNCED_PAGE_STORAGE_KEYS,
  WORDMARK_ENTRY_ANIMATION_NAME,
  createSiteDisplayNameOptions
};
export type { NewtabWidthModeConfig, SiteDisplayNameOptions };
